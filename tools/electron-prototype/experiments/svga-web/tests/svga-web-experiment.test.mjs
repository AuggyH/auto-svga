import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import protobuf from "protobufjs";
import { legacyBrowserBaselineAuditCsp, strictCsp, startSvgaWebExperimentServer } from "../server.mjs";
import {
  appName,
  auditInfoPlistSecurity,
  buildMacosPackageProof,
  bundleIdentifier,
  finalAcceptanceOwner,
  macosPackagerArgs
} from "../scripts/macos-package-proof.mjs";

const require = createRequire(import.meta.url);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const vendorPath = path.join(experimentRoot, "vendor/svga-web-2.4.4.js");
const hostContract = require("../host-adapter-contract.cjs");
const { createDesktopArtifactCatalog } = require("../desktop-artifact-catalog.cjs");
const {
  validateSequenceByteRepairProof,
  validateSequenceProductRepairProof,
  validateSequenceRepairReportBinding
} = require("../sequence-repair-proof-contract.cjs");

test("macOS internal package scaffold avoids unsupported Finder .svga document association", async () => {
  const plist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  const entitlements = await readFile(path.join(experimentRoot, "packaging/macos/entitlements.plist"), "utf8");
  assert.equal(appName, "Auto SVGA");
  assert.match(plist, /CFBundleDisplayName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.match(plist, /CFBundleName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.doesNotMatch(plist, /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(plist, /AutoSVGAInternalUseOnly/);
  assert.match(plist, /AutoSVGASigned/);
  assert.match(plist, /AutoSVGANotarized/);
  assert.match(plist, /AutoSVGAProductionApproved/);
  assert.match(plist, new RegExp(bundleIdentifier));
  assert.doesNotMatch(plist, /CFBundleDocumentTypes/);
  assert.doesNotMatch(plist, /CFBundleTypeRole[\s\S]*Viewer/);
  assert.doesNotMatch(plist, /LSHandlerRank[\s\S]*Alternate/);
  assert.doesNotMatch(plist, /UTExportedTypeDeclarations/);
  assert.doesNotMatch(plist, /com\.auto-svga\.svga/);
  assert.doesNotMatch(plist, /public\.filename-extension[\s\S]*svga/);
  assert.doesNotMatch(plist, /NSAllowsArbitraryLoads/);
  assert.doesNotMatch(plist, /NSCameraUsageDescription/);
  assert.doesNotMatch(plist, /NSMicrophoneUsageDescription/);
  assert.doesNotMatch(plist, /NSBluetooth/);
  assert.equal(auditInfoPlistSecurity(plist).passed, true);

  const packagerArgs = macosPackagerArgs(".artifacts/internal-trial");
  assert.equal(packagerArgs[1], appName);
  assert.ok(packagerArgs.includes("--platform=darwin"));
  assert.ok(packagerArgs.includes("--arch=arm64"));
  assert.ok(packagerArgs.includes(`--app-bundle-id=${bundleIdentifier}`));
  assert.ok(packagerArgs.includes("--app-version=0.0.0-internal"));
  assert.ok(packagerArgs.includes("--build-version=0.0.0-internal"));
  assert.ok(packagerArgs.some((arg) => arg === "--extend-info=packaging/macos/Info.plist"));
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-unsigned-executable-memory/);
  assert.match(entitlements, /com\.apple\.security\.cs\.disable-library-validation/);
});

test("macOS package proof manifest records audit boundaries without final App acceptance", async () => {
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip"),
    validatePackagedApp: false
  });
  const packageScript = await readFile(path.join(experimentRoot, "scripts/package-internal-trial.mjs"), "utf8");
  const signingWorkflow = await readFile(path.join(experimentRoot, "scripts/macos-signing-workflow.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(experimentRoot, "package.json"), "utf8"));
  assert.equal(proof.schemaVersion, 1);
  assert.equal(proof.appName, "Auto SVGA");
  assert.equal(proof.bundleDisplayName, "Auto SVGA");
  assert.equal(proof.platform, "darwin");
  assert.equal(proof.architecture, "arm64");
  assert.equal(proof.distribution.internalUseOnly, true);
  assert.equal(proof.distribution.unsigned, true);
  assert.equal(proof.distribution.notarized, false);
  assert.equal(proof.distribution.productionApproved, false);
  assert.equal(proof.distribution.finalPackagedAppAcceptanceOwner, finalAcceptanceOwner);
  assert.deepEqual(proof.documentTypes, []);
  assert.equal(proof.documentAssociationPolicy.svgaFinderOpen, "not-declared");
  assert.match(proof.documentAssociationPolicy.reason, /in-app file picker and drag\/drop only/);
  assert.match(proof.knownRisks.join(" "), /Finder double-click/);
  assert.equal(proof.privacyAudit.passed, true);
  assert.deepEqual(proof.privacyAudit.findings, []);
  assert.equal(proof.infoPlistSecurityAudit.passed, true);
  assert.equal(proof.infoPlistSecurityAudit.source.passed, true);
  assert.equal(proof.infoPlistSecurityAudit.packagedApp.passed, true);
  assert.equal(proof.metadataSecurity.noArbitraryNetworkLoads, true);
  assert.equal(proof.metadataSecurity.noUnnecessaryPermissionUsageDescriptions, true);
  assert.equal(proof.metadataSecurity.noFinderDocumentAssociation, true);
  assert.match(proof.packagingScaffold.extendInfoPath, /packaging\/macos\/Info\.plist$/);
  assert.match(proof.packagingScaffold.packagedInfoPlistPath, /Auto SVGA\.app\/Contents\/Info\.plist$/);
  assert.match(proof.packagingScaffold.entitlementsPath, /packaging\/macos\/entitlements\.plist$/);
  assert.equal(proof.packagingScaffold.signScript, "internal:trial:sign:mac");
  assert.equal(proof.packagingScaffold.notarizeScript, "internal:trial:notarize:mac");
  assert.equal(packageJson.scripts["internal:trial:sign:mac"], "node scripts/macos-signing-workflow.mjs sign");
  assert.equal(packageJson.scripts["internal:trial:notarize:mac"], "node scripts/macos-signing-workflow.mjs notarize");
  assert.match(signingWorkflow, /SIGNING_BLOCKED_REQUIRES_CREDENTIALS/);
  assert.match(signingWorkflow, /codesign/);
  assert.match(signingWorkflow, /notarytool/);
  assert.match(signingWorkflow, /stapler/);
  assert.match(signingWorkflow, /READY_REQUIRES_EXPLICIT_EXECUTE/);
  assert.match(proof.packagingScaffold.appBundlePath, /Auto SVGA-darwin-arm64\/Auto SVGA\.app$/);
  assert.doesNotMatch(JSON.stringify(proof), /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(proof.requestedIntegrationChanges[0], /root package script/);
  assert.match(packageScript, /archiveEntryCount/);
  assert.match(packageScript, /zipEntries\(archivePath\)\.length/);
  assert.match(packageScript, /--norsrc/);
  assert.match(packageScript, /COPYFILE_DISABLE/);
  assert.match(packageScript, /assertCleanZipEntries/);
  assert.match(packageScript, /sanitizePackagedInfoPlist/);
  assert.match(packageScript, /NSAudioCaptureUsageDescription/);
  assert.doesNotMatch(packageScript, /--sequesterRsrc/);
});

test("macOS Info.plist security audit rejects arbitrary network, unused permissions, and Finder associations", () => {
  const badPlist = [
    "<plist><dict>",
    "<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>",
    "<key>NSCameraUsageDescription</key><string>unused</string>",
    "<key>NSMicrophoneUsageDescription</key><string>unused</string>",
    "<key>NSBluetoothAlwaysUsageDescription</key><string>unused</string>",
    "<key>CFBundleDocumentTypes</key><array><dict><key>CFBundleTypeExtensions</key><array><string>svga</string></array></dict></array>",
    "</dict></plist>"
  ].join("");
  const audit = auditInfoPlistSecurity(badPlist);
  assert.equal(audit.passed, false);
  assert.deepEqual(audit.arbitraryNetworkAllowances, ["NSAllowsArbitraryLoads"]);
  assert.ok(audit.permissionUsageDescriptions.includes("NSCameraUsageDescription"));
  assert.ok(audit.permissionUsageDescriptions.includes("NSMicrophoneUsageDescription"));
  assert.ok(audit.permissionUsageDescriptions.includes("NSBluetoothAlwaysUsageDescription"));
  assert.ok(audit.finderDocumentAssociations.includes("CFBundleDocumentTypes"));
  assert.ok(audit.finderDocumentAssociations.includes("svga-filename-extension"));
});

test("sequence byte repair proof rejects no-op and write-exposed evidence", () => {
  const sourceSha256 = "a".repeat(64);
  const editedSha256 = "b".repeat(64);
  const beforeSha256 = "c".repeat(64);
  const afterSha256 = "d".repeat(64);
  const validProof = {
    schemaVersion: 1,
    proofId: "svga-sequence-byte-repair-proof",
    source: "workbench-sequence-byte-repair",
    sourceSha256,
    sourceSha256AfterRepair: sourceSha256,
    editedSha256,
    prototypeId: "svga-bounded-sequence-repair-prototype-v1",
    resourceKeyCount: 1,
    operationCount: 1,
    resourceDiffs: [{ resourceKey: "seq_001", beforeSha256, afterSha256 }],
    roundTripMode: "edited_bytes_reopen",
    sourceDeltaProduced: true,
    editedBytesProduced: true,
    roundTripPassed: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    writeAttempted: false,
    productSaveAsEnabled: false,
    writeActionExposed: false,
    repairSuccessClaimed: false,
    manualVisualConfirmationRequired: true,
    passed: true
  };

  assert.equal(validateSequenceByteRepairProof(validProof)?.editedSha256, editedSha256);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, editedSha256: sourceSha256 }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, roundTripMode: "no_op_source_reopen" }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, roundTripNoopOnly: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, sourceDeltaProduced: false }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, resourceDiffs: [{ resourceKey: "seq_001", beforeSha256, afterSha256: beforeSha256 }] }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, productSaveAsEnabled: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, writeActionExposed: true }), undefined);
  assert.equal(validateSequenceByteRepairProof({ ...validProof, repairSuccessClaimed: true }), undefined);
});

test("sequence product repair report and Save As proof fail closed on unsafe evidence", () => {
  const sourceSha256 = "a".repeat(64);
  const editedBytes = Buffer.from("sequence-edited-svga");
  const editedSha256 = createHash("sha256").update(editedBytes).digest("hex");
  const beforeSha256 = "b".repeat(64);
  const transparentSha256 = "c".repeat(64);
  const unchangedSha256 = "d".repeat(64);
  const alphaProof = Array.from({ length: 8 }, (_, index) => {
    const changed = index === 3;
    return {
      resourceKey: `seq_${String(index + 1).padStart(3, "0")}`,
      spriteIndex: index,
      frameIndex: index + 1,
      usageCount: 1,
      width: 200,
      height: 200,
      beforeSha256: changed ? beforeSha256 : unchangedSha256,
      afterSha256: changed ? transparentSha256 : unchangedSha256,
      beforeNonTransparentPixelCount: changed ? 4 : 4000,
      afterNonTransparentPixelCount: changed ? 0 : 4000,
      beforeNonTransparentRatio: changed ? 0.0001 : 0.1,
      afterNonTransparentRatio: changed ? 0 : 0.1,
      beforeAlphaBounds: changed ? { x: 10, y: 10, width: 2, height: 2 } : { x: 0, y: 0, width: 200, height: 200 },
      afterAlphaBounds: changed ? null : { x: 0, y: 0, width: 200, height: 200 },
      visibleFrameIndices: [index * 2, index * 2 + 1],
      maxTimelineAlpha: 1,
      timelineAlphaDigest: "e".repeat(64),
      changed,
      changeReason: changed ? "near_empty_speck_to_transparent" : "unchanged",
      passed: true
    };
  });
  const validReport = {
    schemaVersion: 1,
    repairId: "svga-sequence-frame-anti-flicker-v1",
    status: "repaired",
    sourceSha256,
    sourceSha256AfterRepair: sourceSha256,
    editedSha256,
    headCommit: "phase4-test",
    sequenceGroup: {
      groupId: "seq_:200x200",
      detectionMethod: "continuous_numeric_resource_keys",
      resourceKeys: alphaProof.map((entry) => entry.resourceKey),
      resourceKeyCount: alphaProof.length,
      repairedResourceKey: "seq_004",
      targetVisibleFrames: [6, 7],
      fullAffectedFrameVisibilityAlphaProof: alphaProof
    },
    selectedRepair: {
      resourceKey: "seq_004",
      reason: "near_empty_visible_speck_frame",
      replacement: "same_dimensions_transparent_png",
      beforeNonTransparentPixelCount: 4,
      afterNonTransparentPixelCount: 0,
      beforeNonTransparentRatio: 0.0001,
      afterNonTransparentRatio: 0,
      beforeSha256,
      afterSha256: transparentSha256
    },
    roundTripReport: {
      schemaVersion: 2,
      milestoneId: "P3",
      sourceSha256,
      sourceSha256AfterEditing: sourceSha256,
      exportedSha256: editedSha256,
      replacedResourceKey: "seq_004",
      exportedResourceSha256: transparentSha256,
      passed: true
    },
    invariantSummary: {
      sourceUnchanged: true,
      roundTripPassed: true,
      imageResourceKeySetStable: true,
      spriteTimelineStable: true,
      untouchedResourceHashesStable: true,
      onlySelectedResourceChanged: true,
      replacementDimensionsMatchOriginal: true
    },
    productSaveAsEnabled: true,
    repairSuccessClaimed: true,
    manualVisualConfirmationRequired: false,
    failureClosed: true,
    passed: true
  };
  const validProof = {
    schemaVersion: 1,
    proofId: "svga-sequence-product-repair-save-as-proof",
    source: "workbench-sequence-product-repair-save-as",
    sourceSha256,
    editedSha256,
    savedSha256: editedSha256,
    savedFileName: "sequence-repaired-output.svga",
    saveStatus: "saved",
    repairedResourceKey: "seq_004",
    groupResourceKeyCount: 8,
    alphaProofResourceCount: 8,
    changedResourceCount: 1,
    fullAffectedFrameVisibilityAlphaProof: alphaProof,
    targetVisibleFrames: [6, 7],
    beforeAfterPlaybackProof: [{
      frameIndex: 6,
      beforeCanvasSha256: "f".repeat(64),
      afterCanvasSha256: "1".repeat(64),
      canvasWidth: 200,
      canvasHeight: 200,
      canvasDimensionsStable: true,
      beforeCanvasNonBlank: true,
      afterCanvasNonBlank: true,
      canvasHashChanged: true
    }],
    playbackDeltaObserved: true,
    savedHashBound: true,
    sourceUnchanged: true,
    fullAffectedFrameVisibilityAlphaProofPassed: true,
    repairedFrameTransparentAfter: true,
    productSaveAsEnabled: true,
    repairSuccessClaimed: true,
    manualVisualConfirmationRequired: false,
    failureClosed: true,
    reopenedPlayback: true,
    reopenedCanvasNonBlank: true,
    reopenedInspectionReport: true,
    renderedProofPassed: true,
    passed: true
  };

  assert.equal(validateSequenceRepairReportBinding(validReport, editedBytes)?.editedSha256, editedSha256);
  assert.equal(validateSequenceRepairReportBinding({ ...validReport, manualVisualConfirmationRequired: true }, editedBytes), undefined);
  assert.equal(validateSequenceRepairReportBinding({ ...validReport, productSaveAsEnabled: false }, editedBytes), undefined);
  assert.equal(validateSequenceRepairReportBinding(validReport, Buffer.from("different")), undefined);
  assert.equal(validateSequenceProductRepairProof(validProof)?.savedSha256, editedSha256);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, productSaveAsEnabled: false }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, manualVisualConfirmationRequired: true }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, playbackDeltaObserved: false })?.passed, true);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, beforeAfterPlaybackProof: [] }), undefined);
  assert.equal(validateSequenceProductRepairProof({ ...validProof, savedSha256: sourceSha256 }), undefined);
});

test("vendored svga-web asset is pinned and strict-CSP compatible", async () => {
  const source = await readFile(vendorPath, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), "6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50");
  assert.equal(source.includes("eval("), false);
  assert.equal(source.includes("Function("), false);
  assert.match(await readFile(path.join(experimentRoot, "vendor/NOTICE.md"), "utf8"), /MIT/);
});

test("server uses bounded internal-trial CSP and keeps report API token-bound", async () => {
  assert.match(strictCsp, /script-src 'self'/);
  assert.match(strictCsp, /wasm-unsafe-eval/);
  assert.doesNotMatch(strictCsp, /(?<!wasm-)unsafe-eval/);
  assert.match(strictCsp, /worker-src 'self' blob:/);
  assert.match(strictCsp, /connect-src 'self' blob:/);
  assert.match(legacyBrowserBaselineAuditCsp, /unsafe-eval/);
  const reportToken = "test-token";
  const desktopArtifactBytes = new Uint8Array([83, 86, 71, 65]);
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken,
    desktopArtifacts: {
      readArtifact(publicPath) {
        if (publicPath !== "/desktop-artifact/0123456789abcdef01234567/fixture.svga") return undefined;
        return {
          bytes: desktopArtifactBytes,
          mimeType: "application/octet-stream",
          sizeBytes: desktopArtifactBytes.byteLength
        };
      }
    }
  });
  try {
    const health = await fetch(`${server.origin}/health`).then((response) => response.json());
    assert.deepEqual(health, {
      status: "ok",
      runtime: "auto-svga-desktop-preview",
      prototypeLabel: "Auto SVGA Desktop Preview; internal prototype, not production"
    });
    const unauthorized = await fetch(`${server.origin}/api/avatar-frame-inspection-report`, { method: "POST" });
    assert.equal(unauthorized.status, 401);
    const page = await fetch(`${server.origin}/`).then((response) => response.text());
    assert.match(page, /<title>Auto SVGA<\/title>/);
    assert.match(page, /data-app-state="launch"/);
    assert.match(page, /short-term-macos-app\.mjs/);
    assert.match(page, /short-term-macos\.tokens\.css/);
    assert.match(page, /short-term-macos\.css/);
    assert.match(page, /覆盖保存/);
    assert.doesNotMatch(page, /productShellMount/);
    assert.doesNotMatch(page, /desktop-product-entry\.mjs/);
    assert.doesNotMatch(page, /prototype\.js/);
    assert.doesNotMatch(page, /brandMark/);
    assert.doesNotMatch(page, /cdn\.jsdelivr|(?<!wasm-)unsafe-eval/);
    const workbenchPage = await fetch(`${server.origin}/workbench.html`).then((response) => response.text());
    assert.match(workbenchPage, /productShellMount/);
    assert.match(workbenchPage, /desktop-product-entry\.mjs/);
    const sharedShell = await fetch(`${server.origin}/tools/shared/product-frontend/product-shell.html`).then((response) => response.text());
    assert.match(sharedShell, /brandMark/);
    assert.match(sharedShell, /本地预览/);
    const sharedTokens = await fetch(`${server.origin}/tools/shared/product-tokens.css`);
    assert.equal(sharedTokens.status, 200);
    const missingAuditSample = await fetch(`${server.origin}/audit-samples/missing.svga`);
    assert.equal(missingAuditSample.status, 404);
    const desktopArtifact = await fetch(`${server.origin}/desktop-artifact/0123456789abcdef01234567/fixture.svga`);
    assert.equal(desktopArtifact.status, 200);
    assert.equal(desktopArtifact.headers.get("content-type"), "application/octet-stream");
    assert.equal(await desktopArtifact.text(), "SVGA");
    const missingDesktopArtifact = await fetch(`${server.origin}/desktop-artifact/0123456789abcdef01234567/missing.svga`);
    assert.equal(missingDesktopArtifact.status, 404);
    const legacyVendor = await fetch(`${server.origin}/legacy-vendor/pako-2.1.0.min.js`);
    assert.equal(legacyVendor.status, 200);
    assert.match(legacyVendor.headers.get("content-type") ?? "", /text\/javascript/);
  } finally {
    await server.close();
  }
});

test("server exposes a token-bound safe SVGA image optimizer API", async () => {
  const reportToken = "optimizer-token";
  const sourceBytes = await createOptimizerFixture();
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken
  });
  try {
    const unauthorized = await fetch(`${server.origin}/api/svga-image-optimize`, { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`${server.origin}/api/svga-image-optimize`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": reportToken
      },
      body: JSON.stringify({
        name: "avatar-frame-smoke.svga",
        svgaBase64: sourceBytes.toString("base64")
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    const optimizedBytes = Buffer.from(body.optimizedSvgaBase64, "base64");

    assert.equal(body.optimizationReport.schemaVersion, 1);
    assert.equal(body.optimizationReport.optimizationId, "svga-safe-image-optimizer-v1");
    assert.equal(body.optimizationReport.sourceSha256, sourceSha256);
    assert.equal(body.optimizationReport.sourceSha256AfterOptimization, sourceSha256);
    assert.equal(body.optimizationReport.optimizedSha256, createHash("sha256").update(optimizedBytes).digest("hex"));
    assert.equal(body.optimizationReport.sourceUnchanged, true);
    assert.equal(body.optimizationReport.saveAsRequired, true);
    assert.equal(body.optimizationReport.passed, true);
    assert.equal(body.optimizationReport.originalImageCount, 3);
    assert.equal(body.optimizationReport.optimizedImageCount, 1);
    assert.deepEqual(body.optimizationReport.removedResourceKeys, ["img_copy", "img_unused"]);
    assert.equal(body.optimizationReport.invariantChecks.every(({ passed }) => passed), true);
  } finally {
    await server.close();
  }
});

test("server exposes a token-bound read-only SVGA image edit session API", async () => {
  const reportToken = "edit-session-token";
  const sourceBytes = await createOptimizerFixture();
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const server = await startSvgaWebExperimentServer({
    appRoot: experimentRoot,
    reportToken
  });
  try {
    const unauthorized = await fetch(`${server.origin}/api/svga-image-edit-session`, { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const response = await fetch(`${server.origin}/api/svga-image-edit-session`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auto-svga-prototype-token": reportToken
      },
      body: JSON.stringify({
        name: "../unsafe-name.svga",
        svgaBase64: sourceBytes.toString("base64")
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.session.sourceFile.name, "unsafe-name.svga");
    assert.equal(body.session.sourceFile.sha256, sourceSha256);
    assert.equal(body.session.dirty, false);
    assert.equal(body.session.exportState, "idle");
    assert.deepEqual(
      body.session.imageResources.map((resource) => resource.resourceKey),
      ["img_base", "img_copy", "img_unused"]
    );
    assert.equal(body.session.imageResources.every((resource) => resource.replacementStatus === "original"), true);
  } finally {
    await server.close();
  }
});

test("main process keeps sandboxed Electron security settings", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const hostContractSource = await readFile(path.join(experimentRoot, "host-adapter-contract.cjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const localTmpPath = ["/", "tmp", "preload.cjs"].join("");
  const localTmpFileUrl = `file://${["", "tmp", "test.svga"].join("/")}`;
  const securePreferences = hostContract.createSecureWebPreferences({
    preloadPath: localTmpPath,
    reportToken: "test-token",
    productMilestoneId: "P6"
  });
  assert.equal(securePreferences.contextIsolation, true);
  assert.equal(securePreferences.nodeIntegration, false);
  assert.equal(securePreferences.sandbox, true);
  assert.equal(securePreferences.webSecurity, true);
  assert.equal(securePreferences.allowRunningInsecureContent, false);
  assert.equal(securePreferences.spellcheck, false);
  assert.deepEqual(securePreferences.additionalArguments, [
    "--prototype-report-token=test-token",
    "--prototype-product-milestone=P6"
  ]);
  assert.equal(hostContract.isAllowedHostUrl("http://127.0.0.1:1234/", "http://127.0.0.1:1234"), true);
  assert.equal(hostContract.isAllowedHostUrl("blob:http://127.0.0.1:1234/id", "http://127.0.0.1:1234", { allowBlob: true }), true);
  assert.equal(hostContract.isAllowedHostUrl("devtools://devtools/bundled/inspector.html", "http://127.0.0.1:1234", { allowDevtools: true }), true);
  assert.equal(hostContract.isAllowedHostUrl("https://example.com/", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isAllowedHostUrl(localTmpFileUrl, "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isAllowedHostUrl("devtools://devtools/bundled/inspector.html", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:1234/index.html", "http://127.0.0.1:1234"), true);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:4321/index.html", "http://127.0.0.1:1234"), false);
  const invocations = [];
  const preloadApi = hostContract.createPreloadApi((channel, input) => {
    invocations.push({ channel, input });
    return { channel, input };
  }, { reportToken: "test-token", productMilestoneId: "P6" });
  const shortTermInvocations = [];
  const productPreloadApi = hostContract.createProductPreloadApi((channel, input) => {
    shortTermInvocations.push({ channel, input });
    return { channel, input };
  }, {
    reportToken: "test-token",
    productMilestoneId: "short-term"
  });
  const p6ProductPreloadApi = hostContract.createProductPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P6"
  });
  assert.equal(preloadApi.hostAdapterVersion, 1);
  assert.equal(preloadApi.telemetry, "disabled");
  assert.equal(preloadApi.capabilities.arbitraryFileSystemAccess, false);
  assert.equal(preloadApi.capabilities.shellAccess, false);
  assert.equal(preloadApi.capabilities.referenceMediaOpen, "host-dialog-mp4-webm-gif-only");
  assert.equal(preloadApi.capabilities.recentFiles, "host-user-data-redacted");
  assert.equal(preloadApi.capabilities.clipboardWrite, "host-clipboard-write-text-only");
  assert.equal(preloadApi.capabilities.finderDocumentAssociation, "not-declared");
  assert.equal(preloadApi.capabilities.overwriteSave, "host-source-path-from-file-picker-only");
  assert.deepEqual(preloadApi.capabilities.documentTypes, ["svga"]);
  assert.equal("sequenceRepairSaveAs" in productPreloadApi.capabilities, false);
  assert.equal("saveSequenceRepairSvga" in productPreloadApi, false);
  assert.equal("saveEditedSvga" in productPreloadApi, false);
  assert.equal("saveOptimizedSvga" in productPreloadApi, false);
  assert.equal("reportP4EditResult" in productPreloadApi, false);
  assert.equal(typeof productPreloadApi.saveShortTermSvgaOutput, "function");
  assert.equal(typeof productPreloadApi.updateShortTermMenuState, "function");
  assert.equal(typeof p6ProductPreloadApi.saveSequenceRepairSvga, "function");
  assert.equal(typeof p6ProductPreloadApi.reportP4EditResult, "function");
  assert.equal(typeof preloadApi.saveSequenceRepairSvga, "function");
  assert.equal(typeof preloadApi.saveEditedSvga, "function");
  assert.equal(typeof preloadApi.saveOptimizedSvga, "function");
  assert.equal(typeof preloadApi.reportP4EditResult, "function");
  assert.equal(preloadApi.openSvgaFile().channel, hostContract.IPC_CHANNELS.openSvgaFile);
  assert.equal(preloadApi.openReferenceMediaFile().channel, hostContract.IPC_CHANNELS.openReferenceMediaFile);
  assert.equal(preloadApi.getRecentSvgaFiles().channel, hostContract.IPC_CHANNELS.getRecentSvgaFiles);
  assert.equal(preloadApi.openRecentSvgaFile("recent-id").channel, hostContract.IPC_CHANNELS.openRecentSvgaFile);
  assert.equal(preloadApi.clearRecentSvgaFiles().channel, hostContract.IPC_CHANNELS.clearRecentSvgaFiles);
  assert.equal(preloadApi.scanLatestArtifacts().channel, hostContract.IPC_CHANNELS.scanLatestArtifacts);
  assert.equal(preloadApi.writeClipboardText("logs").channel, hostContract.IPC_CHANNELS.writeClipboardText);
  assert.equal(preloadApi.updateShortTermMenuState({ hasFile: true }).channel, hostContract.IPC_CHANNELS.updateShortTermMenuState);
  assert.equal(preloadApi.saveEditedSvga({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveEditedSvga);
  assert.equal(preloadApi.saveOptimizedSvga({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveOptimizedSvga);
  assert.equal(productPreloadApi.updateShortTermMenuState({ hasFile: true }).channel, hostContract.IPC_CHANNELS.updateShortTermMenuState);
  assert.equal(productPreloadApi.saveShortTermSvgaOutput({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveShortTermSvgaOutput);
  assert.equal(hostContract.IPC_CHANNELS.saveOptimizedSvga, "svga-web-experiment:save-optimized-svga");
  assert.equal(invocations.length, 10);
  assert.equal(shortTermInvocations.length, 2);
  assert.equal(hostContract.ELECTRON_HOST_BRIDGE_NAME, "autoSvgaElectronHost");
  assert.equal(hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME, "autoSvgaPrototype");
  assert.match(preload, /createProductPreloadApi/);
  assert.match(preload, /createLegacyPrototypePreloadApi/);
  assert.match(hostContractSource, /createProductPreloadApi/);
  assert.match(hostContractSource, /createLegacyPrototypePreloadApi/);
  const hostOpenReturn = main.match(/function openSvgaFileBytes[\s\S]*?\n}\n\nasync function openSvgaFile/)?.[0] ?? "";
  const referenceOpenReturn = main.match(/function openReferenceMediaFileBytes[\s\S]*?\n}\n\nasync function openSvgaFile/)?.[0] ?? "";
  assert.match(main, /createSecureWebPreferences/);
  assert.match(main, /isAllowedHostUrl/);
  assert.match(main, /isExpectedSenderUrl/);
  assert.match(main, /productSmokeMode/);
  assert.match(main, /captureProductArtifact/);
  assert.match(main, /function validateOptimizedSvgaSaveInput/);
  assert.match(main, /function validateOptimizationReportBinding/);
  assert.match(main, /function validateOptimizedReopenProof/);
  assert.match(main, /function validateSequenceReviewProof/);
  assert.match(main, /function validateSequenceRepairPreviewProof/);
  assert.match(main, /function validateSequenceNoWriteSimulationProof/);
  assert.match(main, /function validateSequenceBoundedRepairPrototypeProof/);
  assert.match(main, /function validateSequencePrototypeRenderedBoundaryProof/);
  assert.match(main, /function validateSequenceNoopRoundTripProof/);
  assert.match(main, /validateSequenceByteRepairProof/);
  assert.match(main, /function validateReplacementReadinessProof/);
  assert.match(main, /function validateReplacementPreviewProof/);
  assert.match(main, /function validateReplacementUndoRedoProof/);
  assert.match(main, /function validateReplacementResetProof/);
  assert.match(main, /function validateReplacementMultiResourceProof/);
  assert.match(main, /function validateReplacementSaveAsProof/);
  assert.match(main, /function saveOptimizedSvga/);
  assert.match(main, /optimizedReopenProof/);
  assert.match(main, /sequenceReviewProof/);
  assert.match(main, /sequenceRepairPreviewProof/);
  assert.match(main, /sequenceNoWriteSimulationProof/);
  assert.match(main, /sequenceBoundedRepairPrototypeProof/);
  assert.match(main, /sequencePrototypeRenderedBoundaryProof/);
  assert.match(main, /sequenceNoopRoundTripProof/);
  assert.match(main, /sequenceByteRepairProof/);
  assert.match(main, /replacementReadinessProof/);
  assert.match(main, /replacementPreviewProof/);
  assert.match(main, /replacementUndoRedoProof/);
  assert.match(main, /replacementResetProof/);
  assert.match(main, /replacementSaveAsProof/);
  assert.match(main, /replacementMultiResourceProof/);
  assert.match(main, /Optimized Save As requires the source SVGA to be opened through the desktop file picker/);
  assert.match(desktopEntry, /\/api\/svga-image-optimize/);
  assert.match(desktopEntry, /\/api\/svga-image-edit-session/);
  assert.match(desktopEntry, /\/api\/svga-image-replace/);
  assert.match(productApp, /runReplacementReadinessProof/);
  assert.match(productApp, /runSequenceReviewProof/);
  assert.match(productApp, /runSequenceRepairPreviewContractProof/);
  assert.match(productApp, /runSequenceNoWriteSimulationProof/);
  assert.match(productApp, /runSequenceBoundedRepairPrototypeProof/);
  assert.match(productApp, /runSequencePrototypeRenderedBoundaryProof/);
  assert.match(productApp, /runSequenceNoopRoundTripProof/);
  assert.match(productApp, /runSequenceByteRepairCandidateProof/);
  assert.match(productApp, /runSingleReplacementPreviewProof/);
  assert.match(productApp, /runReplacementUndoRedoProof/);
  assert.match(productApp, /runMultiReplacementWorkbenchProof/);
  assert.match(productApp, /runReplacementSaveAsProof/);
  assert.match(productApp, /data-save-optimized-svga/);
  assert.match(productApp, /saveOptimizedPrimarySvga/);
  assert.match(productApp, /autoSvgaSourceId/);
  assert.match(main, /desktop-sequence-review-proof/);
  assert.match(main, /desktop-sequence-repair-preview-proof/);
  assert.match(main, /desktop-sequence-no-write-simulation-proof/);
  assert.match(main, /desktop-sequence-bounded-repair-prototype-proof/);
  assert.match(main, /desktop-sequence-prototype-rendered-boundary-proof/);
  assert.match(main, /desktop-sequence-noop-round-trip-proof/);
  assert.match(main, /desktop-multi-replacement-proof/);
  assert.match(prepareRuntime, /optimizer-reopen-smoke\.svga/);
  assert.match(prepareRuntime, /replaceable-workflow-smoke\.svga/);
  assert.match(prepareRuntime, /replacement-preview-green\.png/);
  assert.match(prepareRuntime, /profile_frame/);
  assert.match(main, /validateArtifactScenario/);
  assert.match(main, /validateP6InteractionTrace/);
  assert.match(main, /\["Escape", "Space", "Enter", "Tab"\]/);
  assert.match(main, /node\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(main, /Product smoke keyboard target is not actionable/);
  assert.match(main, /function validateSmokeDiagnostics/);
  assert.match(main, /function validateOwnerUsabilityResult/);
  assert.match(main, /function validatePreviewCardConsistency/);
  assert.match(main, /function validatePreviewCardZoneSnapshot/);
  assert.match(main, /fileNameInTitle/);
  assert.match(main, /duplicateFilePillHidden/);
  assert.doesNotMatch(main, /filePillVisible/);
  assert.match(main, /owner-usability-smoke\.json/);
  assert.match(main, /finderDocumentAssociationNotClaimed/);
  assert.match(main, /clearCurrentFileAction/);
  assert.match(main, /enterActivatesResourceTab/);
  assert.match(main, /previewCardSingleFileConsistency/);
  assert.match(main, /diagnostics = validateSmokeDiagnostics\(value\.diagnostics\)/);
  assert.match(main, /ownerUsability = validateOwnerUsabilityResult\(value\.ownerUsability\)/);
  assert.match(main, /logPayload\.diagnostics = diagnostics/);
  assert.match(main, /desktop-interaction-trace\.source\.json/);
  assert.match(main, /p6InteractionTrace: Boolean\(p6InteractionTrace\)/);
  assert.match(main, /const productIdentity = "auto-svga"/);
  assert.match(main, /runtimeIdentity/);
  assert.match(main, /normalSmokeParity/);
  assert.match(main, /runtime-identity\.json/);
  assert.match(main, /normal-smoke-parity\.json/);
  assert.match(main, /normal-runtime-proof\.json/);
  assert.match(main, /desktop-loaded/);
  assert.match(main, /actual-normal-loaded/);
  const normalProofStart = main.indexOf("async function driveCanonicalNormalProof");
  assert.ok(normalProofStart >= 0, "normal proof driver must exist");
  const normalProofSource = main.slice(normalProofStart);
  assert.match(normalProofSource, /__autoSvgaShortTermActions/);
  assert.match(normalProofSource, /openFromHostDialog/);
  assert.match(normalProofSource, /findApplicationMenuItem\(\["文件", "打开 SVGA\.\.\."\]\)/);
  assert.match(normalProofSource, /openMenuItem\.click\(openMenuItem, window\)/);
  assert.match(normalProofSource, /menuOpen: false/);
  assert.match(normalProofSource, /result\.menuOpen = menuOpen/);
  assert.match(normalProofSource, /#primaryCanvas/);
  assert.match(normalProofSource, /#factGrid/);
  assert.match(normalProofSource, /#assetList/);
  assert.match(normalProofSource, /getRecentSvgaFiles/);
  assert.match(normalProofSource, /recentFiles/);
  assert.match(normalProofSource, /recentMissingRecovery/);
  assert.match(normalProofSource, /short-term-recent-proof/);
  assert.match(normalProofSource, /menuRecordLimit: 10/);
  assert.match(normalProofSource, /launchRecordLimit: 5/);
  assert.match(normalProofSource, /clearHistoryCompleted/);
  assert.match(normalProofSource, /launchEmptyAfterClear/);
  assert.match(normalProofSource, /missing-normal-proof\.svga/);
  assert.match(normalProofSource, /openRecentFromMenu/);
  assert.match(normalProofSource, /missingRecordRemoved/);
  assert.match(normalProofSource, /missingFeedbackVisible/);
  assert.match(normalProofSource, /short-term-save-proof/);
  assert.match(normalProofSource, /produceRenameOutput/);
  assert.match(normalProofSource, /actions\.createSaveProofOutput/);
  assert.match(normalProofSource, /actions\.saveAs\(\)/);
  assert.match(normalProofSource, /actions\.save\(\)/);
  assert.match(normalProofSource, /firstOutputSaveEnabled/);
  assert.match(normalProofSource, /overwriteReopenValidated/);
  assert.match(normalProofSource, /canonicalFixtureSha256Before/);
  assert.match(normalProofSource, /canonicalSourceUnchanged/);
  assert.match(normalProofSource, /result\.shortTermSave = result\.shortTermSaveProof\.passed === true/);
  assert.match(normalProofSource, /pathRedacted/);
  assert.ok(
    normalProofSource.indexOf("await actions.closeFile()") < normalProofSource.indexOf("await actions.clearRecentFiles()"),
    "normal proof must inspect launch recent rows before clearing history"
  );
  assert.ok(
    normalProofSource.indexOf("openMenuItem.click(openMenuItem, window)") < normalProofSource.indexOf("const result = await window.webContents.executeJavaScript"),
    "normal proof initial open must be triggered by the macOS File menu before renderer validation"
  );
  assert.ok(
    normalProofSource.indexOf("await actions.openRecentFromMenu(missingRecord.id)") < normalProofSource.indexOf("await actions.openFromHostDialog()"),
    "direct host open action is allowed only after missing-recent recovery starts"
  );
  assert.doesNotMatch(normalProofSource, /#svgaFileInput|#svgaStatusA|#svgaCanvasA|specReportSection|auditReportSection/);
  assert.match(main, /writeJsonProductArtifact\("short-term-recent-proof\.json", "short-term-recent-proof"/);
  assert.match(main, /writeJsonProductArtifact\("short-term-save-proof\.json", "short-term-save-proof"/);
  assert.match(main, /normalProofMode \? "short-term-normal-save-as\.svga" : "short-term-smoke-save-as\.svga"/);
  assert.match(main, /IPC_CHANNELS\.openSvgaFile/);
  assert.match(main, /IPC_CHANNELS\.openReferenceMediaFile/);
  assert.match(main, /IPC_CHANNELS\.scanLatestArtifacts/);
  assert.match(main, /IPC_CHANNELS\.writeClipboardText/);
  assert.match(main, /clipboard\.writeText/);
  assert.match(main, /Invalid clipboard text payload/);
  assert.match(main, /desktopArtifacts\.scan\(\)/);
  assert.match(main, /createDesktopArtifactCatalog/);
  assert.match(main, /installApplicationMenu/);
  assert.match(main, /label: "文件"/);
  assert.match(main, /label: "编辑"/);
  assert.match(main, /label: "资源"/);
  assert.match(main, /label: "优化"/);
  assert.match(main, /label: "播放"/);
  assert.match(main, /label: "视图"/);
  assert.match(main, /label: "窗口"/);
  assert.match(main, /label: "帮助"/);
  assert.match(main, /打开 SVGA\.\.\./);
  assert.match(main, /打开对比 SVGA\.\.\./);
  assert.match(main, /打开参考媒体\.\.\./);
  assert.match(main, /另存替换副本\.\.\./);
  assert.match(main, /生成优化副本\.\.\./);
  assert.doesNotMatch(main, /label: "序列"/);
  assert.doesNotMatch(main, /修复闪帧并另存\.\.\./);
  assert.doesNotMatch(main, /加载最新导出产物/);
  assert.doesNotMatch(main, /本地预览/);
  assert.doesNotMatch(main, /导出验收/);
  assert.match(main, /撤销替换预览/);
  assert.match(main, /重做替换预览/);
  assert.match(main, /重置替换预览/);
  assert.match(main, /role: "copy"/);
  assert.match(main, /role: "paste"/);
  assert.match(main, /role: "selectAll"/);
  assert.match(main, /显示资源列表/);
  assert.match(main, /替换选中资源\.\.\./);
  assert.match(main, /复制当前资源 Key/);
  assert.match(main, /活动记录/);
  assert.match(main, /设置/);
  assert.match(main, /退出 Auto SVGA/);
  assert.match(main, /invokeWorkbenchAction\("replaceSelectedResource"\)/);
  assert.match(main, /invokeWorkbenchAction\("saveOptimizedCopy"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("saveSequenceRepairCopy"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("loadLatestExportArtifact"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("setLocalPreviewMode"\)/);
  assert.doesNotMatch(main, /invokeWorkbenchAction\("setExportReviewMode"\)/);
  assert.match(main, /invokeWorkbenchAction\("toggleLogs"\)/);
  assert.match(main, /invokeWorkbenchActionAsync\("prepareSecondaryOpen"\)/);
  assert.match(main, /invokeWorkbenchActionAsync\("prepareReferenceOpen"\)/);
  assert.match(main, /openSvgaFromHostMenu/);
  assert.match(main, /openReferenceMediaFileBytes/);
  assert.match(main, /referenceMediaTypes/);
  assert.match(main, /referenceFileIds/);
  assert.match(referenceOpenReturn, /rememberReferenceFile/);
  assert.doesNotMatch(referenceOpenReturn, /sourceFilePaths/);
  assert.match(hostOpenReturn, /openSvgaFileBytes/);
  assert.match(hostOpenReturn, /basename: path\.basename\(filePath\)/);
  assert.match(hostOpenReturn, /hash: createHash\("sha256"\)/);
  assert.match(hostOpenReturn, /bytes: new Uint8Array\(bytes\)/);
  assert.doesNotMatch(hostOpenReturn, /fileName|sizeBytes|targetPath|targetPathRedacted|absolutePath|sha256:|bytesBase64/);
  assert.match(main, /IPC_CHANNELS\.saveEditedSvga/);
  assert.match(main, /IPC_CHANNELS\.p3EditResult/);
  assert.match(main, /sourceFilePaths/);
  assert.match(main, /fsyncSync/);
  assert.match(main, /actualLaunchCommand/);
  assert.match(main, /actualArgvSanitized/);
  assert.match(main, /pathRedactionsApplied/);
  assert.match(main, /normalVisibleStartupMode/);
  assert.match(main, /normalVisibleStartup/);
  assert.match(main, /finderEquivalentLaunchCompatible/);
  assert.match(main, /fileOpenTargets: \["primary-svga", "secondary-svga", "reference-media"\]/);
  assert.match(main, /const hostMenuActions = Object\.freeze/);
  assert.match(main, /"copy"/);
  assert.match(main, /"select-all"/);
  assert.match(main, /menuActions: hostMenuActions/);
  assert.match(main, /blockedExternalRequests/);
  assert.match(main, /writeVisibleNormalStartupProof/);
  assert.match(main, /normal-visible-startup\.json/);
	  assert.match(main, /windowShown: window\.isVisible\(\)/);
	  assert.match(main, /minimumSupported:\s*\{\s*width:\s*1180,\s*height:\s*760\s*\}/);
	  assert.match(main, /legacyStressViewport:\s*\{\s*width:\s*900,\s*height:\s*720\s*\}/);
	  assert.match(main, /scenario === "desktop-1440x900"\) window\.setContentSize\(macosWorkbenchWindowSizing\.defaultLaunch\.width, macosWorkbenchWindowSizing\.defaultLaunch\.height\)/);
	  assert.match(main, /scenario === "desktop-1280x800"\) window\.setContentSize\(macosWorkbenchWindowSizing\.comfortable\.width, macosWorkbenchWindowSizing\.comfortable\.height\)/);
	  assert.match(main, /minWidth:\s*macosWorkbenchWindowSizing\.minimumSupported\.width/);
	  assert.match(main, /minHeight:\s*macosWorkbenchWindowSizing\.minimumSupported\.height/);
	  assert.match(main, /environmentOverrides: \{\}/);
  assert.match(main, /rendererQuery: rendererProbe\.rendererQuery/);
  assert.match(main, /noProofMode: true/);
  assert.match(main, /noSmokeMode: true/);
  assert.match(main, /noProofArguments/);
  assert.match(main, /orphanProcessPolicy/);
  assert.match(main, /AUTO_SVGA_RUNTIME_CLEANUP/);
  assert.match(main, /AUTO_SVGA_SMOKE_RESULT_REJECTED/);
  assert.match(main, /describeP6InteractionTraceValidationFailure/);
  assert.match(main, /sessionRootRedacted: sanitizeRuntimeArgument\(sessionRoot\)/);
  assert.match(main, /tempRemoved: true/);
  assert.doesNotMatch(main, /actualArgv:\s*process\.argv/);
  assert.match(main, /driveCanonicalNormalProof/);
  assert.match(main, /window\.autoSvgaElectronHost/);
  assert.match(main, /__autoSvgaShortTermActions/);
  assert.match(main, /openFromHostDialog/);
  assert.match(main, /#primaryCanvas/);
  assert.match(main, /#factGrid/);
  assert.doesNotMatch(main, /fetch\("\/fixture\/avatar-frame-smoke\.svga"\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /will-navigate/);
  assert.match(main, /webRequest\.onBeforeRequest/);
  assert.match(preload, /ELECTRON_HOST_BRIDGE_NAME/);
  assert.match(preload, /LEGACY_PROTOTYPE_BRIDGE_NAME/);
  assert.match(preload, /scanLatestArtifacts/);
  assert.match(preload, /openReferenceMediaFile/);
  assert.match(preload, /hostAdapterVersion:\s*1/);
  assert.match(preload, /arbitraryFileSystemAccess:\s*false/);
  assert.match(preload, /referenceMediaOpen:\s*"host-dialog-mp4-webm-gif-only"/);
  assert.doesNotMatch(preload, /require\(["']\.\/host-adapter-contract\.cjs["']\)/);
  assert.doesNotMatch(preload, /\bdialog\s*[\s,:})]|shell\.|openPath|readFile/);
  assert.doesNotMatch(preload, /require\("node:fs"\)|require\("fs"\)/);
  assert.match(productApp, /function createP6SmokeFailureDiagnostics/);
  assert.match(productApp, /diagnostics: createP6SmokeFailureDiagnostics\(error\)/);
  assert.match(productApp, /currentActionId: p6SmokeCurrentActionId/);
  assert.match(productApp, /sanitizeP6SmokeDiagnostic/);
  assert.match(productApp, /function p6BoundedSmokeText/);
  assert.match(productApp, /visibleResultText: p6BoundedSmokeText\(proof\.renderedText\)/);
  assert.doesNotMatch(productApp, /stack: error\.stack|error\.stack/);
});

test("desktop latest-artifact catalog returns Web-shaped non-empty and safe-empty results without path leaks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auto-svga-desktop-artifacts-"));
  try {
    const output = path.join(root, "examples/avatar_frame_basic/output");
    await mkdir(output, { recursive: true });
    const svgaBytes = Uint8Array.from([120, 156, 3, 0]);
    await writeFile(path.join(output, "avatar_frame_basic.svga"), svgaBytes);
    await writeFile(path.join(output, "report.json"), JSON.stringify({ ok: true }));
    await writeFile(path.join(output, "preview.webm"), Uint8Array.from([1, 2, 3]));
    const exports = path.join(root, "exports");
    await mkdir(exports, { recursive: true });
    await writeFile(path.join(exports, "invalid-fixture.svga"), Uint8Array.from([0, 1, 2, 3]));
    const catalog = createDesktopArtifactCatalog({
      groupedRoots: [{ rootPath: path.join(root, "examples"), kind: "example" }],
      standaloneRoots: [{ rootPath: path.join(root, "exports"), jobId: "exports" }]
    });
    const result = await catalog.scan();
    assert.equal(result.latestWithSvga?.jobId, "example:avatar_frame_basic");
    assert.match(result.latestWithSvga.svgaPath, /^\/desktop-artifact\/[a-f0-9]{24}\/avatar_frame_basic\.svga$/);
    assert.match(result.latestWithSvga.reportPath, /^\/desktop-artifact\/[a-f0-9]{24}\/report\.json$/);
    assert.match(result.latestWithSvga.webmPath, /^\/desktop-artifact\/[a-f0-9]{24}\/preview\.webm$/);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const artifact = await catalog.readArtifact(result.latestWithSvga.svgaPath);
    assert.equal(Buffer.compare(Buffer.from(artifact.bytes), Buffer.from(svgaBytes)), 0);
    assert.equal(artifact.mimeType, "application/octet-stream");
    assert.equal(
      await catalog.readArtifact(result.latestWithSvga.svgaPath.replace("avatar_frame_basic.svga", "renamed.svga")),
      undefined
    );

    const emptyCatalog = createDesktopArtifactCatalog({
      groupedRoots: [{ rootPath: path.join(root, "missing"), kind: "example" }]
    });
    const empty = await emptyCatalog.scan();
    assert.equal(empty.latestWithSvga, null);
    assert.equal(empty.latestAny, null);
    assert.deepEqual(empty.artifacts, []);
    assert.match(empty.warnings.join(" "), /未扫描到可用的本地产物/);
    assert.equal(await emptyCatalog.readArtifact("/desktop-artifact/000000000000000000000000/test.svga"), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("P6 normal App proof launches without smoke query mode and uses Web baseline fixture bytes", async () => {
  const runner = await readFile(path.join(experimentRoot, "scripts/run-canonical-normal-proof.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const prototype = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const p2Fixture = await readFile(path.join(experimentRoot, "scripts/p2-fixture.mjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const p6Evidence = await readFile(path.join(repoRoot, "tools/p6/generate-p6-evidence.mjs"), "utf8");
  const p6ParityRunner = await readFile(path.join(repoRoot, "tools/p6/parity-runner.mjs"), "utf8");

  assert.match(runner, /AUTO_SVGA_P2_NORMAL_PROOF/);
  assert.match(runner, /npm", \["run", "desktop:dev"\]/);
  assert.doesNotMatch(runner, /--smoke|--product-smoke|--p2-normal-proof|\?mode=smoke/);
  assert.match(main, /show:\s*false/);
  assert.match(main, /window\.showInactive\(\)/);
  assert.match(main, /writeVisibleNormalStartupProof\(window, rendererUrl\)/);
  assert.match(main, /runtimeIdentity\("normal-visible", rendererUrl\)/);
  assert.match(main, /actualLaunchCommand: normalIdentity\.actualLaunchCommand/);
  assert.match(main, /windowShown: window\.isVisible\(\)/);
  assert.match(main, /normalVisibleStartup: true/);
  assert.match(main, /environmentOverrides: \{\}/);
  assert.match(main, /rendererQuery: rendererProbe\.rendererQuery/);
  assert.match(main, /externalRequests: \[\.\.\.new Set/);
  assert.match(main, /expectedExit: "window-all-closed -> cleanupRuntime -> app\.quit"/);
  assert.match(main, /const isCanvasNonBlank = \(\) =>/);
  assert.match(main, /const canvasStartedAt = performance\.now\(\)/);
  assert.match(main, /const width = context\.canvas\.width/);
  assert.doesNotMatch(main, /Math\.min\(300, context\.canvas\.width\)/);
  assert.match(main, /normalProofMode\s*\?\s*""/);
  assert.match(main, /rendererQuery: location\.search/);
  assert.match(main, /window\.autoSvgaElectronHost/);
  assert.match(main, /__autoSvgaShortTermActions/);
  assert.match(main, /openFromHostDialog/);
  assert.match(main, /fileOpenMechanism: "macOS File > Open SVGA menu item -> short-term host dialog IPC"/);
  assert.match(main, /document\.querySelector\("#primaryCanvas"\)/);
  assert.match(main, /document\.querySelector\("#factGrid"\)/);
  assert.match(main, /document\.querySelector\("#assetList"\)/);
  assert.match(main, /menuOpen: value\.menuOpen/);
  assert.match(main, /recentFiles: value\.recentFiles/);
  assert.match(main, /recentMissingRecovery: value\.recentMissingRecovery/);
  assert.match(main, /shortTermRecentProof/);
  assert.match(main, /shortTermSave: value\.shortTermSave/);
  assert.match(main, /function validateShortTermNormalRecentProof/);
  assert.match(main, /function validateShortTermNormalSaveProof/);
  assert.match(main, /saveAsSavedSha256 !== value\.overwriteSavedSha256|value\.saveAsSavedSha256 === value\.overwriteSavedSha256/);
  assert.match(main, /short-term-normal-save-as\.svga/);
  assert.match(main, /host\.getRecentSvgaFiles/);
  const normalProofSource = main.slice(main.indexOf("async function driveCanonicalNormalProof"));
  assert.doesNotMatch(normalProofSource, /document\.querySelector\("#svgaFileInput"\)/);
  assert.match(prototype, /p6BaselineFixtureDisplayName = "p6-web-baseline-fixture\.svga"/);
  assert.match(prototype, /loadSvgaBytes\(bytes\.slice\(0\), p6BaselineFixtureDisplayName/);
  assert.match(prototype, /name === p6BaselineFixtureDisplayName/);
  for (const scenario of [
    "desktop-playing",
    "desktop-paused",
    "desktop-latest-artifact-loaded",
    "desktop-reference-media-loaded",
    "desktop-local-info-diagnostics-open",
    "desktop-local-source-resources-open",
    "desktop-local-source-layers-open",
    "desktop-local-inspector-actions-open",
    "desktop-local-logs-hidden-default",
    "desktop-local-minimum-size",
    "desktop-recovered-from-invalid"
  ]) {
    assert.match(main, new RegExp(scenario));
  }
  assert.match(prepareRuntime, /examples\/avatar_frame_basic\/output\/avatar_frame_basic\.svga/);
  assert.match(prepareRuntime, /"node", \["dist\/cli\.js", "export", "examples\/avatar_frame_basic"\]/);
  assert.match(p2Fixture, /repository-avatar-frame-basic\.svga/);
  assert.doesNotMatch(p2Fixture, /synthetic-avatar-frame\.svga/);
  assert.match(p6Evidence, /Auto SVGA-darwin-arm64\/Auto SVGA\.app\/Contents\/MacOS\/Auto SVGA/);
  assert.match(p6Evidence, /normal-visible-startup\.json/);
  assert.match(p6Evidence, /normalVisibleStartup/);
  assert.match(p6Evidence, /delete normalLaunchEnv\.AUTO_SVGA_P2_NORMAL_PROOF/);
  assert.doesNotMatch(p6Evidence, /AUTO_SVGA_P2_NORMAL_PROOF:\s*"1"/);
  assert.doesNotMatch(p6Evidence, /AUTO_SVGA_DESKTOP_NORMAL_PROOF/);
  assert.match(p6Evidence, /packaged Auto SVGA\.app/);
  assert.match(p6Evidence, /buildP6ParityReportFromRuntimeFacts/);
  assert.match(p6Evidence, /assertLocalPreviewWorkbenchRegionMap/);
  assert.match(p6Evidence, /layoutIntegrity/);
  assert.match(main, /requiredLayoutChecks/);
  assert.match(main, /coreRegionsInsideViewport/);
  assert.match(main, /sourceDocumentNotToolbar/);
  assert.match(main, /noResourceActionCollision/);
  assert.match(main, /noVerticalFilterWrapping/);
  assert.match(main, /mode-not-local-preview/);
  assert.match(main, /workflowPrimary !== "local_preview_first"/);
  assert.match(productApp, /workflowPrimary:\s*localPreviewPrimary \? "local_preview_first"/);
  assert.match(productApp, /collectWorkbenchLayoutIntegrity/);
  assert.match(productApp, /region_out_of_viewport/);
  assert.match(productApp, /coreRegionsInsideViewport/);
  assert.match(productApp, /source_document_maps_toolbar_instead_of_left_panel/);
  assert.match(productApp, /resource_action_collision/);
  assert.match(productApp, /resource_filter_vertical_wrap/);
  assert.match(p6ParityRunner, /function webFragmentsForItem/);
  assert.match(p6ParityRunner, /function desktopFragmentsForItem/);
  assert.match(p6ParityRunner, /function comparisonFragmentsForItem/);
  assert.doesNotMatch(p6Evidence, /webDesktopIds/);
  assert.doesNotMatch(p6ParityRunner, /webDesktopIds/);
  assert.doesNotMatch(p6Evidence, /AutoSVGAInternalPrototype|--product-smoke"\]|--smoke", "--product-smoke"/);
});

test("default Electron renderer is the short-term macOS client and keeps legacy Workbench isolated", async () => {
  const shortTermEntry = await readFile(path.join(experimentRoot, "web/short-term-macos-app.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const shortTermTokens = await readFile(path.join(experimentRoot, "web/short-term-macos.tokens.css"), "utf8");
  const shortTermAtoms = await readFile(path.join(experimentRoot, "web/short-term-macos.atoms.css"), "utf8");
  const shortTermMolecules = await readFile(path.join(experimentRoot, "web/short-term-macos.molecules.css"), "utf8");
  const shortTermComponents = await readFile(path.join(experimentRoot, "web/short-term-macos.components.css"), "utf8");
  const shortTermModules = await readFile(path.join(experimentRoot, "web/short-term-macos.modules.css"), "utf8");
  const shortTermPageStates = await readFile(path.join(experimentRoot, "web/short-term-macos.page-states.css"), "utf8");
  const shortTermStyles = await readFile(path.join(experimentRoot, "web/short-term-macos.css"), "utf8");
  const shortTermCommandState = await readFile(path.join(experimentRoot, "web/short-term-macos-command-state.mjs"), "utf8");
  const shortTermDomRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-dom-renderers.mjs"), "utf8");
  const shortTermDomState = await readFile(path.join(experimentRoot, "web/short-term-macos-dom-state.mjs"), "utf8");
  const shortTermFeedbackModel = await readFile(path.join(experimentRoot, "web/short-term-macos-feedback-model.mjs"), "utf8");
  const shortTermRenderModel = await readFile(path.join(experimentRoot, "web/short-term-macos-render-model.mjs"), "utf8");
  const workbenchPage = await readFile(path.join(experimentRoot, "web/workbench.html"), "utf8");
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const prototypeRenderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const sharedShell = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-shell.html"), "utf8");
  assert.match(page, /<title>Auto SVGA<\/title>/);
  assert.match(main, /productDisplayName = "Auto SVGA"/);
  assert.match(main, /app\.setName\(productDisplayName\)/);
  assert.match(page, /data-app-state="launch"/);
  assert.match(page, /data-view="preview"/);
  assert.match(page, /data-panel="overview"/);
  assert.match(page, /data-panel="optimization"/);
  assert.match(page, /data-panel="replaceable"/);
  assert.match(page, /role="tablist" aria-orientation="horizontal"/);
  assert.match(page, /id="tabOverview" data-tab="overview" data-component="TabItem" role="tab" aria-selected="true" aria-controls="panelOverview" tabindex="0"/);
  assert.match(page, /id="tabOptimization" data-tab="optimization" data-component="TabItem" role="tab" aria-selected="false" aria-controls="panelOptimization" tabindex="-1"/);
  assert.match(page, /id="tabReplaceable" data-tab="replaceable" data-component="TabItem" role="tab" aria-selected="false" aria-controls="panelReplaceable" tabindex="-1"/);
  assert.match(page, /short-term-macos\.css/);
  assert.match(page, /short-term-macos\.atoms\.css/);
  assert.match(page, /short-term-macos\.molecules\.css/);
  assert.match(page, /short-term-macos\.components\.css/);
  assert.match(page, /short-term-macos\.modules\.css/);
  assert.match(page, /short-term-macos\.page-states\.css/);
  assert.match(page, /short-term-macos-app\.mjs/);
  assert.match(page, /data-module="GeneralCompareModule"/);
  assert.match(page, /data-component="ComparePreviewCard"/);
  assert.match(page, /data-compare-label="A"/);
  assert.match(page, /data-compare-label="B"/);
  assert.match(page, /id="compareCanvasTitleA"/);
  assert.match(page, /id="compareCanvasMetaB"/);
  assert.match(page, /data-canvas-label="预览"/);
  assert.match(page, /class="playbackActions" data-component="PlaybackButtonGroup"/);
  assert.match(page, /class="playbackMeta" id="playbackMeta" aria-live="polite" data-component="InlineStatus"/);
  assert.match(page, /最近打开/);
  assert.match(page, /覆盖保存/);
  assert.match(page, /id="discardDialog"/);
  assert.match(page, /id="textDialog" data-component="TextReplacementSheet" data-status="info"/);
  assert.match(page, /id="discardDialog" data-component="ErrorRecoveryPanel" data-status="warning"/);
  assert.match(page, /class="dialogActions"/);
  assert.match(page, /id="resourceContextMenu"/);
  assert.match(page, /放弃未保存输出/);
  assert.match(page, /id="textPreviewSummary"/);
  assert.match(page, /id="textElementList"/);
  assert.match(page, /data-action="edit-text" disabled/);
  assert.match(page, /class="textPreviewBlock" aria-labelledby="textPreviewHeading" aria-describedby="textPreviewSummary"/);
  assert.match(page, /class="textPreviewActions"/);
  assert.match(page, /data-component="WindowToolbar"/);
  assert.match(page, /class="toolbarCluster toolbarClusterPrimary"/);
  assert.match(page, /data-component="SegmentedModeSwitch"/);
  assert.match(page, /class="toolbarCluster toolbarClusterSave" data-component="SaveButtonPair"/);
  assert.match(page, /data-component="ReservedOperationPanel"/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected="true"/);
  assert.match(page, /id="panelOverview" data-panel="overview" role="tabpanel" tabindex="0" aria-labelledby="tabOverview"/);
  assert.doesNotMatch(page, /id="overviewSummary"/);
  assert.doesNotMatch(page, /id="assetSummary"/);
  assert.match(page, /id="panelOptimization" data-panel="optimization" role="tabpanel" tabindex="0" aria-labelledby="tabOptimization"/);
  assert.match(page, /id="panelReplaceable" data-panel="replaceable" role="tabpanel" tabindex="0" aria-labelledby="tabReplaceable"/);
  assert.match(page, /id="replaceableList" role="listbox" aria-label="可替换图片"/);
  assert.match(page, /id="textElementList" role="listbox" aria-label="运行时文本"/);
  assert.match(page, /short-term-macos\.tokens\.css/);
  assert.doesNotMatch(page, /id="compareFileInput"/);
  assert.doesNotMatch(page, /id="renameDialog"|id="renameInput"|id="renameHint"/);
  assert.match(page, /短期版仅保留图层查看/);
  assert.doesNotMatch(page, /productShellMount|desktop-product-entry\.mjs|prototype\.js/);
  assert.doesNotMatch(page, /导出验收|序列修复|批量 PNG|Export Acceptance/);
  assert.doesNotMatch(page, /brandMark/);
  assert.match(shortTermTokens, /--asv-window/);
  assert.match(shortTermTokens, /--asv-color-window/);
  assert.match(shortTermTokens, /--asv-color-surface-window/);
  assert.match(shortTermTokens, /--asv-color-surface-workbench/);
  assert.match(shortTermTokens, /--asv-color-surface-control/);
  assert.match(shortTermTokens, /--asv-color-surface-row-selected/);
  assert.match(shortTermTokens, /--asv-panel-border/);
  assert.match(shortTermTokens, /--asv-shadow-panel-highlight/);
  assert.match(shortTermTokens, /--asv-component-toolbar-height/);
  assert.match(shortTermTokens, /--asv-component-launch-content-width/);
  assert.match(shortTermTokens, /--asv-launch-recent-row-height/);
  assert.match(shortTermTokens, /--asv-component-preview-gap/);
  assert.match(shortTermTokens, /--asv-component-compare-canvas-header-height/);
  assert.match(shortTermTokens, /--asv-compare-metric-row-min-height/);
  assert.match(shortTermTokens, /--asv-playback-bar-height/);
  assert.match(shortTermTokens, /--asv-component-status-strip-width/);
  assert.match(shortTermTokens, /--asv-component-row-index-width/);
  assert.match(shortTermTokens, /--asv-status-strip-width/);
  assert.match(shortTermTokens, /--asv-row-index-width/);
  assert.match(shortTermTokens, /--asv-focus-inset/);
  assert.match(shortTermTokens, /prefers-color-scheme: dark/);
  assert.match(shortTermTokens, /@media \(max-height: 780px\)/);
  assert.match(shortTermEntry, /clearRecentButton/);
  assert.match(shortTermEntry, /disabled = visible\.length === 0/);
  assert.match(shortTermAtoms, /button\.primary:disabled/);
  assert.match(shortTermAtoms, /\.spinner/);
  assert.match(shortTermAtoms, /\.thumb\.sequence/);
  assert.match(shortTermAtoms, /\.rowIndex/);
  assert.match(shortTermAtoms, /\.badge/);
  assert.match(shortTermAtoms, /:focus-visible/);
  assert.match(shortTermMolecules, /\.toolbarButton/);
  assert.match(shortTermMolecules, /\.modeSwitch/);
  assert.match(shortTermMolecules, /\.tabs/);
  assert.match(shortTermMolecules, /\.rowMenuButton/);
  assert.match(shortTermMolecules, /:focus-visible/);
  assert.doesNotMatch(shortTermComponents, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermComponents, /\.modeSwitch/);
  assert.doesNotMatch(shortTermComponents, /\.tabs/);
  assert.match(shortTermComponents, /\.factCell/);
  assert.match(shortTermComponents, /\.assetRow/);
  assert.match(shortTermComponents, /\.assetRow\[data-attention="true"\]/);
  assert.match(shortTermComponents, /\.messageRow/);
  assert.match(shortTermComponents, /\.messageRow\[data-status="success"\]/);
  assert.match(shortTermComponents, /\.reservedNotice/);
  assert.match(shortTermComponents, /\.stateCard\.error::before/);
  assert.match(shortTermComponents, /\.appDialog\[data-status="warning"\]::before/);
  assert.match(shortTermComponents, /\.dialogHeader/);
  assert.match(shortTermComponents, /\.dialogActions/);
  assert.match(shortTermComponents, /\.contextMenu button:disabled/);
  assert.match(shortTermModules, /\.toolbarCluster/);
  assert.match(shortTermModules, /grid-template-columns: var\(--asv-window-controls-width\) auto minmax\(160px, 1fr\) auto/);
  assert.match(shortTermModules, /\.resultGroup/);
  assert.match(shortTermModules, /\.tabPanel:focus-visible/);
  assert.match(shortTermModules, /\.saveBanner\[data-status="success"\]::before/);
  assert.match(shortTermModules, /\.saveBanner\[data-status="loading"\]::before/);
  assert.match(shortTermModules, /\.canvasWrap\[data-canvas-label\]::before/);
  assert.match(shortTermModules, /\.playbackActions/);
  assert.match(shortTermModules, /\.playbackMeta/);
  assert.match(shortTermModules, /\.textPreviewActions/);
  assert.match(shortTermModules, /\.compareCanvasHeader/);
  assert.match(shortTermModules, /\.compareMetricCell/);
  assert.match(shortTermModules, /\.compareSummary/);
  assert.match(shortTermModules, /\.compareMetricGrid/);
  assert.match(shortTermModules, /\.compareActions/);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="launch"\]/);
  assert.match(shortTermPageStates, /\.previewView/);
  assert.match(shortTermPageStates, /\.compareView/);
  assert.match(shortTermPageStates, /\.editView/);
  assert.match(shortTermPageStates, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shortTermPageStates, /@media \(max-height: 780px\)/);
  assert.match(shortTermStyles, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.doesNotMatch(shortTermStyles, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermStyles, /\.toolbarCluster|\.resultGroup|\.previewView|\.compareView/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-dom-renderers\.mjs"/);
  assert.match(shortTermEntry, /createOverviewFactCell/);
  assert.match(shortTermEntry, /createAssetRow/);
  assert.match(shortTermEntry, /createReplaceableImageRow/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-command-state\.mjs"/);
  assert.match(shortTermEntry, /buildCommandState/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-feedback-model\.mjs"/);
  assert.match(shortTermEntry, /bannerTone/);
  assert.match(shortTermEntry, /buildCurrentStateSummary/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-dom-state\.mjs"/);
  assert.match(shortTermEntry, /applyViewState/);
  assert.match(shortTermEntry, /applyModeButtons/);
  assert.match(shortTermEntry, /applyTabState/);
  assert.match(shortTermEntry, /setActionEnabled/);
  assert.match(shortTermCommandState, /export function buildCommandState/);
  assert.match(shortTermCommandState, /actionStates/);
  assert.match(shortTermCommandState, /"run-optimization": \{ enabled: canRunOptimization, reason: "没有可安全执行的优化项" \}/);
  assert.match(shortTermCommandState, /"save-overwrite": \{ enabled: canOverwrite/);
  assert.match(shortTermCommandState, /playPauseCopy: input\.primaryPlaybackPlaying \? "暂停" : "播放"/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermCommandState, /hasTransientState/);
  assert.match(shortTermDomRenderers, /export function createOverviewFactCell/);
  assert.match(shortTermDomRenderers, /export function createAssetRow/);
  assert.match(shortTermDomRenderers, /export function createOptimizationFindingRow/);
  assert.match(shortTermDomRenderers, /export function createReplaceableImageRow/);
  assert.match(shortTermDomRenderers, /export function createTextElementRow/);
  assert.match(shortTermDomRenderers, /export function createEditLayerRow/);
  assert.match(shortTermDomRenderers, /renderThumbnailHtml/);
  assert.match(shortTermDomState, /export function applyViewState/);
  assert.match(shortTermDomState, /export function applyModeButtons/);
  assert.match(shortTermDomState, /export function tabButtons/);
  assert.match(shortTermDomState, /export function applyTabState/);
  assert.match(shortTermDomState, /export function setActionEnabled/);
  assert.match(shortTermDomState, /document\.querySelectorAll\("\[data-view\]"\)/);
  assert.match(shortTermDomState, /button\.tabIndex = selected \? 0 : -1/);
  assert.match(shortTermDomState, /aria-pressed/);
  assert.match(shortTermFeedbackModel, /export function bannerTone/);
  assert.match(shortTermFeedbackModel, /export function buildCurrentStateSummary/);
  assert.match(shortTermFeedbackModel, /export function viewCopy/);
  assert.match(shortTermFeedbackModel, /Auto SVGA 状态摘要/);
  assert.match(shortTermFeedbackModel, /状态：\$\{viewCopy\(input\.view\)\}/);
  assert.match(shortTermFeedbackModel, /未保存输出：/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-render-model\.mjs"/);
  assert.match(shortTermEntry, /function handleTabListKeydown/);
  assert.match(shortTermEntry, /event\.key === "ArrowRight"/);
  assert.match(shortTermEntry, /event\.key === "ArrowLeft"/);
  assert.match(shortTermEntry, /event\.key === "Home"/);
  assert.match(shortTermEntry, /event\.key === "End"/);
  assert.match(shortTermEntry, /querySelector\("\[role='tablist'\]"\)\?\.addEventListener\("keydown", handleTabListKeydown\)/);
  assert.match(shortTermEntry, /setCompareTrace\("GeneralCompareModule", "General comparing"\)/);
  assert.match(shortTermEntry, /setCompareTrace\("OptimizationCompareModule", "Optimization compare"\)/);
  assert.match(shortTermEntry, /async function collectShortTermTabKeyboardProof/);
  assert.match(shortTermEntry, /proofId: "short-term-tab-keyboard-proof"/);
  assert.match(shortTermEntry, /shortTermTabKeyboardProof/);
  assert.match(shortTermRenderModel, /export function renderOverviewFactCellHtml/);
  assert.match(shortTermRenderModel, /export function renderOptimizationFindingHtml/);
  assert.match(shortTermRenderModel, /export function renderMessageRowHtml\(title, summary, tone = "info"\)/);
  assert.match(shortTermRenderModel, /success: "已生成"/);
  assert.match(shortTermRenderModel, /export function renderCompareFactCellHtml/);
  assert.match(shortTermRenderModel, /export function groupOptimizationItems/);
  assert.match(shortTermEntry, /window\.__autoSvgaShortTermActions/);
  assert.match(shortTermEntry, /aria-selected/);
  assert.match(shortTermEntry, /\/api\/short-term-product-inspection-model/);
  assert.match(shortTermEntry, /\/api\/short-term-product-optimization-workflow/);
  assert.match(shortTermEntry, /\/api\/short-term-product-image-key-rename/);
  assert.match(shortTermEntry, /function createSaveProofOutput/);
  assert.match(shortTermEntry, /createSaveProofOutput,/);
  assert.match(shortTermEntry, /\/api\/short-term-product-image-replacement-workflow/);
  assert.match(shortTermEntry, /renameImageKey: ""/);
  assert.match(shortTermDomRenderers, /data-rename-input/);
  assert.match(shortTermDomRenderers, /ReplaceableImageRow/);
  assert.match(shortTermDomRenderers, /setAttribute\("role", "option"\)/);
  assert.match(shortTermEntry, /confirmInlineRename/);
  assert.match(shortTermDomRenderers, /inline-rename-confirm/);
  assert.match(shortTermDomRenderers, /inline-rename-cancel/);
  assert.match(shortTermDomRenderers, /Enter 确认 · Esc 取消/);
  assert.match(shortTermEntry, /event\.key === "Enter"[\s\S]*confirmInlineRename/);
  assert.match(shortTermEntry, /event\.key === "Escape"[\s\S]*cancelInlineRename/);
  assert.match(shortTermEntry, /function isActivationKey/);
  assert.match(shortTermEntry, /event\.shiftKey && event\.key === "F10"/);
  assert.match(shortTermEntry, /openKeyboardResourceContextMenu/);
  assert.match(shortTermEntry, /nodes\.textElementList\.addEventListener\("keydown"/);
  assert.match(shortTermEntry, /button:not\(:disabled\)/);
  assert.match(shortTermEntry, /runtimeTextInput\.addEventListener\("keydown"/);
  assert.match(shortTermEntry, /nodes\.textDialog\.close\("confirm"\)/);
  assert.match(shortTermEntry, /nodes\.textDialog\.close\("cancel"\)/);
  assert.doesNotMatch(shortTermEntry, /renameDialog|renameHint/);
  assert.doesNotMatch(shortTermEntry, /mountPlayback\("edit"[\s\S]{0,120}start:\s*false/);
  assert.match(shortTermEntry, /saveShortTermSvgaOutput/);
  assert.match(shortTermEntry, /return \{\s*\.\.\.result,\s*outputKind,\s*expectedSha256/s);
  assert.match(shortTermEntry, /getRecentSvgaFiles/);
  assert.match(shortTermEntry, /runShortTermSmokeIfRequested/);
  assert.match(shortTermEntry, /reportSmokeResult/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-launch"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-preview-overview"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-preview-optimization"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-preview-replaceable"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-sequence-thumbnails"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-optimization-result"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-rename-dirty"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-replacement-dirty"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-replacement-reset"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-general-compare"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-edit-reserved"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-preview-minimum"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-save-failed"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-load-failed"\)/);
  assert.match(shortTermEntry, /captureSmokeArtifact\("short-term-playback-failed"\)/);
  assert.match(shortTermEntry, /short-term-open-flow-proof/);
  assert.match(shortTermEntry, /dragDropAttempted/);
  assert.match(shortTermEntry, /short-term-load-failure-proof/);
  assert.match(shortTermEntry, /sourceBytesRestoredAfterRecovery/);
  assert.match(shortTermEntry, /playbackFailureInjected/);
  assert.match(shortTermEntry, /playbackFailureVisible/);
  assert.match(shortTermEntry, /playbackFailureRecovered/);
  assert.match(shortTermEntry, /playbackFailureSourceBytesRestoredAfterRecovery/);
  assert.match(shortTermEntry, /short-term-spec-comparison-proof/);
  assert.match(shortTermEntry, /actualRequirementPairsVisible/);
  assert.match(shortTermEntry, /short-term-tab-keyboard-proof/);
  assert.match(shortTermEntry, /selectedTabOnlyInSequentialFocus/);
  assert.match(shortTermEntry, /short-term-design-interaction-proof/);
  assert.match(shortTermEntry, /collectShortTermDesignInteractionProof/);
  assert.match(shortTermEntry, /visibleFocusableElements/);
  assert.match(shortTermEntry, /metadataSelectable/);
  assert.match(shortTermEntry, /menuStateDiscoverable/);
  assert.match(shortTermEntry, /minimumPreviewCaptured/);
  assert.match(shortTermEntry, /short-term-replaceable-classification-proof/);
  assert.match(shortTermEntry, /automaticKeysExcluded/);
  assert.match(main, /validateShortTermOpenFlowProof/);
  assert.match(main, /short-term-open-flow-proof\.json/);
  assert.match(main, /validateShortTermLoadFailureProof/);
  assert.match(main, /short-term-load-failure-proof\.json/);
  assert.match(main, /validateShortTermSpecComparisonProof/);
  assert.match(main, /short-term-spec-comparison-proof\.json/);
  assert.match(main, /function validateShortTermTabKeyboardProof/);
  assert.match(main, /shortTermTabKeyboardProof = validateShortTermTabKeyboardProof/);
  assert.match(main, /short-term-tab-keyboard-proof\.json/);
  assert.match(main, /shortTermTabKeyboardProof: Boolean\(shortTermTabKeyboardProof\)/);
  assert.match(main, /function validateShortTermDesignInteractionProof/);
  assert.match(main, /shortTermDesignInteractionProof = validateShortTermDesignInteractionProof/);
  assert.match(main, /short-term-design-interaction-proof\.json/);
  assert.match(main, /shortTermDesignInteractionProof: Boolean\(shortTermDesignInteractionProof\)/);
  assert.match(main, /validateShortTermReplaceableClassificationProof/);
  assert.match(main, /short-term-replaceable-classification-proof\.json/);
  assert.match(shortTermEntry, /shortTermScreenshots: screenshotCaptures\.length >= 9/);
  assert.match(shortTermEntry, /shortTermSaveFailed: saveFailedVisible/);
  assert.match(shortTermEntry, /shortTermLoadFailed: loadFailedVisible/);
  assert.match(shortTermEntry, /short-term-empty-state-proof/);
  assert.match(shortTermEntry, /short-term-runtime-text-boundary-proof/);
  assert.match(shortTermEntry, /productCompleteClaimed: true/);
  assert.match(shortTermEntry, /sourceSha256Before: runtimeTextSourceSha256Before/);
  assert.match(shortTermEntry, /sourceSha256AfterApply: runtimeTextSourceSha256AfterApply/);
  assert.match(shortTermEntry, /runtimeTextKeySource: "official_svga_dynamic_text_imagekey"/);
  assert.match(shortTermEntry, /runtimeOverlayVisibleAfterApply/);
  assert.match(shortTermEntry, /resetClearedOverlay/);
  assert.match(shortTermEntry, /short-term-thumbnail-proof/);
  assert.match(shortTermEntry, /sequenceFourGridVisible/);
  assert.match(shortTermEntry, /sequenceThumbnailImageCount/);
  assert.match(shortTermEntry, /overviewVisibleFacts/);
  assert.match(shortTermRenderModel, /"fileSize", "decodedMemory", "canvas", "fps", "assetCount"/);
  assert.match(shortTermEntry, /short-term-optimization-proof/);
  assert.match(shortTermEntry, /optimizedBytesSmaller/);
  assert.match(shortTermEntry, /executedActionCount/);
  assert.match(shortTermEntry, /executedActionRowsVisible/);
  assert.match(shortTermEntry, /skippedMethodRowsVisible/);
  assert.match(shortTermEntry, /groupOptimizationItems/);
  assert.match(shortTermRenderModel, /item\.count > 1/);
  assert.match(shortTermEntry, /data-optimization-actions/);
  assert.match(shortTermEntry, /data-optimization-skipped/);
  assert.match(shortTermFeedbackModel, /function bannerTone/);
  assert.match(shortTermEntry, /nodes\.saveBanner\.dataset\.status = tone/);
  assert.match(shortTermEntry, /messageRow\(model\.resultTitle, model\.resultSummary, tone\)/);
  assert.match(shortTermEntry, /row\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermEntry, /empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermDomRenderers, /row\.dataset\.component = "LayerRow"/);
  assert.match(shortTermDomRenderers, /class="rowIndex"/);
  assert.match(shortTermEntry, /comparisonVisible/);
  assert.match(shortTermEntry, /sourceBytesUnchanged/);
  assert.match(shortTermEntry, /short-term-rename-proof/);
  assert.match(shortTermEntry, /contextMenuOpened/);
  assert.match(shortTermEntry, /enterConfirmed/);
  assert.match(shortTermEntry, /renamedKeyVisible/);
  assert.match(shortTermEntry, /referenceFieldsChecked: \["imageKey", "matteKey"\]/);
  assert.match(shortTermEntry, /referenceClosurePassed/);
  assert.match(shortTermEntry, /matteKeyReferenceClosurePassed/);
  assert.match(shortTermEntry, /danglingReferenceCount === 0/);
  assert.match(shortTermEntry, /short-term-replacement-proof/);
  assert.match(shortTermEntry, /resetCommandEnabled/);
  assert.match(shortTermEntry, /resetRestoredOriginal/);
  assert.match(shortTermEntry, /saveAsEnabledBeforeReset/);
  assert.match(shortTermEntry, /noAudioVisible/);
  assert.match(shortTermEntry, /noReplaceableImagesVisible/);
  assert.match(shortTermEntry, /textUnavailableVisible/);
  assert.match(shortTermEntry, /ordinaryImagesNotDuplicatedInReplaceables/);
  assert.match(shortTermEntry, /ordinaryImageThumbnailVisible/);
  assert.match(shortTermEntry, /function createSaveFailureProofOutput/);
  assert.match(shortTermEntry, /const savedModel = await inspectShortTerm\(outputBytes/);
  assert.ok(
    shortTermEntry.indexOf("const savedModel = await inspectShortTerm(outputBytes") < shortTermEntry.indexOf("state.sourceBytes = outputBytes"),
    "saved output must reopen before becoming the current source bytes"
  );
  assert.match(shortTermEntry, /playerLifecycleOk/);
  assert.match(shortTermEntry, /dragDropLoaded/);
  assert.match(shortTermEntry, /waitForCanvasPixels/);
  assert.match(shortTermEntry, /name=invalid\.svga/);
  assert.match(shortTermEntry, /toParserArrayBuffer/);
  assert.match(shortTermEntry, /view\.buffer\.slice\(view\.byteOffset, view\.byteOffset \+ view\.byteLength\)/);
  assert.match(shortTermEntry, /confirmDiscardUnsavedOutput/);
  assert.match(shortTermEntry, /renderTextElements/);
  assert.match(shortTermEntry, /selectedTextElement/);
  assert.match(shortTermEntry, /当前文件没有可预览文本元素/);
  assert.match(shortTermEntry, /打开新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermEntry, /拖入新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermEntry, /showOperationFailure\("优化未完成。", error\)/);
  assert.match(shortTermEntry, /showOperationFailure\("重命名未完成。", error\)/);
  assert.match(shortTermEntry, /showOperationFailure\("替换未完成。", error\)/);
  assert.match(shortTermEntry, /源文件没有被修改。/);
  assert.match(shortTermEntry, /currentStateSummary/);
  assert.match(shortTermFeedbackModel, /错误：\$\{input\.errorText\.trim\(\)\}/);
  assert.match(shortTermFeedbackModel, /提示：\$\{input\.saveBannerText\.trim\(\)\}/);
  assert.match(shortTermEntry, /writeClipboardText\?\.\(currentStateSummary\(\)\)/);
  assert.match(shortTermEntry, /syncShortTermMenuState/);
  assert.match(shortTermEntry, /updateShortTermMenuState/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermEntry, /showOptimizationComparison/);
  assert.match(shortTermEntry, /compareSummary/);
  assert.match(shortTermEntry, /compareMetricGrid/);
  assert.match(shortTermEntry, /compareActions/);
  assert.match(shortTermEntry, /state\.activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermEntry, /addEventListener\("contextmenu"/);
  assert.match(shortTermEntry, /openResourceContextMenu/);
  assert.doesNotMatch(shortTermEntry, /rename-resource|replace-resource|reset-resource/);
  assert.doesNotMatch(shortTermEntry, /svga-sequence-repair|batch-png|exportReview/);
  assert.match(workbenchPage, /productShellMount/);
  assert.match(workbenchPage, /\/tools\/shared\/product-tokens\.css/);
  assert.match(workbenchPage, /\/tools\/shared\/product-frontend\/product-shell\.html/);
  assert.match(workbenchPage, /src="\/desktop-product-entry\.mjs"/);
  assert.match(sharedShell, /class="shell"/);
  assert.match(sharedShell, /本地预览/);
  assert.match(sharedShell, /data-workbench-region="inspector"/);
  assert.doesNotMatch(sharedShell, /检查器/);
  assert.doesNotMatch(sharedShell, /SVGA 信息/);
  assert.match(sharedShell, /活动记录/);
  assert.match(sharedShell, /设置/);
  assert.match(sharedShell, /floatingRoot/);
  assert.match(desktopEntry, /mountProductShell/);
  assert.match(desktopEntry, /autoSvgaHostAdapter/);
  assert.match(desktopEntry, /installSvgaWebCompatibility/);
  assert.match(desktopEntry, /\/tools\/shared\/product-frontend\/product-app\.mjs/);
  assert.match(desktopEntry, /x-auto-svga-prototype-token/);
  assert.match(desktopEntry, /productMilestoneId: bridge\?\.productMilestoneId \?\? "short-term"/);
  assert.match(desktopEntry, /latestArtifactHttpApi: Boolean\(bridge\?\.scanLatestArtifacts\)/);
  assert.match(desktopEntry, /electronReferenceMediaDialog: Boolean\(bridge\?\.openReferenceMediaFile\)/);
  assert.match(desktopEntry, /scanLatestArtifacts\?\.\(\)/);
  assert.doesNotMatch(desktopEntry, /latestArtifactHttpApi:\s*false/);
  assert.doesNotMatch(desktopEntry, /Electron 默认产品页不自动扫描/);
  assert.match(desktopEntry, /editorIncubationDefaultVisible: false/);
  assert.match(desktopEntry, /class CompatibleSvgaPlayer/);
  assert.match(desktopEntry, /class CompatibleSvgaParser/);
  assert.match(
    desktopEntry,
    /bridge\?\.productMilestoneId !== "short-term"[\s\S]*tokenBoundApiPaths\.add\("\/api\/svga-sequence-repair"\)/
  );
  assert.ok(
    desktopEntry.indexOf("class CompatibleSvgaParser") < desktopEntry.indexOf("installSvgaWebCompatibility();"),
    "svga-web compatibility classes must be defined before installation"
  );
  assert.match(main, /rendererEntry = isShortTermProduct \? "web\/short-term-macos-app\.mjs"/);
  assert.match(main, /rendererPath = isShortTermProduct \? "\/" : "\/workbench\.html"/);
  assert.match(main, /installShortTermApplicationMenu/);
  assert.match(main, /function updateShortTermMenuState/);
  assert.match(main, /function validateShortTermMenuState/);
  assert.match(main, /short-term-menu-state-proof/);
  assert.match(main, /stateReflectsLoadedSmoke/);
  assert.match(main, /openMenuAvailable/);
  assert.match(main, /recentMenuExists/);
  assert.match(main, /clearRecentMenuExists/);
  assert.match(main, /editRenameEnabledMatchesSelection/);
  assert.match(main, /cancelEnabledMatchesTransientState/);
  assert.match(main, /resetImageEnabledMatchesReplacementState/);
  assert.match(main, /editTextEnabledMatchesTextState/);
  assert.match(main, /resetTextEnabledMatchesTextState/);
  assert.match(main, /optimizationTabAvailableWithFile/);
  assert.match(main, /overviewTabCheckedMatchesState/);
  assert.match(main, /optimizationTabCheckedMatchesState/);
  assert.match(main, /replaceableTabCheckedMatchesState/);
  assert.match(main, /helpStateSummaryAvailable/);
  assert.match(main, /shortTermScreenshots/);
  assert.match(main, /shortTermLoadFailed/);
  assert.match(main, /shortTermSaveFailed/);
  assert.match(main, /function validateShortTermEmptyStateProof/);
  assert.match(main, /function validateShortTermRuntimeTextBoundaryProof/);
  assert.match(main, /function validateShortTermThumbnailProof/);
  assert.match(main, /function validateShortTermOptimizationProof/);
  assert.match(main, /function validateShortTermReplaceableClassificationProof/);
  assert.match(main, /function validateShortTermRenameProof/);
  assert.match(main, /function validateShortTermReplacementProof/);
  assert.match(main, /short-term-empty-state-proof\.json/);
  assert.match(main, /short-term-runtime-text-boundary-proof\.json/);
  assert.match(main, /short-term-thumbnail-proof\.json/);
  assert.match(main, /short-term-optimization-proof\.json/);
  assert.match(main, /short-term-replaceable-classification-proof\.json/);
  assert.match(main, /short-term-rename-proof\.json/);
  assert.match(main, /short-term-replacement-proof\.json/);
  assert.match(main, /shortTermNoAudio/);
  assert.match(main, /shortTermNoReplaceable/);
  assert.match(main, /shortTermTextUnavailable/);
  assert.match(main, /shortTermRuntimeTextBoundary/);
  assert.match(main, /shortTermThumbnails/);
  assert.match(main, /shortTermOptimization/);
  assert.match(main, /shortTermRename/);
  assert.match(main, /shortTermReplacement/);
  assert.match(main, /designer_named_imagekey_text_anchor/);
  assert.match(main, /official_svga_dynamic_text_imagekey/);
  assert.match(main, /runtimeTextKeySource/);
  assert.match(main, /runtimeOverlayVisibleAfterApply/);
  assert.match(main, /resetCommandEnabledAfterApply/);
  assert.match(main, /resetClearedOverlay/);
  assert.match(main, /productCompleteClaimed !== true/);
  assert.match(main, /short-term-launch/);
  assert.match(main, /short-term-sequence-thumbnails/);
  assert.match(main, /short-term-optimization-result/);
  assert.match(main, /short-term-rename-dirty/);
  assert.match(main, /short-term-replacement-dirty/);
  assert.match(main, /short-term-replacement-reset/);
  assert.match(main, /short-term-runtime-text-applied/);
  assert.match(main, /short-term-preview-minimum/);
  assert.match(main, /short-term-load-failed/);
  assert.match(main, /short-term-save-failed/);
  assert.match(main, /short-term-playback-failed/);
  assert.match(main, /enabled: menuState\.canOverwrite/);
  assert.match(main, /enabled: menuState\.canSaveAs/);
  assert.match(main, /enabled: menuState\.canRenameImageKey/);
  assert.match(main, /enabled: menuState\.canReplaceImage/);
  assert.match(main, /enabled: menuState\.canRunOptimization/);
  assert.match(main, /enabled: menuState\.canShowOptimizationComparison/);
  assert.match(main, /saveShortTermSvgaOutput/);
  assert.match(main, /label: "文件"/);
  assert.match(main, /label: "编辑"/);
  assert.match(main, /label: "资源"/);
  assert.match(main, /label: "优化"/);
  const shortTermMenuStart = main.indexOf("function installShortTermApplicationMenu");
  const legacyMenuStart = main.indexOf("function installApplicationMenu", shortTermMenuStart + 1);
  assert.ok(shortTermMenuStart >= 0, "short-term macOS menu must be present");
  assert.ok(legacyMenuStart > shortTermMenuStart, "legacy menu boundary must follow short-term menu");
  const shortTermMenuSource = main.slice(shortTermMenuStart, legacyMenuStart);
  assert.doesNotMatch(shortTermMenuSource, /toggleDevTools|开发者工具|role: "reload"|重新载入窗口/);
  assert.match(prototypeRenderer, /loadBatchPngFiles/);
  assert.doesNotMatch(page, /id="pngInput"|id="batchPngInput"|批量 PNG 映射复核|替换 PNG/);
  assert.doesNotMatch(desktopEntry, /svgaplayerweb|unsafe-eval/);
  assert.doesNotMatch(desktopEntry, /require\(|ipcRenderer|node:fs|\/Users\//);
});

test("legacy editor prototype remains isolated from the default product surface", async () => {
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  assert.match(renderer, /renderDesktopInspectionPresentation/);
  assert.match(renderer, /createInspectionPresentation/);
  assert.match(renderer, /data-inspection-group="overview"/);
  assert.match(renderer, /data-inspection-group="spec"/);
  assert.match(renderer, /data-inspection-group="audit"/);
  assert.match(renderer, /fileInput\.addEventListener\("change"/);
  assert.match(renderer, /dropZone\.addEventListener\("drop"/);
  assert.match(renderer, /playButton\.addEventListener\("click"/);
  assert.match(renderer, /pauseButton\.addEventListener\("click"/);
  assert.match(renderer, /replayButton\.addEventListener\("click"/);
  assert.match(renderer, /选择 SVGA 文件/);
  assert.match(renderer, /无法打开此 SVGA 文件/);
  assert.match(renderer, /不支持的文件类型/);
  assert.match(renderer, /cleanupPlayer\(\);\n\s+rejectedName = name;\n\s+showError\("无法打开此 SVGA 文件/);
  assert.match(renderer, /SVGA 播放输出为空/);
  assert.match(renderer, /waitForVisibleCanvasSamples/);
  assert.match(renderer, /visibleCanvas\.sampleCount >= 3/);
  assert.match(renderer, /clearCanvas/);
  assert.match(renderer, /summary\.dimensions/);
  assert.match(renderer, /timing\.durationMs/);
  assert.match(renderer, /const hostBridge = window\.autoSvgaPrototype \?\? window\.autoSvgaElectronHost/);
  assert.match(renderer, /openHostSvgaFile/);
  assert.match(renderer, /hostBridge\.openSvgaFile/);
  assert.match(renderer, /saveEditedSvga/);
  assert.match(renderer, /\/api\/svga-image-edit-session/);
  assert.match(renderer, /\/api\/svga-image-replace/);
  assert.match(renderer, /renderP3ComparisonArtifact/);
  assert.match(renderer, /p3-original-edited-comparison/);
  assert.doesNotMatch(page, /id="pngInput"|id="batchPngInput"|id="hostOpenButton"/);
  assert.doesNotMatch(renderer, /window\.autoSvgaPrototype\./);
  assert.doesNotMatch(renderer, /require\(|ipcRenderer|node:fs|\/Users\//);
});

test("P5 batch PNG mapping review stays isolated in the desktop prototype", async () => {
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const styles = await readFile(path.join(experimentRoot, "web/styles.css"), "utf8");

  assert.doesNotMatch(page, /id="batchPngInput"/);
  assert.match(renderer, /loadBatchPngFiles/);
  assert.match(renderer, /refreshBatchMappingReport/);
  assert.match(renderer, /applyBatchMapping/);
  assert.match(renderer, /\/api\/svga-batch-png-map/);
  assert.match(renderer, /pngSha256/);
  assert.match(renderer, /replacement\.inputIndex/);
  assert.match(renderer, /replacementRequestMilestoneId/);
  assert.match(renderer, /batchReplacementRequestOptions/);
  assert.match(renderer, /bindPreviewEvidenceToRoundTripReport/);
  assert.match(renderer, /schemaVersion !== 4/);
  assert.match(renderer, /milestoneId !== "P5"/);
  assert.match(renderer, /appliedMappingCount >= 3/);
  assert.match(renderer, /appliedMappingCount: Number\.isInteger\(lastRoundTripReport\.appliedMappingCount\)/);
  assert.match(renderer, /playbackPassed/);
  assert.match(renderer, /canvasNonBlank/);
  assert.match(renderer, /批量 PNG 映射复核/);
  assert.match(renderer, /批量替换 PNG/);
  assert.match(renderer, /应用批量替换/);
  assert.match(renderer, /当前视图：精确和规范化匹配/);
  assert.match(renderer, /技术详情/);
  assert.match(renderer, /collectP5UiFlowProof/);
  assert.match(renderer, /collectBatchMappingPanelRenderProof/);
  assert.match(renderer, /dispatchBatchInputFiles/);
  assert.match(renderer, /dispatchBatchDropFiles/);
  assert.match(renderer, /setBatchIncludeViaControl/);
  assert.match(renderer, /setBatchManualTargetViaControl/);
  assert.match(renderer, /data-batch-mapping-state/);
  assert.match(renderer, /data-batch-action="manual-target"/);
  assert.match(renderer, /data-batch-action="include"/);
  assert.match(renderer, /batch_replace_resources/);
  assert.match(server, /\/api\/svga-batch-png-map/);
  assert.match(server, /createSvgaBatchPngMappingReport/);
  assert.match(server, /input\?\.milestoneId === "P5"/);
  assert.match(server, /normalizeBatchMappings/);
  assert.match(server, /path\.basename\(String\(file\?\.fileLabel/);
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(main, /categoryCount: \(result\.reviewerBCategories \?\? \[\]\)\.length/);
  assert.match(main, /p5-ui-flow-proof\.json/);
  assert.match(main, /p5-mapping-ui-render-proof\.json/);
  assert.match(main, /verdict: \(result\.reviewerBCategories/);
  assert.equal(styles.trim(), '@import url("/tools/shared/product-frontend/product-styles.css");');
  assert.doesNotMatch(renderer, /fuzzy|substring|editDistance|visualSimilarity|\/Users\//i);
});

test("P3 image replacement prototype stays isolated and records verified Save As evidence", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const runtimePrep = await readFile(path.join(experimentRoot, "../../scripts/prepare-runtime.mjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  const preloadApi = hostContract.createPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P3"
  });
  assert.match(main, /Basic Image Resource Replacement And Save As/);
  assert.match(main, /Save As target must be different from the original SVGA/);
  assert.match(main, /Save As requires the source SVGA to be opened through the desktop file picker/);
  assert.match(main, /p3SmokeSaveAs/);
  assert.match(main, /sourceFilePaths\.get\(value\.sourceId\)/);
  assert.match(main, /writeJsonProductArtifact\("resource-edit-report\.json", "p3-resource-edit-report", verifiedResult\)/);
  assert.match(main, /writeJsonProductArtifact\("round-trip-report\.json", "p3-round-trip-report", verifiedRoundTripReport\)/);
  assert.match(main, /writeJsonProductArtifact\("thumbnail-evidence\.json", "p3-thumbnail-evidence"/);
  assert.match(main, /validateP3ThumbnailEvidence/);
  assert.match(main, /schemaVersion:\s*2/);
  assert.match(main, /"p3-resource-list"/);
  assert.match(main, /"p3-original-edited-comparison": "original-edited-comparison\.png"/);
  assert.equal(typeof preloadApi.openSvgaFile, "function");
  assert.equal(typeof preloadApi.saveEditedSvga, "function");
  assert.equal(typeof preloadApi.reportP3EditResult, "function");
  assert.match(renderer, /renderEditPanel/);
  assert.match(renderer, /替换 PNG/);
  assert.match(renderer, /重置此资源/);
  assert.match(renderer, /另存为/);
  assert.match(renderer, /confirmDiscardUnsavedEdits/);
  assert.match(renderer, /window\.confirm/);
  assert.match(renderer, /canSaveEditedSvga/);
  assert.match(renderer, /浏览器选择或拖拽导入无法安全确认原始路径/);
  assert.match(renderer, /replacement-p3\.png/);
  assert.match(renderer, /originalCanvasHash !== editedCanvasHash/);
  assert.match(renderer, /thumbnailEvidence/);
  assert.match(renderer, /replacementSelectedScreenshotSha256/);
  assert.match(renderer, /replacementSelectedStateConfirmed/);
  assert.match(renderer, /replacementSelectedCandidateSha256/);
  assert.match(renderer, /replacementSelectedCandidateVisible/);
  assert.match(renderer, /replacementMatchesReopened/);
  assert.match(main, /validateReplacementResetProof/);
  assert.match(productApp, /svga-replacement-reset-proof/);
  assert.match(renderer, /invalidPngRetainsLastValidThumbnail/);
  assert.match(renderer, /resourceThumbnailSha256/);
  assert.match(renderer, /renderP3ComparisonArtifact/);
  assert.match(server, /\/api\/svga-image-edit-session/);
  assert.match(server, /\/api\/svga-image-replace/);
  assert.match(server, /attachSessionThumbnails/);
  assert.match(server, /thumbnailDataUrl/);
  assert.match(server, /SvgaImageResourceEditor/);
  assert.match(runtimePrep, /replacement-p3\.png/);
  assert.doesNotMatch(renderer, /readFile|writeFile|dialog|shell|\/Users\//);
  assert.doesNotMatch(main, /svga-web-experiment:open-svga-file[\s\S]*persistedAbsolutePath/);
});

test("P4 multi-resource editing keeps history and export integrity boundaries isolated", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const renderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const server = await readFile(path.join(experimentRoot, "server.mjs"), "utf8");
  const preloadApi = hostContract.createPreloadApi(() => undefined, {
    reportToken: "test-token",
    productMilestoneId: "P4"
  });
  assert.match(renderer, /editHistorySnapshots/);
  assert.match(renderer, /savedReplacementDigest/);
  assert.match(renderer, /editOperationSequence/);
  assert.match(renderer, /maxEditHistorySnapshots/);
  assert.match(renderer, /replacementInputDigest/);
  assert.match(renderer, /data-edit-action="undo"/);
  assert.match(renderer, /data-edit-action="redo"/);
  assert.match(renderer, /data-edit-dirty/);
  assert.match(renderer, /data-edit-revision/);
  assert.match(renderer, /data-edit-can-undo/);
  assert.match(renderer, /data-edit-can-redo/);
  assert.match(renderer, /key === "z"/);
  assert.match(renderer, /key === "y"/);
  assert.match(renderer, /undoEditHistory/);
  assert.match(renderer, /redoEditHistory/);
  assert.match(renderer, /isStaleEditOperation/);
  assert.match(renderer, /staleLoadResult/);
  assert.match(renderer, /operationSequence/);
  assert.match(renderer, /maybeRunP4EditSmoke/);
  assert.match(renderer, /reportP4EditResult/);
  assert.match(renderer, /createSaveRevisionValidation/);
  assert.match(renderer, /roundTripReportDigest/);
  assert.match(renderer, /saveOperationSequence !== editOperationSequence/);
  assert.match(renderer, /reopenedResult\.playback/);
  assert.match(main, /validateSaveRevisionBinding/);
  assert.match(main, /value\.milestoneId === "P5"/);
  assert.match(main, /value\.reportSchemaVersion !== 4 \|\| value\.reportMilestoneId !== "P5"/);
  assert.match(main, /value\.appliedMappingCount < 3/);
  assert.match(main, /editedBytesSha256/);
  assert.match(main, /value\.replacementCount < 2/);
  assert.equal(typeof preloadApi.reportP4EditResult, "function");
  assert.match(renderer, /replacementRequestMilestoneId/);
  assert.match(server, /input\?\.milestoneId === "P3"/);
  assert.match(server, /replaceImages\(bytes, decodedReplacements, name, \{/);
  assert.match(server, /milestoneId,/);
  assert.match(main, /const savedSourceId = rememberSourceFile\(targetPath\)/);
  assert.match(main, /sourceId: savedSourceId/);
  assert.match(main, /IPC_CHANNELS\.p4EditResult/);
  assert.match(main, /validateP4EditResult/);
  assert.match(main, /multi-resource-round-trip-report\.json/);
  assert.match(main, /edit-history-report\.json/);
  assert.match(main, /canonical-multi-resource-fixture\.json/);
  assert.match(main, /multi-resource-edited-output\.svga/);
  const p4UploadScript = await readFile(path.join(experimentRoot, "scripts/build-p4-upload-package.mjs"), "utf8");
  assert.match(p4UploadScript, /review\/P4-latest/);
  assert.match(p4UploadScript, /P4 upload ZIP/);
  assert.match(p4UploadScript, /reviewSource: "independent-read-only-reviewer-b-json"/);
  assert.doesNotMatch(p4UploadScript, /generatedAt: "stable-reviewer-b-product-categories"/);
  assert.doesNotMatch(renderer, /readFile|writeFile|dialog|shell|\/Users\//);
});

test("root package exposes explicit desktop entrypoints without changing default scripts", async () => {
  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const experimentPackage = JSON.parse(await readFile(path.join(experimentRoot, "package.json"), "utf8"));
  const legacyPackage = JSON.parse(await readFile(path.join(experimentRoot, "../../package.json"), "utf8"));
  assert.equal(rootPackage.scripts["desktop:dev"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev");
  assert.equal(rootPackage.scripts["desktop:smoke"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke");
  assert.match(rootPackage.scripts["desktop:p2:normal-proof"], /desktop:p2:normal-proof/);
  assert.equal(rootPackage.scripts["desktop:short-term:acceptance-matrix"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:acceptance-matrix");
  assert.equal(rootPackage.scripts["desktop:p2:reviewer-b"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:reviewer-b");
  assert.equal(rootPackage.scripts["desktop:p2:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:upload-package");
  assert.equal(rootPackage.scripts["desktop:p3:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p3:upload-package");
  assert.equal(rootPackage.scripts["desktop:p4:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p4:upload-package");
  assert.equal(rootPackage.scripts.test, "npm run test:all");
  assert.equal(rootPackage.scripts["local:preview"], "node tools/launch-local-preview.mjs");
  assert.match(experimentPackage.scripts["desktop:dev"], /electron \.$/);
  assert.match(experimentPackage.scripts["desktop:smoke"], /--smoke --product-smoke/);
  assert.match(experimentPackage.scripts["desktop:p2:normal-proof"], /run-canonical-normal-proof\.mjs/);
  assert.match(experimentPackage.scripts["desktop:short-term:acceptance-matrix"], /build-short-term-acceptance-matrix\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:reviewer-b"], /build-p2-reviewer-b-categories\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:upload-package"], /build-p2-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p3:upload-package"], /build-p3-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p4:upload-package"], /build-p4-upload-package\.mjs/);
  assert.doesNotMatch(experimentPackage.scripts["desktop:p2:normal-proof"], /--p2-normal-proof/);
  assert.notEqual(rootPackage.scripts["desktop:dev"], legacyPackage.scripts["spike:electron:smoke"]);
  assert.doesNotMatch(rootPackage.scripts["desktop:dev"], /tools\/electron-prototype run/);
});

test("short-term acceptance matrix stays current-head bound and does not hide known gaps", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-short-term-acceptance-matrix.mjs"), "utf8");
  assert.match(source, /proofId: "short-term-acceptance-matrix"/);
  assert.match(source, /releaseCandidateReady/);
  assert.match(source, /stale/);
  assert.match(source, /headCommit/);
  assert.match(source, /current HEAD/);
  assert.match(source, /short-term-open-flow-proof\.json/);
  assert.match(source, /short-term-load-failure-proof\.json/);
  assert.match(source, /short-term-playback-failed\.png/);
  assert.match(source, /short-term-spec-comparison-proof\.json/);
  assert.match(source, /short-term-replaceable-classification-proof\.json/);
  assert.match(source, /id: "S13"/);
  assert.match(source, /productCompleteClaimed === true/);
  assert.match(source, /designer_named_imagekey_text_anchor/);
  assert.match(source, /official_svga_dynamic_text_imagekey/);
  assert.match(source, /runtimeOverlayVisibleAfterApply === true/);
  assert.match(source, /resetClearedOverlay === true/);
  assert.match(source, /short-term-runtime-text-applied\.png/);
  assert.match(source, /Need both drag\/drop proof and macOS menu\/host-dialog normal proof/);
  assert.match(source, /playback-failure-specific abnormal-state proof/);
  assert.match(source, /playbackFailureInjected/);
  assert.match(source, /playbackFailureRecovered/);
  assert.match(source, /imageKey and matteKey reference closure/);
  assert.match(source, /imageKeyReferenceClosurePassed/);
  assert.match(source, /matteKeyReferenceClosurePassed/);
  assert.match(source, /danglingReferenceCount === 0/);
});

test("P2 parity report generator is deterministic and not unconditional pass", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-parity-report.mjs"), "utf8");
  assert.match(source, /function check\(/);
  assert.match(source, /function category\(/);
  assert.match(source, /unresolvedDifferences/);
  assert.match(source, /missingArtifacts/);
  assert.match(source, /desktop_brand_mark/);
  assert.match(source, /player_column_primary/);
  assert.match(source, /structured_groups_exist/);
  assert.match(source, /calibration_collapsed/);
  assert.match(source, /shared_token_file_exists/);
  assert.match(source, /matched-web-desktop-loaded-comparison\.png/);
  assert.match(source, /normalRuntimeEvidence/);
  assert.match(source, /fixtureParity/);
  assert.match(source, /comparison-manifest\.json/);
  assert.match(source, /canonical-fixture\.json/);
  assert.match(source, /invalid-fixture\.json/);
  assert.match(source, /desktop-state-render-proof\.json/);
  assert.match(source, /stateProof/);
  assert.match(source, /empty_rendered_overlay_visible/);
  assert.match(source, /loading_rendered_text/);
  assert.match(source, /invalid_stale_metadata_cleared/);
  assert.match(source, /comparison_blank_space_bounded/);
  assert.match(source, /web_valid_phase_playback_confirmed/);
  assert.match(source, /web_invalid_phase_isolated/);
  assert.match(source, /requiredCategoryStatus/);
  assert.doesNotMatch(source, /productIdentity:\s*\{\s*status:\s*"pass"/);
  assert.doesNotMatch(source, /unresolvedDifferences:\s*\[\]/);
});

test("desktop state render proof aggregates every recorded failed state", async () => {
  const source = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(source, /proof\.failedStateIds = Object\.entries\(proof\.states \?\? \{\}\)/);
  assert.match(source, /value\?\.passed === false/);
  assert.match(source, /proof\.passed = proof\.requiredStateIds\.every/);
  assert.match(source, /&& proof\.failedStateIds\.length === 0/);
});

test("desktop smoke captures local compare states as required proof", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const productApp = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-app.mjs"), "utf8");
  assert.match(main, /"local-compare-loaded"/);
  assert.match(main, /"responsive-local-compare-at-900-x-720"/);
  assert.match(main, /"responsive-local-compare-at-minimum-size"/);
  assert.match(productApp, /captureArtifact\("desktop-local-compare-loaded"\)/);
  assert.match(productApp, /captureArtifact\("desktop-responsive-local-compare-at-900-x-720"\)/);
  assert.match(productApp, /captureArtifact\("desktop-responsive-local-compare-at-minimum-size"\)/);
});

test("desktop svga-web compatibility exposes awaitable frame stepping", async () => {
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  assert.match(desktopEntry, /stepToFrame\(frame, playAfter = false\) \{/);
  assert.match(desktopEntry, /return this\.ready\.then\(\(\) => \{/);
  assert.match(desktopEntry, /drawFrame\(this\.player, this\.videoItem, frame\)/);
});

test("P2 web reference capture isolates valid and invalid SVGA phases", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/web-reference-capture.cjs"), "utf8");
  assert.match(source, /setPhase\("valid-load"\)/);
  assert.match(source, /setPhase\("valid-inspection"\)/);
  assert.match(source, /setPhase\("invalid-load"\)/);
  assert.match(source, /validPhaseErrors/);
  assert.match(source, /invalidPhaseErrors/);
  assert.match(source, /validPhase:\s*\{/);
  assert.match(source, /invalidPhase:\s*\{/);
  assert.match(source, /playbackConfirmed = normalizedProof\.loaded === true/);
  assert.doesNotMatch(source, /consoleMessages\.filter/);
});

test("P2 canonical fixture helper freezes one approved fixture for all proof paths", async () => {
  const helper = await readFile(path.join(experimentRoot, "scripts/p2-fixture.mjs"), "utf8");
  const webCapture = await readFile(path.join(experimentRoot, "scripts/capture-p2-web-reference.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  assert.match(helper, /canonical-fixture\.json/);
  assert.match(helper, /canonicalFixtureFileName = "canonical-fixture\.svga"/);
  assert.match(helper, /invalid-fixture\.json/);
  assert.match(helper, /invalidFixtureFileName = "invalid-fixture\.svga"/);
  assert.match(helper, /expectedInvalid: true/);
  assert.match(helper, /fixtureFields\(fixture\)/);
  assert.match(helper, /approvedSyntheticOrRepositoryFixture: true/);
  assert.match(helper, /readCanonicalFixture/);
  assert.match(webCapture, /ensureCanonicalFixture/);
  assert.match(webCapture, /readCanonicalFixture/);
  assert.match(webCapture, /mergeFixtureMetadata\("web-reference-runtime-proof\.json"\)/);
  assert.match(main, /canonicalFixtureMetadata/);
  assert.match(main, /fixtureSha256/);
});

test("P2 Reviewer B product categories are generated from required parity categories", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-reviewer-b-categories.mjs"), "utf8");
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.match(source, /Independent Reviewer B input is required/);
  assert.match(source, /readReviewerInput/);
  assert.match(source, /validateReviewerInput/);
  assert.match(source, /schemaVersion !== 2/);
  assert.match(source, /productIdentity/);
  assert.match(source, /fixtureParity/);
  assert.match(source, /playerWorkspace/);
  assert.match(source, /emptyState/);
  assert.match(source, /loadingState/);
  assert.match(source, /invalidState/);
  assert.match(source, /webDesktopParity/);
  assert.match(source, /normalRuntimeEvidence/);
  assert.doesNotMatch(source, /verdict: blocking\.length === 0 \? "PASS" : "BLOCKING"/);
});

test("P2 upload package contract includes review packet, screenshots, and reports", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p2-upload-package.mjs"), "utf8");
  assert.match(source, /REVIEW_PACKET\.md/);
  assert.match(source, /FINAL_RESPONSE\.txt/);
  assert.match(source, /MANIFEST\.json/);
  assert.match(source, /screenshots/);
  assert.match(source, /reports/);
  assert.match(source, /canonical-fixture\.json/);
  assert.match(source, /comparison-manifest\.json/);
  assert.match(source, /desktop-state-render-proof\.json/);
  assert.match(source, /invalid-fixture\.json/);
  assert.match(source, /bundle-privacy-audit\.json/);
  assert.match(source, /sanitizeReviewText/);
  assert.match(source, /buildPrivacyAudit/);
  assert.match(source, /UPLOAD_TO_REVIEW_ASSISTANT:P2-\$\{headShort\}-upload\.zip/);
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.equal(source.includes("P2-${headShort}-upload.zip"), true);
  assert.equal(source.includes("review/P2-latest"), true);
});

test("P3 upload package contract includes sealed review evidence and redacted bundle manifest", async () => {
  const source = await readFile(path.join(experimentRoot, "scripts/build-p3-upload-package.mjs"), "utf8");
  assert.match(source, /REVIEW_PACKET\.md/);
  assert.match(source, /FINAL_RESPONSE\.txt/);
  assert.match(source, /MANIFEST\.json/);
  assert.match(source, /changes\.patch/);
  assert.match(source, /validation\.json/);
  assert.match(source, /budget-check\.json/);
  assert.match(source, /reviewer-a\.json/);
  assert.match(source, /reviewer-b\.json/);
  assert.match(source, /post-seal-verification\.json/);
  assert.match(source, /thumbnail-evidence\.json/);
  assert.match(source, /edited-output\.svga/);
  assert.match(source, /application\/x-svga/);
  assert.equal(source.includes('".patch"'), true);
  assert.match(source, /includedInBundle: true/);
  assert.match(source, /copySealedEvidence/);
  assert.match(source, /product-bundle-validation\.json/);
  assert.match(source, /reviewer-b-product-categories\.json/);
  assert.match(source, /sealed-packet-manifest\.json/);
  assert.match(source, /UPLOAD_INDEX\.json/);
  assert.match(source, /stable-p3-visible-upload-index/);
  assert.match(source, /await rm\(visibleRoot, \{ recursive: true, force: true \}\)/);
  assert.match(source, /replacementSelectedStateConfirmed/);
  assert.match(source, /POSIX_HOME_PATH/);
  assert.match(source, /MACOS_USERS_PATH/);
  assert.match(source, /valueHash/);
  assert.match(source, /PRIVATE_SENTINELS/);
  assert.match(source, /UPLOAD_TO_REVIEW_ASSISTANT:P3-\$\{headShort\}-upload\.zip/);
  assert.equal(source.includes("P3-${headShort}-upload.zip"), true);
  assert.equal(source.includes("review/P3-latest"), true);
  assert.equal(source.includes("sanitizeTextFiles"), false);
  assert.equal(source.includes("sanitizeReviewText"), false);
  assert.equal(source.includes('path.join(packetRoot, "FINAL_RESPONSE.txt")'), false);
  const macPrivatePath = ["", "Users", "private-user", "example"].join("/");
  const posixPrivatePath = ["", "home", "private-user", "example"].join("/");
  const windowsPrivatePath = ["C:", "Users", "private-user", "example"].join("\\");
  assert.equal(source.includes(macPrivatePath), false);
  assert.equal(source.includes(posixPrivatePath), false);
  assert.equal(source.includes(windowsPrivatePath), false);
});

async function createOptimizerFixture() {
  const root = await protobuf.load(path.join(repoRoot, "proto/svga.proto"));
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  const sharedImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const payload = {
    version: "2.0",
    params: { viewBoxWidth: 64, viewBoxHeight: 64, fps: 24, frames: 4 },
    images: {
      img_base: sharedImage,
      img_copy: sharedImage,
      img_unused: Buffer.from([0x89, 0x50, 0x4e, 0x47, 9])
    },
    sprites: [
      { imageKey: "img_base", frames: createOptimizerFrames() },
      { imageKey: "img_copy", frames: createOptimizerFrames() }
    ],
    audios: []
  };
  const verificationError = MovieEntity.verify(payload);
  assert.equal(verificationError, null);
  return deflateSync(MovieEntity.encode(MovieEntity.create(payload)).finish());
}

function createOptimizerFrames() {
  return Array.from({ length: 4 }, (_unused, index) => ({
    alpha: 1,
    layout: { x: 0, y: 0, width: 10, height: 10 },
    transform: { a: 1, b: 0, c: 0, d: 1, tx: index, ty: 0 },
    clipPath: "",
    shapes: []
  }));
}

test("real sample audit harness stores aliases and avoids absolute paths in report output", async () => {
  const auditPage = await readFile(path.join(experimentRoot, "web/audit.js"), "utf8");
  const auditScript = await readFile(path.join(experimentRoot, "scripts/run-real-sample-parity-audit.mjs"), "utf8");
  assert.match(auditPage, /playerMode/);
  assert.match(auditPage, /svgaplayerweb/);
  assert.match(auditPage, /svga-web/);
  assert.match(auditPage, /reportAuditResult/);
  assert.doesNotMatch(auditPage, /require\(|ipcRenderer|node:fs|\/Users\//);
  assert.match(auditScript, /sampleRoot: "external local sample root, not committed"/);
  assert.match(auditScript, /redactOutput/);
  assert.match(auditScript, /audit-samples/);
});
