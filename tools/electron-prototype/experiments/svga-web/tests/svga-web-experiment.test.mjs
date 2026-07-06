import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
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
  macosPackagerArgs,
  validateProof
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
  assert.match(packageScript, /const artifactsRoot = path\.join\(experimentRoot, "\.artifacts\/internal-trial"\)/);
  assert.doesNotMatch(packageScript, /AUTO_SVGA_PRODUCT_ARTIFACTS|\.artifacts\/product/);
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

test("macOS package proof rejects packaged App identity drift", async () => {
  const sourcePlist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip"),
    validatePackagedApp: false
  });
  const packagedPlist = sourcePlist.replace(
    "</dict>",
    "  <key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>\n</dict>"
  );

  assert.doesNotThrow(() => validateProof(sourcePlist, proof, packagedPlist));
  assert.throws(
    () => validateProof(
      sourcePlist,
      proof,
      packagedPlist.replace("<key>CFBundleDisplayName</key>\n  <string>Auto SVGA</string>", "<key>CFBundleDisplayName</key>\n  <string>Electron</string>")
    ),
    /packagedAppIdentity/
  );
  assert.throws(
    () => validateProof(sourcePlist, proof, packagedPlist.replace("<key>CFBundleExecutable</key>\n  <string>Auto SVGA</string>", "<key>CFBundleExecutable</key>\n  <string>Electron</string>")),
    /packagedExecutableIdentity/
  );
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
  const shortTermController = await readFile(path.join(experimentRoot, "web/short-term-macos-controller.mjs"), "utf8");
  const shortTermState = await readFile(path.join(experimentRoot, "web/short-term-macos-state.mjs"), "utf8");
  const shortTermAppearanceModel = await readFile(path.join(experimentRoot, "web/short-term-macos-appearance-model.mjs"), "utf8");
  const shortTermSettingsSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-settings-surface.mjs"), "utf8");
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
  const shortTermCommandSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-command-surface.mjs"), "utf8");
  const shortTermCompareModel = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-model.mjs"), "utf8");
  const shortTermCompareRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-renderers.mjs"), "utf8");
  const shortTermCompareSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-compare-surface.mjs"), "utf8");
  const shortTermDragDecisionModel = await readFile(path.join(experimentRoot, "web/short-term-macos-drag-decision-model.mjs"), "utf8");
  const shortTermDragDecisionSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-drag-decision-surface.mjs"), "utf8");
  const shortTermEditReservedRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-edit-reserved-renderers.mjs"), "utf8");
  const shortTermDomState = await readFile(path.join(experimentRoot, "web/short-term-macos-dom-state.mjs"), "utf8");
  const shortTermNodes = await readFile(path.join(experimentRoot, "web/short-term-macos-nodes.mjs"), "utf8");
  const shortTermEventBindings = await readFile(path.join(experimentRoot, "web/short-term-macos-event-bindings.mjs"), "utf8");
  const shortTermActionBridge = await readFile(path.join(experimentRoot, "web/short-term-macos-action-bridge.mjs"), "utf8");
  const shortTermFeedbackModel = await readFile(path.join(experimentRoot, "web/short-term-macos-feedback-model.mjs"), "utf8");
  const shortTermFeedbackSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-feedback-surface.mjs"), "utf8");
  const shortTermFileSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-file-surface.mjs"), "utf8");
  const shortTermInlineStatusRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-inline-status-renderers.mjs"), "utf8");
  const shortTermLaunchRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-launch-renderers.mjs"), "utf8");
  const shortTermRecentFilesModel = await readFile(path.join(experimentRoot, "web/short-term-macos-recent-files-model.mjs"), "utf8");
  const shortTermRecentFilesSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-recent-files-surface.mjs"), "utf8");
  const shortTermOutputSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-output-surface.mjs"), "utf8");
  const shortTermRenderModel = await readFile(path.join(experimentRoot, "web/short-term-macos-render-model.mjs"), "utf8");
  const shortTermSaveRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-save-renderers.mjs"), "utf8");
  const shortTermSaveModel = await readFile(path.join(experimentRoot, "web/short-term-macos-save-model.mjs"), "utf8");
  const shortTermSaveSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-save-surface.mjs"), "utf8");
  const shortTermStateRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-state-renderers.mjs"), "utf8");
  const shortTermInteractionModel = await readFile(path.join(experimentRoot, "web/short-term-macos-interaction-model.mjs"), "utf8");
  const shortTermTextRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-text-renderers.mjs"), "utf8");
  const shortTermTextModel = await readFile(path.join(experimentRoot, "web/short-term-macos-text-model.mjs"), "utf8");
  const shortTermThumbnailRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-thumbnail-renderers.mjs"), "utf8");
  const shortTermReplaceableModel = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-model.mjs"), "utf8");
  const shortTermReplaceableRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-renderers.mjs"), "utf8");
  const shortTermReplaceableSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-replaceable-surface.mjs"), "utf8");
  const shortTermRuntimeTextSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-runtime-text-surface.mjs"), "utf8");
  const shortTermOptimizationModel = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-model.mjs"), "utf8");
  const shortTermOptimizationRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-renderers.mjs"), "utf8");
  const shortTermOptimizationSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-optimization-surface.mjs"), "utf8");
  const shortTermPreviewSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-preview-surface.mjs"), "utf8");
  const shortTermOverviewModel = await readFile(path.join(experimentRoot, "web/short-term-macos-overview-model.mjs"), "utf8");
  const shortTermOverviewRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-overview-renderers.mjs"), "utf8");
  const shortTermEditReservedModel = await readFile(path.join(experimentRoot, "web/short-term-macos-edit-reserved-model.mjs"), "utf8");
  const shortTermResourceMenuRenderers = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-renderers.mjs"), "utf8");
  const shortTermResourceMenuModel = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-model.mjs"), "utf8");
  const shortTermResourceMenuSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-resource-menu-surface.mjs"), "utf8");
  const shortTermNavigationSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-navigation-surface.mjs"), "utf8");
  const shortTermSmokeProofModel = await readFile(path.join(experimentRoot, "web/short-term-macos-smoke-proof-model.mjs"), "utf8");
  const shortTermSmokeRunner = await readFile(path.join(experimentRoot, "web/short-term-macos-smoke-runner.mjs"), "utf8");
  const shortTermByteModel = await readFile(path.join(experimentRoot, "web/short-term-macos-byte-model.mjs"), "utf8");
  const shortTermApiClient = await readFile(path.join(experimentRoot, "web/short-term-macos-api-client.mjs"), "utf8");
  const shortTermHostClient = await readFile(path.join(experimentRoot, "web/short-term-macos-host-client.mjs"), "utf8");
  const shortTermDialogModel = await readFile(path.join(experimentRoot, "web/short-term-macos-dialog-model.mjs"), "utf8");
  const shortTermPlaybackModel = await readFile(path.join(experimentRoot, "web/short-term-macos-playback-model.mjs"), "utf8");
  const shortTermPlaybackSurface = await readFile(path.join(experimentRoot, "web/short-term-macos-playback-surface.mjs"), "utf8");
  const workbenchPage = await readFile(path.join(experimentRoot, "web/workbench.html"), "utf8");
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const prototypeRenderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  const sharedShell = await readFile(path.join(repoRoot, "tools/shared/product-frontend/product-shell.html"), "utf8");
  assert.match(page, /<title>Auto SVGA<\/title>/);
  assert.match(page, /id="previewDragOverlay"/);
  assert.match(page, /id="compareDragOverlay"/);
  assert.match(page, /data-component="DragDecisionOverlay"/);
  assert.match(page, /id="canvasToast"/);
  assert.match(page, /data-component="CanvasToast"/);
  assert.match(main, /productDisplayName = "Auto SVGA"/);
  assert.match(main, /app\.setName\(productDisplayName\)/);
  assert.match(page, /data-app-state="launch"/);
  assert.match(page, /data-view="preview"/);
  assert.match(page, /data-panel="overview"/);
  assert.match(page, /data-panel="optimization"/);
  assert.doesNotMatch(page, /data-panel="replaceable"/);
  assert.doesNotMatch(page, /role="tablist" aria-orientation="horizontal"/);
  assert.match(page, /class="rightPanel" aria-label="信息" data-component="RightInformationSurface"/);
  assert.match(page, /class="rightSurfaceHeader"/);
  assert.match(page, /<h1 class="fileIdentity" id="fileIdentity">等待打开文件<\/h1>/);
  assert.match(page, /class="canvasModeSwitch" role="group" aria-label="模式" data-component="CanvasModeSwitch"/);
  assert.doesNotMatch(page, /class="tabs" aria-label="面板标签" role="tablist"/);
  assert.doesNotMatch(page, /data-tab="overview"|data-component="TabItem"|role="tab"/);
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
  assert.match(page, /data-component="CompareCanvasSurface"/);
  assert.match(page, /class="largeOpenButton compareCanvasOpenButton" type="button" data-action="open-compare-a">打开文件<\/button>/);
  assert.match(page, /class="largeOpenButton compareCanvasOpenButton" type="button" data-action="open-compare-b">打开文件<\/button>/);
  assert.doesNotMatch(page, /data-canvas-label="预览"/);
  assert.match(page, /class="playbackActions" data-component="PlaybackButtonGroup"/);
  assert.match(page, /class="playbackIconButton primary" data-action="play-pause"/);
  assert.match(page, /class="playbackIcon playbackIconPlay"/);
  assert.match(page, /class="playbackIcon playbackIconPause"/);
  assert.match(page, /class="playbackIconButton" data-action="replay"/);
  assert.doesNotMatch(page, /<button type="button" data-action="play-pause">播放<\/button>/);
  assert.doesNotMatch(page, /<button type="button" data-action="replay">重播<\/button>/);
  assert.match(page, /class="playbackProgress" id="playbackProgress" role="progressbar" aria-label="播放进度"/);
  assert.match(page, /class="playbackTime" id="playbackTime">0:00 \/ 0:00<\/span>/);
  assert.match(page, /class="playbackMeta" id="playbackMeta" aria-live="polite" data-component="InlineStatus"/);
  assert.match(page, /class="playbackBar comparePlaybackBar" aria-label="播放控制" data-component="PlaybackControls" data-state="disabled"/);
  assert.match(page, /class="playbackIconButton primary" data-playback-state="paused" aria-label="播放" title="播放" disabled/);
  assert.match(page, /最近打开/);
  assert.match(page, /class="launchDropIcon"/);
  assert.match(page, />拖拽文件到此处<\/p>/);
  assert.match(page, /class="largeOpenButton" type="button" data-action="open"[\s\S]*class="buttonIcon"/);
  assert.match(page, /class="recentClearButton" type="button" data-action="clear-recent" aria-label="清除最近记录"/);
  assert.doesNotMatch(page, />清除记录<\/button>/);
  assert.doesNotMatch(page, /本地预览，不上传/);
  assert.match(page, /覆盖保存/);
  assert.match(page, /id="discardDialog"/);
  assert.doesNotMatch(page, /id="textDialog"|data-component="TextReplacementSheet"/);
  assert.match(page, /id="discardDialog" data-component="ErrorRecoveryPanel" data-status="warning"/);
  assert.match(page, /id="settingsDialog" data-component="SettingsSheet" data-status="info"/);
  assert.match(page, /class="settingsGroup" aria-label="外观" data-component="ThemeSegmentedControl"/);
  assert.match(page, /data-appearance-choice><span>跟随系统<\/span>/);
  assert.match(page, /name="appearance" value="light" data-appearance-choice><span>浅色<\/span>/);
  assert.match(page, /name="appearance" value="dark" data-appearance-choice><span>深色<\/span>/);
  assert.doesNotMatch(page, /预览背景|主预览适配|活动记录/);
  assert.match(page, /class="dialogActions"/);
  assert.match(page, /id="resourceContextMenu"/);
  assert.match(page, /放弃未保存输出/);
  assert.match(page, /id="textPreviewSummary"/);
  assert.match(page, /id="textElementList"/);
  assert.match(page, /class="textPreviewBlock" aria-labelledby="textPreviewHeading"/);
  assert.doesNotMatch(page, /class="textPreviewActions"|data-action="edit-text" disabled|data-action="reset-text" disabled/);
  assert.match(page, /data-component="WindowChrome"/);
  assert.doesNotMatch(page, /class="toolbarCluster toolbarClusterPrimary"/);
  assert.doesNotMatch(page, /data-action="compare"/);
  assert.doesNotMatch(page, /打开另一个 SVGA 后开始对比/);
  assert.match(page, /data-component="CanvasModeSwitch"/);
  assert.match(page, /class="toolbarCluster toolbarClusterSave" data-component="SaveButtonPair"/);
  assert.match(page, /data-component="ReservedOperationPanel"/);
  assert.doesNotMatch(page, /role="tablist"|aria-selected="true"/);
  assert.match(page, /id="panelOverview" data-panel="overview" tabindex="0" aria-label="文件信息"/);
  assert.doesNotMatch(page, /id="overviewSummary"/);
  assert.doesNotMatch(page, /id="assetSummary"/);
  assert.match(page, /id="panelOptimization" data-panel="optimization" tabindex="0" aria-label="优化"/);
  assert.doesNotMatch(page, /id="panelReplaceable"/);
  assert.match(page, /id="replaceableList" role="listbox" aria-label="imageKey"/);
  assert.match(page, /id="textElementList" role="listbox" aria-label="运行时文本"/);
  assert.match(page, /short-term-macos\.tokens\.css/);
  assert.doesNotMatch(page, /id="compareFileInput"/);
  assert.doesNotMatch(page, /id="renameDialog"|id="renameInput"|id="renameHint"/);
  assert.doesNotMatch(page, /短期版仅保留图层查看/);
  assert.doesNotMatch(page, /productShellMount|desktop-product-entry\.mjs|prototype\.js/);
  assert.doesNotMatch(page, /导出验收|序列修复|批量 PNG|Export Acceptance/);
  assert.doesNotMatch(page, /brandMark/);
  assert.doesNotMatch(page, /inspectorPanel|检查面板|检查标签|检查器/);
  assert.match(shortTermTokens, /--asv-window/);
  assert.match(shortTermTokens, /--asv-color-window/);
  assert.match(shortTermTokens, /--asv-color-surface-window/);
  assert.match(shortTermTokens, /--asv-color-surface-workbench/);
  assert.match(shortTermTokens, /--asv-color-surface-right-panel/);
  assert.match(shortTermTokens, /--asv-color-surface-panel-chrome/);
  assert.match(shortTermTokens, /--asv-color-surface-panel-recessed/);
  assert.match(shortTermTokens, /--asv-component-right-panel-width/);
  assert.match(shortTermTokens, /--asv-component-right-panel-separator-width/);
  assert.match(shortTermTokens, /--asv-right-panel-separator/);
  assert.doesNotMatch(shortTermTokens, /inspector/);
  assert.match(shortTermTokens, /--asv-color-surface-control/);
  assert.match(shortTermTokens, /--asv-color-surface-mode-switch/);
  assert.match(shortTermTokens, /--asv-color-surface-mode-selected/);
  assert.match(shortTermTokens, /--asv-mode-switch-bg: var\(--asv-color-surface-mode-switch\)/);
  assert.match(shortTermTokens, /--asv-mode-selected-bg: var\(--asv-color-surface-mode-selected\)/);
  assert.match(shortTermTokens, /--asv-component-status-rail-width/);
  assert.match(shortTermTokens, /--asv-status-rail-width: var\(--asv-component-status-rail-width\)/);
  assert.match(shortTermTokens, /--asv-color-surface-row-selected/);
  assert.match(shortTermTokens, /--asv-panel-border/);
  assert.match(shortTermTokens, /--asv-shadow-panel-highlight/);
  assert.match(shortTermTokens, /--asv-shadow-panel-chrome/);
  assert.match(shortTermTokens, /--asv-shadow-row-selected/);
  assert.match(shortTermTokens, /--asv-shadow-fact-cell/);
  assert.match(shortTermTokens, /--asv-component-toolbar-control-background/);
  assert.match(shortTermTokens, /--asv-toolbar-control-bg: var\(--asv-component-toolbar-control-background\)/);
  assert.match(shortTermTokens, /--asv-component-toolbar-height/);
  assert.match(shortTermTokens, /--asv-component-launch-content-width/);
  assert.match(shortTermTokens, /--asv-component-launch-drop-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-button-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-clear-icon-size/);
  assert.match(shortTermTokens, /--asv-launch-recent-row-height/);
  assert.match(shortTermTokens, /--asv-component-preview-gap/);
  assert.match(shortTermTokens, /--asv-component-compare-canvas-header-height/);
  assert.match(shortTermTokens, /--asv-compare-metric-row-min-height/);
  assert.match(shortTermTokens, /--asv-component-settings-sheet-width/);
  assert.match(shortTermTokens, /--asv-component-settings-choice-height/);
  assert.match(shortTermTokens, /--asv-component-settings-choice-gap/);
  assert.match(shortTermTokens, /:root\[data-appearance="light"\]/);
  assert.match(shortTermTokens, /:root\[data-appearance="dark"\]/);
  assert.match(shortTermTokens, /:root:not\(\[data-appearance="light"\]\)/);
  assert.match(shortTermTokens, /--asv-playback-bar-height/);
  assert.match(shortTermTokens, /--asv-component-playback-progress-height/);
  assert.match(shortTermTokens, /--asv-playback-progress-min-width: var\(--asv-component-playback-progress-min-width\)/);
  assert.match(shortTermTokens, /--asv-playback-time-width: var\(--asv-component-playback-time-width\)/);
  assert.match(shortTermTokens, /--asv-component-status-strip-width/);
  assert.match(shortTermTokens, /--asv-component-fact-status-strip-width/);
  assert.match(shortTermTokens, /--asv-component-fact-cell-min-height: 60px/);
  assert.match(shortTermTokens, /--asv-fact-cell-meta-gap: var\(--asv-component-fact-cell-meta-gap\)/);
  assert.match(shortTermTokens, /--asv-component-row-index-width/);
  assert.match(shortTermTokens, /--asv-status-strip-width/);
  assert.match(shortTermTokens, /--asv-row-index-width/);
  assert.match(shortTermTokens, /--asv-focus-inset/);
  assert.match(shortTermTokens, /prefers-color-scheme: dark/);
  assert.match(shortTermTokens, /@media \(max-height: 780px\)/);
  assert.match(shortTermRecentFilesSurface, /clearRecentButton/);
  assert.match(shortTermAtoms, /button\.primary:disabled/);
  assert.match(shortTermAtoms, /\.spinner/);
  assert.match(shortTermAtoms, /\.thumb\.sequence/);
  assert.match(shortTermAtoms, /\.rowIndex/);
  assert.match(shortTermAtoms, /\.badge/);
  assert.match(shortTermAtoms, /\.emptyText\s*\{[^}]*background: transparent/s);
  assert.doesNotMatch(shortTermAtoms, /\.emptyText\s*\{[^}]*border: 1px dashed/s);
  assert.match(shortTermAtoms, /:focus-visible/);
  assert.match(shortTermMolecules, /\.toolbarButton/);
  assert.match(shortTermMolecules, /\.modeSwitch/);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*border: 0/s);
  assert.match(shortTermMolecules, /\.modeSwitch,[\s\S]*\.canvasModeSwitch\s*\{[^}]*background: var\(--asv-mode-switch-bg\)/s);
  assert.match(shortTermMolecules, /\.modeSwitch button\.isSelected,[\s\S]*\.canvasModeSwitch button\.isSelected\s*\{[^}]*background: var\(--asv-mode-selected-bg\)/s);
  assert.doesNotMatch(shortTermMolecules, /\.tabs/);
  assert.match(shortTermMolecules, /\.rowMenuButton/);
  assert.match(shortTermMolecules, /:focus-visible/);
  assert.doesNotMatch(shortTermComponents, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermComponents, /\.modeSwitch/);
  assert.doesNotMatch(shortTermComponents, /\.tabs/);
  assert.match(shortTermComponents, /\.factCell/);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*align-content: center/s);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*padding: 0/s);
  assert.match(shortTermComponents, /\.factCell\s*\{[^}]*box-shadow: none/s);
  assert.match(shortTermComponents, /\.factCell:nth-child\(5\)\s*\{[^}]*grid-column: 1 \/ -1/s);
  assert.match(shortTermComponents, /\.factCell::before\s*\{[^}]*display: none/s);
  assert.match(shortTermComponents, /\.factCell strong\s*\{[^}]*font-family: var\(--asv-font\)/s);
  assert.match(shortTermComponents, /\.factCell small\s*\{[^}]*margin-top: var\(--asv-fact-cell-meta-gap\)/s);
  assert.match(shortTermComponents, /\.assetRow/);
  assert.match(shortTermComponents, /\.assetRow\[data-attention="true"\]/);
  assert.match(shortTermComponents, /\.messageRow/);
  assert.match(shortTermComponents, /\.messageRow\[data-status="success"\]/);
  assert.doesNotMatch(shortTermComponents, /\.reservedNotice/);
  assert.match(shortTermComponents, /\.stateCard\.error::before/);
  assert.match(shortTermComponents, /\.appDialog\[data-status="warning"\]::before/);
  assert.match(shortTermComponents, /\.dialogHeader/);
  assert.match(shortTermComponents, /\.dialogActions/);
  assert.match(shortTermComponents, /\.settingsDialog/);
  assert.match(shortTermComponents, /\.settingsGroup/);
  assert.match(shortTermComponents, /\.settingsChoiceGroup/);
  assert.match(shortTermComponents, /\.settingsChoice/);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:checked\)/);
  assert.match(shortTermComponents, /\.settingsChoice:has\(input:focus-visible\)/);
  assert.match(shortTermComponents, /\.contextMenu button:disabled/);
  assert.match(shortTermModules, /\.toolbarCluster/);
  assert.match(shortTermModules, /\.rightPanel/);
  assert.match(shortTermModules, /box-shadow: inset var\(--asv-right-panel-separator-width\) 0 0 var\(--asv-right-panel-separator\)/);
  assert.match(shortTermModules, /\.rightSurfaceBody\s*\{[^}]*background: var\(--asv-right-panel\)/s);
  assert.match(shortTermModules, /\.launchDropIcon\s*\{/);
  assert.match(shortTermModules, /\.recentClearButton\s*\{/);
  assert.doesNotMatch(shortTermModules, /inspector/);
  assert.match(shortTermModules, /grid-template-columns: var\(--asv-window-controls-width\) minmax\(0, 1fr\)/);
  assert.match(shortTermModules, /\.titlebar\s*\{[\s\S]*background: transparent/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader \.toolbarButton\s*\{[^}]*background: var\(--asv-toolbar-control-bg\)/s);
  assert.match(shortTermModules, /\.rightSurfaceHeader \.toolbarButton\.primary\s*\{[^}]*background: var\(--asv-action\)/s);
  assert.match(shortTermModules, /\.canvasModeSwitch\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.compareCanvasWrap\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermModules, /\.compareCanvasSurface\s*\{[^}]*position: relative/s);
  assert.match(shortTermModules, /\.compareCanvasSurface\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\) auto/s);
  assert.match(shortTermModules, /\.compareCanvasOpenButton\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.compareCanvasWrap\[data-compare-state="loaded"\] \.compareCanvasOpenButton\s*\{[^}]*display: none/s);
  assert.match(shortTermModules, /\.comparePlaybackBar\s*\{[^}]*pointer-events: none/s);
  assert.match(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.compareCanvasHeader\s*\{[^}]*background: transparent/s);
  assert.match(shortTermModules, /\.layerPanel\s*\{[^}]*box-shadow: inset calc\(-1 \* var\(--asv-right-panel-separator-width\)\) 0 0 var\(--asv-right-panel-separator\)/s);
  assert.match(shortTermModules, /\.reservedPanel\s*\{[^}]*box-shadow: inset var\(--asv-right-panel-separator-width\) 0 0 var\(--asv-right-panel-separator\)/s);
  assert.match(shortTermModules, /background: var\(--asv-panel-chrome\)/);
  assert.match(shortTermModules, /\.resultGroup/);
  assert.match(shortTermModules, /\.resultGroup\s*\{[^}]*border: 0/s);
  assert.match(shortTermModules, /\.resultGroup\s*\{[^}]*box-shadow: inset var\(--asv-status-rail-width\) 0 0 var\(--asv-subtle-border\)/s);
  assert.match(shortTermModules, /\.optimizationMetricGrid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(shortTermModules, /\.optimizationMetricGrid \.compareMetricCell\s*\{[^}]*background: var\(--asv-fact-bg\)/s);
  assert.match(shortTermModules, /\.optimizationActions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(shortTermModules, /\.rightSurfaceBody:focus-visible/);
  assert.match(shortTermModules, /\.saveBanner\[data-status="success"\]::before/);
  assert.match(shortTermModules, /\.saveBanner\[data-status="loading"\]::before/);
  assert.doesNotMatch(shortTermModules, /\.canvasWrap\[data-canvas-label\]::before/);
  assert.match(shortTermModules, /\.playbackActions/);
  assert.match(shortTermModules, /\.playbackBar\s*\{[^}]*position: absolute/s);
  assert.match(shortTermModules, /\.playbackBar\s*\{[^}]*background: transparent/s);
  assert.match(shortTermModules, /\.playbackIconButton/);
  assert.match(shortTermModules, /\.playbackIconButton\[data-playback-state="playing"\] \.playbackIconPause/);
  assert.match(shortTermModules, /var\(--asv-playback-primary-size\)/);
  assert.match(shortTermModules, /var\(--asv-playback-control-size\)/);
  assert.match(shortTermModules, /\.playbackProgress/);
  assert.match(shortTermModules, /--asv-playback-progress: 0%/);
  assert.match(shortTermModules, /width: var\(--asv-playback-progress\)/);
  assert.match(shortTermModules, /\.playbackTime/);
  assert.match(shortTermModules, /\.playbackMeta/);
  assert.doesNotMatch(shortTermModules, /\.textPreviewActions/);
  assert.match(shortTermModules, /\.compareCanvasHeader/);
  assert.match(shortTermModules, /\.comparePairHeader/);
  assert.match(shortTermModules, /\.compareMetricRow/);
  assert.match(shortTermModules, /\.compareMetricCell/);
  assert.match(shortTermModules, /\.compareSummary/);
  assert.match(shortTermModules, /\.compareModeHeader/);
  assert.match(shortTermModules, /\.compareMetricGrid/);
  assert.match(shortTermModules, /\.compareActions/);
  assert.match(shortTermModules, /\.dragDecisionOverlay/);
  assert.match(shortTermModules, /\.canvasToast/);
  assert.match(shortTermModules, /var\(--asv-drag-overlay-bg\)/);
  assert.match(shortTermModules, /var\(--asv-drag-supported-bg\)/);
  assert.match(shortTermModules, /var\(--asv-drag-unsupported-bg\)/);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="launch"\]/);
  assert.match(shortTermPageStates, /\.launchView\s*\{[^}]*place-items: stretch/s);
  assert.match(shortTermPageStates, /\.saveBanner\s*\{[^}]*grid-row: 1/s);
  assert.match(shortTermPageStates, /\.macApp\[data-app-state="preview"\] \.view,[\s\S]*\.macApp\[data-app-state="compare"\] \.view,[\s\S]*\.macApp\[data-app-state="edit"\] \.view\s*\{[^}]*grid-row: 2/s);
  assert.match(shortTermPageStates, /\.previewView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.compareView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.editView\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/s);
  assert.match(shortTermPageStates, /\.previewView/);
  assert.match(shortTermPageStates, /\.compareView/);
  assert.match(shortTermPageStates, /\.editView/);
  assert.match(shortTermPageStates, /--asv-right-panel-width/);
  assert.doesNotMatch(shortTermPageStates, /inspector/);
  assert.match(shortTermPageStates, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shortTermPageStates, /@media \(max-height: 780px\)/);
  assert.match(shortTermStyles, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.doesNotMatch(shortTermStyles, /button\.primary:disabled/);
  assert.doesNotMatch(shortTermStyles, /\.toolbarCluster|\.resultGroup|\.previewView|\.compareView/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-dom-renderers\.mjs"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-edit-reserved-renderers\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-renderers\.mjs"/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-launch-renderers\.mjs"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-overview-renderers\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /from "\.\/short-term-macos-resource-menu-renderers\.mjs"/);
  assert.match(shortTermFeedbackSurface, /from "\.\/short-term-macos-save-renderers\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-state-renderers\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /from "\.\/short-term-macos-text-renderers\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-replaceable-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-output-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-file-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-runtime-text-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-settings-surface\.mjs"/);
  assert.match(shortTermState, /loadStoredAppearance/);
  assert.match(shortTermAppearanceModel, /APPEARANCE_VALUES = Object\.freeze\(\["system", "light", "dark"\]\)/);
  assert.match(shortTermSettingsSurface, /applyShortTermAppearance/);
  assert.match(shortTermSettingsSurface, /openShortTermSettings/);
  assert.match(shortTermController, /async function openCompareAFromHost/);
  assert.match(shortTermEventBindings, /action === "open-compare-a"/);
  assert.match(shortTermCommandState, /appearance/);
  assert.match(shortTermCommandState, /compare: \{ enabled: true, reason: "" \}/);
  assert.match(shortTermCommandState, /canCompare: true/);
  assert.match(shortTermCommandSurface, /appearance: state\.appearance/);
  assert.match(shortTermActionBridge, /openSettings: handlers\.openSettings/);
  assert.match(shortTermActionBridge, /setAppearance: handlers\.setAppearance/);
  assert.match(shortTermEventBindings, /data-appearance-choice/);
  assert.match(main, /label: "设置\.\.\."/);
  assert.match(main, /label: "外观"/);
  assert.match(main, /label: "跟随系统"/);
  assert.match(main, /invokeShortTermAction\("setAppearance", "dark", \{ persist: true \}\)/);
  assert.match(shortTermCompareSurface, /applyCompareSlotView/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView/);
  assert.match(shortTermRuntimeTextSurface, /applyRuntimeTextOverlay/);
  assert.match(shortTermRuntimeTextSurface, /clearRuntimeTextOverlay/);
  assert.match(shortTermFeedbackSurface, /clearSaveFeedbackBanner/);
  assert.match(shortTermResourceMenuSurface, /hideResourceContextMenu/);
  assert.match(shortTermFeedbackSurface, /hideSaveFeedbackBanner/);
  assert.match(shortTermCompareSurface, /markCompareSlotLoaded/);
  assert.match(shortTermOptimizationSurface, /prependOptimizationResult/);
  assert.match(shortTermPreviewSurface, /renderAssetList/);
  assert.match(shortTermCompareSurface, /renderCompareInfoPanel/);
  assert.match(shortTermController, /renderDiscardMessage/);
  assert.match(shortTermFeedbackSurface, /renderFailureMessage/);
  assert.match(shortTermPreviewSurface, /renderFileHeader/);
  assert.match(shortTermFileSurface, /renderLoadingMessage/);
  assert.match(shortTermOptimizationSurface, /renderOptimizationFindings/);
  assert.match(shortTermPreviewSurface, /renderOverviewFacts/);
  assert.match(shortTermReplaceableSurface, /renderReplaceableImages/);
  assert.match(shortTermReplaceableSurface, /renderRuntimeTextElements/);
  assert.match(shortTermFeedbackSurface, /showSaveFeedbackBanner/);
  assert.match(shortTermOutputSurface, /showShortTermSaveBanner/);
  assert.match(shortTermResourceMenuSurface, /showResourceContextMenu/);
  assert.match(shortTermCommandSurface, /from "\.\/short-term-macos-command-state\.mjs"/);
  assert.match(shortTermCommandSurface, /buildCommandState/);
  assert.match(shortTermController, /from "\.\/short-term-macos-compare-surface\.mjs"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-drag-decision-surface\.mjs"/);
  assert.match(shortTermController, /showCanvasDragDecision/);
  assert.match(shortTermController, /dropCanvasFile/);
  assert.match(shortTermController, /resetShortTermLaunchSurface/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-model\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-compare-renderers\.mjs"/);
  assert.match(shortTermCompareSurface, /renderCompareInfoHtml/);
  assert.match(shortTermCompareSurface, /renderOptimizationCompareResultHtml/);
  assert.match(shortTermCompareSurface, /renderGeneralComparePlaceholderHtml/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-compare-model\.mjs"|from "\.\/short-term-macos-compare-renderers\.mjs"|renderCompareInfoHtml|renderOptimizationCompareResultHtml|renderGeneralComparePlaceholderHtml|applyCompareSlotView|applyCompareTraceView|markCompareSlotLoaded|renderCompareInfoPanel/);
  assert.match(shortTermDragDecisionModel, /isSupportedShortTermDropFile/);
  assert.match(shortTermDragDecisionModel, /\.svga\$\/i/);
  assert.match(shortTermDragDecisionModel, /dragDecisionZoneForEvent/);
  assert.match(shortTermDragDecisionSurface, /showShortTermDragDecisionOverlay/);
  assert.match(shortTermDragDecisionSurface, /showShortTermCanvasToast/);
  assert.match(shortTermDragDecisionSurface, /不支持的文件格式/);
  assert.match(shortTermController, /from "\.\/short-term-macos-feedback-surface\.mjs"/);
  assert.match(shortTermOutputSurface, /showShortTermOutputBanner/);
  assert.match(shortTermController, /showShortTermOutputBanner\(\{ nodes, title, message, tone \}\)/);
  assert.match(shortTermController, /showShortTermFailure\(\{ nodes, setView \}, error\)/);
  assert.match(shortTermController, /showShortTermOperationFailure\(\{ nodes, state, setMode, renderCommandState \}, title, error\)/);
  assert.match(shortTermController, /shortTermCurrentStateSummary\(\{ nodes, state \}\)/);
  assert.match(shortTermFeedbackSurface, /from "\.\/short-term-macos-feedback-model\.mjs"/);
  assert.match(shortTermFeedbackSurface, /buildCurrentStateSummary/);
  assert.match(shortTermFeedbackSurface, /sourceUnmodifiedMessage/);
  assert.doesNotMatch(shortTermEntry, /showSaveFeedbackBanner|clearSaveFeedbackBanner|hideSaveFeedbackBanner|renderFailureMessage|buildCurrentStateSummary|sourceUnmodifiedMessage/);
  assert.match(shortTermOutputSurface, /clearShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermOutputSurface, /showShortTermOutputBanner\(\{ nodes, title, message: summary \}\)/);
  assert.match(shortTermOutputSurface, /state\.activeOutput = \{/);
  assert.match(shortTermOutputSurface, /state\.saveStatus = "dirty"/);
  assert.match(shortTermOutputSurface, /state\.saveStatus = "idle"/);
  assert.doesNotMatch(shortTermEntry, /state\.activeOutput = \{[\s\S]*state\.saveStatus = "dirty"|clearShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermEntry, /saveBannerView/);
  assert.doesNotMatch(shortTermEntry, /saveBanner\.innerHTML = `<strong>\$\{escapeHtml\(title\)\}/);
  assert.doesNotMatch(shortTermEntry, /\$\{message \|\| "未知错误"\} 源文件没有被修改。/);
  assert.match(shortTermController, /from "\.\/short-term-macos-recent-files-surface\.mjs"/);
  assert.match(shortTermController, /refreshShortTermRecentFiles\(\{ bridge, nodes \}\)/);
  assert.match(shortTermController, /clearShortTermRecentFiles\(\{ bridge, nodes \}\)/);
  assert.match(shortTermRecentFilesSurface, /visibleLaunchRecentRecords/);
  assert.match(shortTermRecentFilesSurface, /renderLaunchRecentFiles/);
  assert.match(shortTermRecentFilesSurface, /renderRecentFilesUnavailable/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-recent-files-model\.mjs"/);
  assert.match(shortTermRecentFilesSurface, /from "\.\/short-term-macos-host-client\.mjs"/);
  assert.match(shortTermHostClient, /export async function getRecentSvgaFiles/);
  assert.match(shortTermHostClient, /export async function clearRecentSvgaFiles/);
  assert.match(shortTermHostClient, /export function syncShortTermMenuState/);
  assert.match(shortTermController, /state\.lastMenuStateSnapshot = renderShortTermCommandSurface/);
  assert.match(shortTermCommandSurface, /syncShortTermMenuState/);
  assert.doesNotMatch(shortTermEntry, /bridge\.getRecentSvgaFiles|bridge\.clearRecentSvgaFiles|bridge\.updateShortTermMenuState|visibleLaunchRecentRecords|renderLaunchRecentFiles|renderRecentFilesUnavailable/);
  assert.match(shortTermHostClient, /bridge\.getRecentSvgaFiles/);
  assert.match(shortTermHostClient, /bridge\.clearRecentSvgaFiles/);
  assert.match(shortTermHostClient, /bridge\.updateShortTermMenuState/);
  assert.doesNotMatch(shortTermEntry, /暂无最近打开记录|仅显示文件名和父级位置|最近文件由 macOS 客户端提供/);
  assert.match(shortTermController, /from "\.\/short-term-macos-save-surface\.mjs"/);
  assert.match(shortTermSaveSurface, /from "\.\/short-term-macos-save-model\.mjs"/);
  assert.match(shortTermSaveSurface, /saveProofSourceImageKey/);
  assert.match(shortTermSaveSurface, /saveProofImageKey/);
  assert.match(shortTermSaveSurface, /createSaveFailureProofActiveOutput/);
  assert.doesNotMatch(shortTermEntry, /保存失败验证输出/);
  assert.match(shortTermController, /from "\.\/short-term-macos-dom-state\.mjs"/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-nodes\.mjs"/);
  assert.match(shortTermEntry, /collectShortTermNodes/);
  assert.doesNotMatch(shortTermEntry, /const nodes = \{\s*app: document\.querySelector\("\.macApp"\)/);
  assert.match(shortTermNodes, /export function collectShortTermNodes\(\)/);
  assert.match(shortTermNodes, /app: document\.querySelector\("\.macApp"\)/);
  assert.match(shortTermNodes, /replacementFileInput: document\.querySelector\("#replacementFileInput"\)/);
  assert.match(shortTermController, /from "\.\/short-term-macos-command-surface\.mjs"/);
  assert.match(shortTermCommandSurface, /export function renderShortTermCommandSurface/);
  assert.match(shortTermCommandSurface, /buildCommandState\(\{/);
  assert.match(shortTermCommandSurface, /applyCommandState\(commandState\)/);
  assert.match(shortTermCommandSurface, /dialogOpen: hasOpenDialog\(documentRef\)/);
  assert.match(shortTermController, /applyViewState/);
  assert.match(shortTermController, /applyModeButtons/);
  assert.match(shortTermController, /from "\.\/short-term-macos-navigation-surface\.mjs"/);
  assert.match(shortTermNavigationSurface, /applyTabState/);
  assert.match(shortTermReplaceableSurface, /setActionEnabled/);
  assert.match(shortTermCommandState, /export function buildCommandState/);
  assert.match(shortTermCommandState, /actionStates/);
  assert.doesNotMatch(shortTermEntry, /applyCommandState\(commandState\)|buildCommandState\(\{|dialogOpen: hasOpenDialog\(document\)/);
  assert.doesNotMatch(shortTermEntry, /Object\.entries\(commandState\.actionStates\)|document\.querySelector\("\[data-action='play-pause'\]"\)\.textContent = commandState\.playPauseCopy/);
  assert.match(shortTermDomState, /Object\.entries\(commandState\.actionStates\)/);
  assert.match(shortTermDomState, /setActionEnabled\(action, actionState\.enabled, actionState\.reason\)/);
  assert.match(shortTermDomState, /playPauseButton\.dataset\.playbackState = playing \? "playing" : "paused"/);
  assert.match(shortTermDomState, /playPauseButton\.setAttribute\("aria-label", commandState\.playPauseCopy\)/);
  assert.doesNotMatch(shortTermDomState, /textContent = commandState\.playPauseCopy/);
  assert.match(shortTermCommandState, /"run-optimization": \{ enabled: canRunOptimization, reason: "没有可安全执行的优化项" \}/);
  assert.match(shortTermCommandState, /"save-overwrite": \{ enabled: canOverwrite/);
  assert.match(shortTermCommandState, /playPauseCopy: input\.primaryPlaybackPlaying \? "暂停" : "播放"/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermCommandState, /hasTransientState/);
  assert.match(shortTermCompareModel, /export function renderCompareInfoHtml/);
  assert.match(shortTermCompareModel, /export function compareSlotMeta/);
  assert.match(shortTermCompareModel, /export function compareSlotView/);
  assert.match(shortTermCompareModel, /export function generalCompareTraceView/);
  assert.match(shortTermCompareModel, /export function optimizationCompareTraceView/);
  assert.match(shortTermCompareModel, /GeneralCompareModule/);
  assert.match(shortTermCompareModel, /OptimizationCompareModule/);
  assert.match(shortTermCompareModel, /export function renderOptimizationCompareResultHtml/);
  assert.match(shortTermCompareModel, /export function renderGeneralComparePlaceholderHtml/);
  assert.match(shortTermCompareModel, /export function renderGeneralComparePanelHtml/);
  assert.match(shortTermCompareModel, /comparePairHeader/);
  assert.match(shortTermCompareModel, /compareModeHeader/);
  assert.match(shortTermCompareModel, /compareMetricRow/);
  assert.match(shortTermCompareModel, /renderCompareFactCellHtml/);
  assert.match(shortTermCompareModel, /renderCompareMetricCellHtml/);
  assert.match(shortTermCompareModel, /data-optimization-actions/);
  assert.match(shortTermCompareModel, /data-optimization-skipped/);
  assert.doesNotMatch(shortTermCompareModel, /打开另一个 SVGA 后开始对比/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createOverviewFactCell|export function createAssetRow|export function renderOverviewFacts|export function renderAssetList|renderOverviewFactCellHtml/);
  assert.match(shortTermOverviewRenderers, /export function createOverviewFactCell/);
  assert.match(shortTermOverviewRenderers, /export function createAssetRow/);
  assert.match(shortTermOverviewRenderers, /export function renderOverviewFacts/);
  assert.match(shortTermOverviewRenderers, /export function renderAssetList/);
  assert.match(shortTermOverviewRenderers, /renderOverviewFactCellHtml/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createOptimizationFindingRow|export function renderOptimizationFindings|export function prependOptimizationResult|export function createMessageRow|renderOptimizationFindingHtml|renderMessageRowHtml/);
  assert.match(shortTermOptimizationRenderers, /export function createOptimizationFindingRow/);
  assert.match(shortTermOptimizationRenderers, /export function renderOptimizationFindings/);
  assert.match(shortTermOptimizationRenderers, /export function prependOptimizationResult/);
  assert.match(shortTermOptimizationRenderers, /export function createMessageRow/);
  assert.match(shortTermOptimizationRenderers, /from "\.\/short-term-macos-inline-status-renderers\.mjs"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createInlineStatusText/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /from "\.\/short-term-macos-inline-status-renderers\.mjs"/);
  assert.match(shortTermInlineStatusRenderers, /export function createInlineStatusText/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function showSaveFeedbackBanner|export function hideSaveFeedbackBanner|export function clearSaveFeedbackBanner|saveBannerView/);
  assert.match(shortTermSaveRenderers, /export function showSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /export function hideSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /export function clearSaveFeedbackBanner/);
  assert.match(shortTermSaveRenderers, /saveBannerView/);
  assert.match(shortTermSaveRenderers, /node\.innerHTML = view\.html/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function renderLoadingMessage|export function renderFileHeader|export function renderDiscardMessage|export function renderFailureMessage/);
  assert.match(shortTermStateRenderers, /export function renderLoadingMessage/);
  assert.match(shortTermStateRenderers, /export function renderFileHeader/);
  assert.match(shortTermStateRenderers, /export function renderDiscardMessage/);
  assert.match(shortTermStateRenderers, /export function renderFailureMessage/);
  assert.match(shortTermStateRenderers, /nodes\.loadingMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.fileIdentity\.textContent = displayName/);
  assert.match(shortTermStateRenderers, /nodes\.discardMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.errorMessage\.textContent = copy/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function applyCompareSlotView|export function markCompareSlotLoaded|export function applyCompareTraceView|export function renderCompareInfoPanel/);
  assert.match(shortTermCompareRenderers, /export function applyCompareSlotView/);
  assert.match(shortTermCompareRenderers, /export function markCompareSlotLoaded/);
  assert.match(shortTermCompareRenderers, /export function applyCompareTraceView/);
  assert.match(shortTermCompareRenderers, /export function renderCompareInfoPanel/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function showResourceContextMenu|export function hideResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /export function showResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /export function hideResourceContextMenu/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.left = view\.left/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled = view\.resetDisabled/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function applyRuntimeTextOverlay|export function clearRuntimeTextOverlay/);
  assert.match(shortTermTextRenderers, /export function applyRuntimeTextOverlay/);
  assert.match(shortTermTextRenderers, /export function clearRuntimeTextOverlay/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function createReplaceableImageRow|export function renderReplaceableImages|export function createTextElementRow|export function renderRuntimeTextElements|ReplaceableImageRow|ReplaceableTextRow/);
  assert.match(shortTermReplaceableRenderers, /export function createReplaceableImageRow/);
  assert.match(shortTermReplaceableRenderers, /export function renderReplaceableImages/);
  assert.match(shortTermReplaceableRenderers, /export function createTextElementRow/);
  assert.match(shortTermReplaceableRenderers, /export function renderRuntimeTextElements/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /from "\.\/short-term-macos-inline-status-renderers\.mjs"/);
  assert.match(shortTermReplaceableRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermEditReservedRenderers, /export function createEditLayerRow/);
  assert.match(shortTermEditReservedRenderers, /export function renderEditReservedLayers/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /function renderThumbnailHtml|isSafeImageDataUrl/);
  assert.match(shortTermEditReservedRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermOverviewRenderers, /from "\.\/short-term-macos-thumbnail-renderers\.mjs"/);
  assert.match(shortTermThumbnailRenderers, /export function renderThumbnailHtml/);
  assert.match(shortTermThumbnailRenderers, /isSafeImageDataUrl/);
  assert.match(shortTermThumbnailRenderers, /sequence-four-grid/);
  assert.match(shortTermDomState, /export function applyViewState/);
  assert.match(shortTermDomState, /export function applyModeButtons/);
  assert.match(shortTermDomState, /export function applyTabState/);
  assert.match(shortTermDomState, /export function setActionEnabled/);
  assert.match(shortTermDomState, /export function applyCommandState/);
  assert.match(shortTermDomState, /document\.querySelectorAll\("\[data-view\]"\)/);
  assert.match(shortTermDomState, /const activePanel = tab === "optimization" \? "optimization" : "overview"/);
  assert.match(shortTermDomState, /scrollIntoView\?\.\(\{ block: "nearest" \}\)/);
  assert.match(shortTermDomState, /aria-pressed/);
  assert.match(shortTermFeedbackModel, /export function bannerTone/);
  assert.match(shortTermFeedbackModel, /export function saveBannerView/);
  assert.match(shortTermFeedbackModel, /export function sourceUnmodifiedMessage/);
  assert.match(shortTermFeedbackModel, /escapeHtml\(title\)/);
  assert.match(shortTermFeedbackModel, /escapeHtml\(message \|\| ""\)/);
  assert.match(shortTermFeedbackModel, /源文件没有被修改。/);
  assert.match(shortTermFileSurface, /renderLoadingMessage\(nodes, "正在打开最近文件。"\)/);
  assert.match(shortTermFileSurface, /renderLoadingMessage\(nodes, "解析文件并准备预览。"\)/);
  assert.match(shortTermFileSurface, /renderFileHeader\(nodes, "等待打开文件", "-"\)/);
  assert.match(shortTermPreviewSurface, /renderFileHeader\(nodes, state\.displayName, overviewView\.playbackMeta\)/);
  assert.match(shortTermController, /renderMessage: \(copy\) => renderDiscardMessage\(nodes, copy\)/);
  assert.match(shortTermDialogModel, /renderMessage\(message\)/);
  assert.match(shortTermFeedbackSurface, /renderFailureMessage\(nodes, sourceUnmodifiedMessage\(message\)\)/);
  assert.match(shortTermFileSurface, /state\.sourceBytes = new Uint8Array\(bytes\)/);
  assert.match(shortTermFileSurface, /state\.sourceBytes = undefined/);
  assert.match(shortTermFileSurface, /clearRuntimeTextOverlay\(nodes\.runtimeTextOverlay\)/);
  assert.match(shortTermFileSurface, /hideShortTermSaveBanner\(nodes\)/);
  assert.doesNotMatch(shortTermEntry, /nodes\.(loadingMessage|fileIdentity|playbackMeta|discardMessage|errorMessage)\.textContent\s*=/);
  assert.doesNotMatch(shortTermEntry, /renderLoadingMessage\(nodes, "正在打开最近文件。"\)|renderLoadingMessage\(nodes, "解析文件并准备预览。"\)|renderFileHeader\(nodes, "等待打开文件", "-"\)|state\.sourceBytes = new Uint8Array\(bytes\)|state\.sourceBytes = undefined|hideShortTermSaveBanner\(nodes\)/);
  assert.match(shortTermStateRenderers, /nodes\.loadingMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.fileIdentity\.textContent = displayName/);
  assert.match(shortTermStateRenderers, /nodes\.playbackMeta\.textContent = playbackMeta/);
  assert.match(shortTermStateRenderers, /nodes\.discardMessage\.textContent = copy/);
  assert.match(shortTermStateRenderers, /nodes\.errorMessage\.textContent = copy/);
  assert.match(shortTermPreviewSurface, /renderOverviewFacts\(nodes, overviewView\)/);
  assert.match(shortTermPreviewSurface, /renderAssetList\(nodes, overviewView, model\)/);
  assert.doesNotMatch(shortTermEntry, /createOverviewFactCell|createAssetRow|nodes\.factGrid\.replaceChildren|nodes\.assetList\.replaceChildren/);
  assert.match(shortTermOverviewRenderers, /nodes\.factGrid\.replaceChildren/);
  assert.match(shortTermOverviewRenderers, /nodes\.assetList\.replaceChildren/);
  assert.match(shortTermFeedbackModel, /export function buildCurrentStateSummary/);
  assert.match(shortTermFeedbackModel, /export function viewCopy/);
  assert.match(shortTermFeedbackModel, /Auto SVGA 状态摘要/);
  assert.match(shortTermFeedbackModel, /状态：\$\{viewCopy\(input\.view\)\}/);
  assert.match(shortTermFeedbackModel, /未保存输出：/);
  assert.match(shortTermRecentFilesModel, /export const LAUNCH_RECENT_LIMIT = 5/);
  assert.match(shortTermRecentFilesModel, /export function visibleLaunchRecentRecords/);
  assert.doesNotMatch(shortTermRecentFilesModel, /document\.createElement|innerHTML|replaceChildren|textContent|clearButton\.disabled|data-action="open-recent"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /export function renderLaunchRecentFiles|export function renderRecentFilesUnavailable|export function createRecentFileRow|export function createEmptyRecentFileRow/);
  assert.match(shortTermLaunchRenderers, /export function renderLaunchRecentFiles/);
  assert.match(shortTermLaunchRenderers, /export function renderRecentFilesUnavailable/);
  assert.match(shortTermLaunchRenderers, /clearButton\.disabled = records\.length === 0/);
  assert.match(shortTermLaunchRenderers, /data-action="open-recent"/);
  assert.match(shortTermLaunchRenderers, /data-recent-id/);
  assert.match(shortTermLaunchRenderers, /暂无最近打开记录/);
  assert.match(shortTermLaunchRenderers, /noteNode\.hidden = true/);
  assert.doesNotMatch(shortTermLaunchRenderers, /仅显示文件名和父级位置|最近文件由 macOS 客户端提供/);
  assert.match(shortTermSaveModel, /export function saveProofImageKey/);
  assert.match(shortTermSaveModel, /export function saveProofSourceImageKey/);
  assert.match(shortTermSaveModel, /export function createSaveFailureProofActiveOutput/);
  assert.match(shortTermSaveModel, /kind: "rename"/);
  assert.match(shortTermSaveModel, /保存失败验证输出/);
  assert.match(shortTermSaveModel, /保存后重开验证应失败，当前源文件保持不变。/);
  assert.doesNotMatch(shortTermNavigationSurface, /from "\.\/short-term-macos-interaction-model\.mjs"|nextTabIndexForKey|consumeKeyboardEvent/);
  assert.match(shortTermInteractionModel, /export function consumeKeyboardEvent/);
  assert.match(shortTermInteractionModel, /export function isActivationKey/);
  assert.match(shortTermInteractionModel, /export function isContextMenuKey/);
  assert.match(shortTermInteractionModel, /export function isTextEditingTarget/);
  assert.match(shortTermInteractionModel, /export function shouldHandleGlobalPlaybackShortcut/);
  assert.match(shortTermInteractionModel, /export function enabledMenuItems/);
  assert.match(shortTermInteractionModel, /export function nextMenuItemIndexForKey/);
  assert.match(shortTermInteractionModel, /key === "ArrowDown"/);
  assert.match(shortTermInteractionModel, /key === "ArrowUp"/);
  assert.match(shortTermInteractionModel, /key === "Home"/);
  assert.match(shortTermInteractionModel, /key === "End"/);
  assert.match(shortTermInteractionModel, /event\.key === "Spacebar"/);
  assert.match(shortTermInteractionModel, /event\.key === "ContextMenu"/);
  assert.match(shortTermInteractionModel, /event\.shiftKey && event\.key === "F10"/);
  assert.match(shortTermInteractionModel, /"\[role='menuitem'\]"/);
  assert.doesNotMatch(shortTermInteractionModel, /"\[role='tab'\]"/);
  assert.match(shortTermController, /from "\.\/short-term-macos-resource-menu-surface\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /from "\.\/short-term-macos-resource-menu-model\.mjs"/);
  assert.match(shortTermResourceMenuSurface, /keyboardResourceMenuAnchor/);
  assert.match(shortTermResourceMenuSurface, /resourceContextMenuView/);
  assert.match(shortTermResourceMenuSurface, /showResourceContextMenu\(menu, view\)/);
  assert.match(shortTermResourceMenuSurface, /hideResourceContextMenu\(nodes\.resourceContextMenu\)/);
  assert.match(shortTermController, /handleResourceContextMenuKeydown/);
  assert.match(shortTermResourceMenuSurface, /export function handleShortTermResourceMenuKeydown/);
  assert.match(shortTermResourceMenuSurface, /enabledMenuItems\(nodes\.resourceContextMenu\)/);
  assert.match(shortTermResourceMenuSurface, /nextMenuItemIndexForKey\(event\.key, currentIndex, items\.length\)/);
  assert.match(shortTermEventBindings, /nodes\.resourceContextMenu\.addEventListener\("keydown", handlers\.handleResourceContextMenuKeydown\)/);
  assert.match(shortTermState, /resourceMenuReturnFocus/);
  assert.match(shortTermResourceMenuSurface, /event: keyboardResourceMenuAnchor\(rect\)/);
  assert.match(shortTermEventBindings, /handlers\.openResourceContextMenu\(event, target\.dataset\.imageKey, target\)/);
  assert.match(shortTermEventBindings, /handlers\.closeResourceContextMenu\(\{ restoreFocus: true \}\)/);
  assert.match(shortTermSmokeRunner, /closeResourceContextMenu\(\{ restoreFocus: true \}\)/);
  assert.match(shortTermResourceMenuSurface, /returnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(shortTermEntry, /keyboardResourceMenuAnchor|resourceContextMenuView|showResourceContextMenu|hideResourceContextMenu|enabledMenuItems|nextMenuItemIndexForKey/);
  assert.doesNotMatch(shortTermEntry, /menu\.hidden = false|menu\.style\.left = view\.left|menu\.style\.top = view\.top|menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled|menu\.querySelector\("button:not\(:disabled\)"\)\?\.focus/);
  assert.match(shortTermResourceMenuRenderers, /menu\.hidden = false/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.left = view\.left/);
  assert.match(shortTermResourceMenuRenderers, /menu\.style\.top = view\.top/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("\[data-action='context-reset'\]"\)\.disabled = view\.resetDisabled/);
  assert.match(shortTermResourceMenuRenderers, /menu\.querySelector\("button:not\(:disabled\)"\)\?\.focus/);
  assert.doesNotMatch(shortTermEntry, /context-reset[\s\S]{0,120}activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermResourceMenuModel, /export function keyboardResourceMenuAnchor/);
  assert.match(shortTermResourceMenuModel, /export function resourceContextMenuView/);
  assert.match(shortTermResourceMenuModel, /MENU_EDGE_INSET = 8/);
  assert.match(shortTermResourceMenuModel, /KEYBOARD_MENU_Y_LIMIT = 28/);
  assert.match(shortTermResourceMenuModel, /input\.activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-text-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /runtimeTextListView/);
  assert.match(shortTermController, /from "\.\/short-term-macos-runtime-text-surface\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /from "\.\/short-term-macos-text-model\.mjs"/);
  assert.match(shortTermRuntimeTextSurface, /runtimeTextOverlayCopy/);
  assert.match(shortTermReplaceableSurface, /selectedRuntimeTextElement/);
  assert.match(shortTermReplaceableSurface, /renderRuntimeTextElements\(nodes, view, state\.selectedTextKey\)/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-replaceable-renderers\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /createTextElementRow|nodes\.textElementList\.replaceChildren|nodes\.textPreviewSummary\.textContent =|nodes\.editTextButton\.hidden =|nodes\.resetTextButton\.hidden =/);
  assert.match(shortTermReplaceableRenderers, /nodes\.textElementList\.replaceChildren/);
  assert.match(shortTermReplaceableRenderers, /nodes\.textPreviewSummary\.textContent = view\.summaryCopy/);
  assert.match(shortTermReplaceableRenderers, /data-component="InlineTextReplacementInput"/);
  assert.match(shortTermReplaceableRenderers, /data-action="runtime-text-reset"/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /nodes\.editTextButton\.hidden|nodes\.resetTextButton\.hidden/);
  assert.match(shortTermRuntimeTextSurface, /export function focusShortTermRuntimeTextPreviewInput/);
  assert.match(shortTermRuntimeTextSurface, /export function applyShortTermRuntimeTextPreview/);
  assert.match(shortTermRuntimeTextSurface, /applyRuntimeTextOverlay\(\s*nodes\.runtimeTextOverlay,\s*runtimeTextOverlayCopy\(textElement, state\.textPreview\),\s*Boolean\(state\.textPreview\)\s*\)/s);
  assert.match(shortTermRuntimeTextSurface, /clearRuntimeTextOverlay\(nodes\.runtimeTextOverlay\)/);
  assert.doesNotMatch(shortTermEntry, /applyRuntimeTextOverlay|clearRuntimeTextOverlay|runtimeTextOverlayCopy\(textElement|from "\.\/short-term-macos-text-renderers\.mjs"|from "\.\/short-term-macos-text-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /nodes\.runtimeTextOverlay\.(hidden|textContent)\s*=/);
  assert.match(shortTermTextRenderers, /node\.textContent = copy/);
  assert.match(shortTermTextRenderers, /node\.hidden = !visible/);
  assert.match(shortTermTextRenderers, /node\.textContent = ""/);
  assert.match(shortTermTextModel, /export const RUNTIME_TEXT_DEFAULT_VALUE = "SVGA VIP"/);
  assert.match(shortTermTextModel, /export function runtimeTextInputValue/);
  assert.match(shortTermTextModel, /export function hasRuntimeTextPreview/);
  assert.match(shortTermTextModel, /export function runtimeTextPlaceholder/);
  assert.match(shortTermTextModel, /export function runtimeTextOverlayCopy/);
  assert.match(shortTermTextModel, /export function runtimeTextListView/);
  assert.match(shortTermTextModel, /export function nextSelectedTextKey/);
  assert.match(shortTermTextModel, /export function selectedRuntimeTextElement/);
  assert.doesNotMatch(shortTermTextModel, /当前文件没有可运行时预览的文本元素。/);
  assert.match(shortTermTextModel, /summaryCopy: `\(\$\{texts\.length\}\)`/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-replaceable-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /replaceableImageListView/);
  assert.match(shortTermReplaceableSurface, /nextReplaceableSelection/);
  assert.match(shortTermReplaceableSurface, /renderReplaceableImages\(nodes, view, state\.model\)/);
  assert.doesNotMatch(shortTermEntry, /replaceableImageListView|nextReplaceableSelection|renderReplaceableImages\(nodes, view, state\.model\)|renderRuntimeTextElements\(nodes, view, state\.selectedTextKey\)|selectedRuntimeTextElement/);
  assert.doesNotMatch(shortTermEntry, /createReplaceableImageRow|nodes\.replaceableList\.replaceChildren|nodes\.replaceableSummary\.textContent =/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableList\.replaceChildren/);
  assert.match(shortTermReplaceableRenderers, /nodes\.replaceableSummary\.textContent = view\.summaryCopy/);
  assert.match(shortTermReplaceableRenderers, /closest\("\.replaceableSection"\)\?\.setAttribute\("data-empty", view\.hasImages \? "false" : "true"\)/);
  assert.match(shortTermReplaceableRenderers, /closest\("\.textPreviewBlock"\)\?\.setAttribute\("data-empty", view\.hasTextElements \? "false" : "true"\)/);
  assert.match(shortTermModules, /\.replaceableSection\[data-empty="true"\]/);
  assert.match(shortTermModules, /\.textPreviewBlock\[data-empty="true"\]/);
  assert.doesNotMatch(shortTermEntry, /普通自动命名图片不会出现在这里。|没有可替换元素。|\$\{rows\.length\} 个设计师命名图片元素。/);
  assert.doesNotMatch(shortTermReplaceableRenderers, /createInlineStatusText/);
  assert.match(shortTermReplaceableModel, /export function replaceableImageListView/);
  assert.match(shortTermReplaceableModel, /export function nextReplaceableSelection/);
  assert.doesNotMatch(shortTermReplaceableModel, /没有可替换元素。/);
  assert.match(shortTermReplaceableModel, /summaryCopy: `\(\$\{images\.length\}\)`/);
  assert.match(shortTermController, /from "\.\/short-term-macos-optimization-surface\.mjs"/);
  assert.match(shortTermOptimizationSurface, /from "\.\/short-term-macos-optimization-model\.mjs"/);
  assert.match(shortTermOptimizationSurface, /optimizationTabView/);
  assert.match(shortTermOptimizationSurface, /optimizationResultTone/);
  assert.match(shortTermNodes, /runOptimizationButton: document\.querySelector\("\[data-action='run-optimization'\]"\)/);
  assert.match(shortTermOptimizationSurface, /renderOptimizationFindings\(nodes, optimizationTabView\(model\)\)/);
  assert.match(shortTermOptimizationSurface, /prependOptimizationResult\(nodes, model\.resultTitle, model\.resultSummary, tone\)/);
  assert.doesNotMatch(shortTermEntry, /createOptimizationFindingRow|createInlineStatusText|createMessageRow|nodes\.optimizationSummary\.textContent|nodes\.findingList\.replaceChildren|nodes\.findingList\.prepend/);
  assert.match(shortTermOptimizationSurface, /from "\.\/short-term-macos-optimization-renderers\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-optimization-model\.mjs"|from "\.\/short-term-macos-optimization-renderers\.mjs"|optimizationTabView|optimizationResultTone|prependOptimizationResult|renderOptimizationFindings/);
  assert.match(shortTermOptimizationRenderers, /nodes\.optimizationSummary\.textContent = view\.summaryCopy/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.textContent = view\.runButtonCopy/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.title = view\.runButtonTitle/);
  assert.match(shortTermOptimizationRenderers, /nodes\.runOptimizationButton\.disabled = view\.runButtonDisabled/);
  assert.match(shortTermOptimizationRenderers, /nodes\.findingList\.replaceChildren/);
  assert.match(shortTermOptimizationRenderers, /nodes\.findingList\.prepend/);
  assert.doesNotMatch(shortTermEntry, /暂无可执行优化项|批量执行当前可安全执行的优化项/);
  assert.match(shortTermOptimizationModel, /export function optimizationTabView/);
  assert.match(shortTermOptimizationModel, /export function optimizationResultTone/);
  assert.match(shortTermOptimizationModel, /groupOptimizationItems/);
  assert.match(shortTermOptimizationModel, /一键优化/);
  assert.match(shortTermOptimizationModel, /批量执行当前可安全执行的优化项/);
  assert.match(shortTermOptimizationModel, /暂无可执行优化项/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-overview-model\.mjs"/);
  assert.match(shortTermPreviewSurface, /overviewTabView/);
  assert.doesNotMatch(shortTermEntry, /overviewVisibleFacts/);
  assert.match(shortTermOverviewModel, /export function overviewTabView/);
  assert.match(shortTermOverviewModel, /overviewVisibleFacts/);
  assert.match(shortTermOverviewModel, /"canvas", "fps", "duration"/);
  assert.match(shortTermPreviewSurface, /from "\.\/short-term-macos-edit-reserved-model\.mjs"/);
  assert.match(shortTermPreviewSurface, /editReservedLayerListView/);
  assert.match(shortTermPreviewSurface, /renderEditReservedLayers\(nodes, editReservedLayerListView\(state\.model\), state\.model\)/);
  assert.doesNotMatch(shortTermEntry, /createEditLayerRow|nodes\.layerPanel\.replaceChildren/);
  assert.match(shortTermEditReservedRenderers, /nodes\.layerPanel\.replaceChildren/);
  assert.doesNotMatch(shortTermEntry, /\.filter\(\(asset\) => asset\.kind !== "audio"\)[\s\S]*\.slice\(0, 32\)/);
  assert.match(shortTermEditReservedModel, /export const EDIT_RESERVED_LAYER_LIMIT = 32/);
  assert.match(shortTermEditReservedModel, /export function editReservedLayerListView/);
  assert.match(shortTermEditReservedModel, /asset\.kind !== "audio"/);
  assert.match(shortTermEditReservedModel, /EDIT_RESERVED_LAYER_LIMIT/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-render-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-render-model\.mjs"/);
  assert.match(shortTermController, /function handleTabListKeydown/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-event-bindings\.mjs"/);
  assert.match(shortTermEntry, /bindShortTermInteractionEvents\(\{/);
  assert.match(shortTermEventBindings, /export function bindShortTermInteractionEvents/);
  assert.match(shortTermEventBindings, /bindCanvasDragDecision/);
  assert.match(shortTermEventBindings, /handlers\.dropCanvasFile/);
  assert.doesNotMatch(shortTermEventBindings, /querySelector\("\[role='tablist'\]"\)|\[data-tab\]/);
  assert.match(shortTermNavigationSurface, /export function handleShortTermTabListKeydown/);
  assert.match(shortTermNavigationSurface, /void event/);
  assert.match(shortTermNavigationSurface, /export function openShortTermTab/);
  assert.doesNotMatch(shortTermEntry, /nextTabIndexForKey|tabButtons\(\)|applyTabState\(tab, options\)|consumeKeyboardEvent\(event\)/);
  assert.doesNotMatch(shortTermEntry, /document\.addEventListener\("click"|document\.addEventListener\("keydown"|nodes\.dropZone\.addEventListener\("drop"/);
  assert.match(shortTermCompareSurface, /generalCompareTraceView/);
  assert.match(shortTermCompareSurface, /optimizationCompareTraceView/);
  assert.match(shortTermCompareSurface, /applyCompareSlotView\(nodes, slot, compareSlotView\(slot, title, model, fallbackMeta\)\)/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView\(nodes\.compareView, generalCompareTraceView\(\)\)/);
  assert.match(shortTermCompareSurface, /applyCompareTraceView\(nodes\.compareView, optimizationCompareTraceView\(\)\)/);
  assert.match(shortTermCompareSurface, /markCompareSlotLoaded\(nodes, slot\)/);
  assert.match(shortTermCompareSurface, /renderShortTermGeneralComparePanel\(\{/);
  assert.match(shortTermCompareSurface, /renderCompareInfoPanel\(nodes, "B", renderGeneralComparePanelHtml/);
  assert.doesNotMatch(page, /id="compareInfoA"/);
  assert.match(shortTermOptimizationSurface, /renderShortTermOptimizationCompareResult\(\{ nodes, model \}\)/);
  assert.doesNotMatch(shortTermEntry, /textContent = view\.title|textContent = view\.meta|dataset\.compareState = view\.compareState|dataset\.compareState = "loaded"|dataset\.module = view\.moduleName|dataset\.pageState = view\.pageState|nodes\.compareInfo[AB]\.innerHTML/);
  assert.match(shortTermCompareRenderers, /textContent = view\.title/);
  assert.match(shortTermCompareRenderers, /textContent = view\.meta/);
  assert.match(shortTermCompareRenderers, /dataset\.compareState = view\.compareState/);
  assert.match(shortTermCompareRenderers, /dataset\.compareState = "loaded"/);
  assert.match(shortTermCompareRenderers, /dataset\.module = view\.moduleName/);
  assert.match(shortTermCompareRenderers, /dataset\.pageState = view\.pageState/);
  assert.match(shortTermCompareRenderers, /node\.innerHTML = html/);
  assert.doesNotMatch(shortTermEntry, /setCompareTrace\("GeneralCompareModule", "General comparing"\)|setCompareTrace\("OptimizationCompareModule", "Optimization compare"\)/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-smoke-runner\.mjs"/);
  assert.match(shortTermSmokeRunner, /from "\.\/short-term-macos-smoke-proof-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-smoke-proof-model\.mjs"/);
  assert.match(shortTermSmokeProofModel, /export async function collectShortTermRightSurfaceNavigationProof/);
  assert.match(shortTermSmokeProofModel, /proofId: "short-term-right-surface-navigation-proof"/);
  assert.match(shortTermSmokeRunner, /shortTermRightSurfaceNavigationProof/);
  assert.match(shortTermFileSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermCompareSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermReplaceableSurface, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermSmokeRunner, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-byte-model\.mjs"/);
  assert.match(shortTermByteModel, /export function toUint8Array/);
  assert.match(shortTermByteModel, /export function toBase64/);
  assert.match(shortTermByteModel, /export function fromBase64/);
  assert.match(shortTermByteModel, /export function toParserArrayBuffer/);
  assert.match(shortTermByteModel, /export async function sha256Hex/);
  assert.doesNotMatch(shortTermEntry, /function toUint8Array|function toBase64|function fromBase64|function toParserArrayBuffer|async function sha256Hex/);
  assert.match(shortTermController, /from "\.\/short-term-macos-dialog-model\.mjs"/);
  assert.match(shortTermDialogModel, /export function hasOpenDialog/);
  assert.match(shortTermDialogModel, /export function closeOpenDialog/);
  assert.match(shortTermDialogModel, /export function showDialog/);
  assert.match(shortTermDialogModel, /export async function confirmDiscardUnsavedOutput/);
  assert.match(shortTermDialogModel, /dialog\.showModal\(\)/);
  assert.match(shortTermDialogModel, /function focusInitialDialogElement/);
  assert.match(shortTermDialogModel, /options\.initialFocus/);
  assert.match(shortTermDialogModel, /returnFocus\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(shortTermDialogModel, /querySelector\("dialog\[open\]"\)/);
  assert.match(shortTermCommandSurface, /dialogOpen: hasOpenDialog\(documentRef\)/);
  assert.doesNotMatch(shortTermRuntimeTextSurface, /showDialog|nodes\.textDialog|nodes\.runtimeTextInput/);
  assert.match(shortTermRuntimeTextSurface, /findRuntimeTextInput/);
  assert.match(shortTermEventBindings, /if \(hasOpenDialog\(documentRef\)\) \{\s+if \(event\.key === "Escape"\) closeOpenDialog\(documentRef, "cancel"\);\s+return;\s+\}/);
  assert.match(shortTermActionBridge, /closeOpenDialog\(documentRef, "cancel"\)/);
  assert.doesNotMatch(shortTermEntry, /function showDialog|dialog\.showModal\(\)|document\.querySelector\("dialog\[open\]"\)/);
  assert.match(shortTermController, /from "\.\/short-term-macos-playback-surface\.mjs"/);
  assert.match(shortTermPlaybackSurface, /from "\.\/short-term-macos-playback-model\.mjs"/);
  assert.match(shortTermPlaybackSurface, /export async function mountShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /playbackState: state/);
  assert.match(shortTermPlaybackSurface, /export function stopShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /export function stopAllShortTermPlayback/);
  assert.match(shortTermPlaybackSurface, /export function toggleShortTermPrimaryPlayback/);
  assert.match(shortTermPlaybackSurface, /export function replayShortTermPrimaryPlayback/);
  assert.match(shortTermPlaybackSurface, /export function renderShortTermPlaybackProgress/);
  assert.match(shortTermController, /requestAnimationFrame\(tick\)/);
  assert.match(shortTermController, /cancelAnimationFrame\(playbackProgressFrame\)/);
  assert.match(shortTermController, /if \(key === "primary"\) startPlaybackProgressLoop\(\)/);
  assert.match(shortTermPlaybackSurface, /export function clearShortTermPlaybackCanvas/);
  assert.match(shortTermPlaybackSurface, /export function shortTermPlayerPrototype/);
  assert.doesNotMatch(shortTermEntry, /from "\.\/short-term-macos-playback-model\.mjs"/);
  assert.match(shortTermPlaybackModel, /export async function mountPlayback/);
  assert.match(shortTermPlaybackModel, /export function stopPlayback/);
  assert.match(shortTermPlaybackModel, /export function stopAllPlayback/);
  assert.match(shortTermPlaybackModel, /export function togglePrimaryPlayback/);
  assert.match(shortTermPlaybackModel, /export function replayPrimaryPlayback/);
  assert.match(shortTermPlaybackModel, /export function playbackProgressView/);
  assert.match(shortTermPlaybackModel, /formatPlaybackTime/);
  assert.match(shortTermPlaybackModel, /export function clearCanvas/);
  assert.match(shortTermPlaybackModel, /export function svgaWebPlayerPrototype/);
  assert.match(shortTermPlaybackModel, /Parser as SvgaWebParser/);
  assert.match(shortTermPlaybackModel, /Player as SvgaWebPlayer/);
  assert.match(shortTermPlaybackModel, /FILL_MODE\.FORWARDS/);
  assert.match(shortTermPlaybackModel, /toParserArrayBuffer\(bytes\)/);
  assert.doesNotMatch(shortTermEntry, /FILL_MODE|SvgaWebParser|SvgaWebPlayer|player\.set|new SvgaWebParser|new SvgaWebPlayer|toParserArrayBuffer/);
  assert.match(shortTermController, /from "\.\/short-term-macos-api-client\.mjs"/);
  assert.match(shortTermApiClient, /export async function inspectShortTermSvga/);
  assert.match(shortTermApiClient, /export async function optimizeShortTermSvga/);
  assert.match(shortTermApiClient, /export async function renameShortTermImageKey/);
  assert.match(shortTermApiClient, /export async function replaceShortTermImageAsset/);
  assert.match(shortTermApiClient, /export async function probeInvalidShortTermInspection/);
  assert.match(shortTermApiClient, /x-auto-svga-prototype-token/);
  assert.doesNotMatch(shortTermEntry, /function postBytes|function postJson|function authHeaders|function readJsonResponse|\/api\/short-term-product-/);
  assert.match(shortTermRenderModel, /export function renderOverviewFactCellHtml/);
  assert.match(shortTermRenderModel, /export function renderOptimizationFindingHtml/);
  assert.match(shortTermRenderModel, /export function renderMessageRowHtml\(title, summary, tone = "info"\)/);
  assert.match(shortTermRenderModel, /success: "已生成"/);
  assert.match(shortTermRenderModel, /export function renderCompareFactCellHtml/);
  assert.match(shortTermRenderModel, /export function groupOptimizationItems/);
  assert.match(shortTermEntry, /from "\.\/short-term-macos-action-bridge\.mjs"/);
  assert.match(shortTermEntry, /installShortTermActionBridge\(\{/);
  assert.match(shortTermActionBridge, /export function installShortTermActionBridge/);
  assert.match(shortTermActionBridge, /windowRef\.__autoSvgaShortTermActions = Object\.freeze/);
  assert.match(shortTermActionBridge, /save: \(\) => handlers\.saveActiveOutput\("overwrite"\)/);
  assert.match(shortTermActionBridge, /copyStateSummary: \(\) => bridge\?\.writeClipboardText\?\.\(handlers\.currentStateSummary\(\)\)/);
  assert.doesNotMatch(shortTermEntry, /window\.__autoSvgaShortTermActions = Object\.freeze/);
  assert.match(shortTermReplaceableSurface, /aria-selected/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-inspection-model/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-optimization-workflow/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-image-key-rename/);
  assert.match(shortTermController, /function createSaveProofOutput/);
  assert.match(shortTermController, /createSaveProofOutput,/);
  assert.match(shortTermApiClient, /\/api\/short-term-product-image-replacement-workflow/);
  assert.match(shortTermState, /renameImageKey: ""/);
  assert.match(shortTermReplaceableRenderers, /data-rename-input/);
  assert.match(shortTermReplaceableRenderers, /ReplaceableImageRow/);
  assert.match(shortTermReplaceableRenderers, /setAttribute\("role", "option"\)/);
  assert.match(shortTermController, /confirmInlineRename/);
  assert.match(shortTermReplaceableRenderers, /inline-rename-confirm/);
  assert.match(shortTermReplaceableRenderers, /inline-rename-cancel/);
  assert.match(shortTermReplaceableRenderers, /Enter 确认 · Esc 取消/);
  assert.match(shortTermEventBindings, /event\.key === "Enter"[\s\S]*handlers\.confirmInlineRename/);
  assert.match(shortTermEventBindings, /event\.key === "Escape"[\s\S]*handlers\.cancelInlineRename/);
  assert.match(shortTermController, /openKeyboardResourceContextMenu/);
  assert.match(shortTermEventBindings, /nodes\.textElementList\.addEventListener\("keydown"/);
  assert.match(shortTermResourceMenuRenderers, /button:not\(:disabled\)/);
  assert.match(shortTermEventBindings, /nodes\.textElementList\.addEventListener\("input"/);
  assert.match(shortTermEventBindings, /handlers\.updateRuntimeText\(input\.dataset\.textKey, input\.value\)/);
  assert.match(shortTermEventBindings, /runtime-text-reset/);
  assert.doesNotMatch(shortTermEventBindings, /runtimeTextInput\.addEventListener|nodes\.textDialog\.close/);
  assert.match(shortTermSmokeProofModel, /initialFocusInput/);
  assert.match(shortTermSmokeProofModel, /inlineInputRendered/);
  assert.match(shortTermSmokeProofModel, /inputSpaceSuppressed/);
  assert.match(shortTermSmokeRunner, /const runtimeTextInitialFocusInput = document\.activeElement === runtimeTextInput/);
  assert.match(shortTermSmokeRunner, /const runtimeTextInlineInputRendered = Boolean\(runtimeTextInput\)/);
  assert.match(shortTermSmokeRunner, /const runtimeTextResetButton = runtimeTextInput\.closest\("\.textElementRow"\)\?\.querySelector\("\[data-action='runtime-text-reset'\]"\)/);
  assert.doesNotMatch(shortTermEntry, /renameDialog|renameHint/);
  assert.doesNotMatch(shortTermEntry, /mountPlayback\("edit"[\s\S]{0,120}start:\s*false/);
  assert.match(shortTermSaveSurface, /saveShortTermSvgaOutput/);
  assert.match(shortTermSaveSurface, /return \{\s*\.\.\.result,\s*outputKind,\s*expectedSha256/s);
  assert.match(shortTermRecentFilesSurface, /getRecentSvgaFiles/);
  assert.match(shortTermEntry, /runShortTermSmokeIfRequested/);
  assert.match(shortTermSmokeRunner, /reportSmokeResult/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRightSurfaceCaptureState/);
  assert.match(shortTermSmokeRunner, /collectShortTermRightSurfaceCaptureState/);
  assert.match(shortTermSmokeRunner, /state\.smokeSurfaceCaptureStates = \[\]/);
  assert.match(shortTermSmokeRunner, /const setSmokeSurface = async \(surface, artifactName = ""\)/);
  assert.match(shortTermSmokeRunner, /setTab\(surface, \{ focus: true, scroll: true \}\)/);
  assert.match(shortTermSmokeRunner, /document\.activeElement\?\.blur\?\.\(\)/);
  assert.ok(shortTermSmokeRunner.includes('document.querySelector(`[data-panel="${expectedPanel}"]`)?.hidden === false'));
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-launch"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-overview"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-optimization"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-replaceable"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-sequence-thumbnails"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-optimization-result"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-rename-dirty"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-replacement-dirty"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-replacement-reset"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-general-compare"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-edit-reserved"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-preview-minimum"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-save-failed"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-load-failed"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-playback-failed"\)/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermOpenFlowProof/);
  assert.match(shortTermSmokeProofModel, /short-term-open-flow-proof/);
  assert.match(shortTermSmokeProofModel, /dragDropAttempted/);
  assert.match(shortTermSmokeProofModel, /dragDecisionOverlayVisible/);
  assert.match(shortTermSmokeProofModel, /dragDecisionOffersOpenAndCompare/);
  assert.match(shortTermSmokeProofModel, /unsupportedDropToastVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermOpenFlowProof/);
  assert.match(shortTermSmokeRunner, /supportedDragDecisionOverlayVisible/);
  assert.match(shortTermSmokeRunner, /unsupportedDropClearedCanvas/);
  assert.match(shortTermSmokeRunner, /unsupportedDropToastVisible/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-open-flow-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermLoadFailureProof/);
  assert.match(shortTermSmokeProofModel, /short-term-load-failure-proof/);
  assert.match(shortTermSmokeProofModel, /sourceBytesRestoredAfterRecovery/);
  assert.match(shortTermSmokeProofModel, /playbackFailureInjected/);
  assert.match(shortTermSmokeProofModel, /playbackFailureVisible/);
  assert.match(shortTermSmokeProofModel, /playbackFailureRecovered/);
  assert.match(shortTermSmokeProofModel, /playbackFailureSourceBytesRestoredAfterRecovery/);
  assert.match(shortTermSmokeRunner, /collectShortTermLoadFailureProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-load-failure-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermSpecComparisonProof/);
  assert.match(shortTermSmokeProofModel, /short-term-spec-comparison-proof/);
  assert.match(shortTermSmokeProofModel, /actualValuesVisible/);
  assert.match(shortTermSmokeProofModel, /defaultThresholdsHidden/);
  assert.match(shortTermSmokeProofModel, /optimizationStatusVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermSpecComparisonProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-spec-comparison-proof"/);
  assert.match(shortTermSmokeProofModel, /short-term-right-surface-navigation-proof/);
  assert.match(shortTermSmokeProofModel, /tabButtonsRemoved/);
  assert.match(shortTermSmokeProofModel, /short-term-design-interaction-proof/);
  assert.match(shortTermSmokeProofModel, /export function createSmokeArtifactCapture/);
  assert.match(shortTermSmokeProofModel, /captureSmokeArtifact/);
  assert.match(shortTermSmokeProofModel, /allSmokeArtifactsCaptured/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermDesignInteractionProof/);
  assert.match(shortTermSmokeRunner, /const smokeArtifactCapture = createSmokeArtifactCapture\(bridge\)/);
  assert.match(shortTermSmokeRunner, /await setSmokeSurface\("optimization", "short-term-preview-optimization"\);[\s\S]*captureSmokeArtifact\("short-term-preview-optimization"\)/);
  assert.match(shortTermSmokeRunner, /await setSmokeSurface\("replaceable", "short-term-preview-replaceable"\);[\s\S]*captureSmokeArtifact\("short-term-preview-replaceable"\)/);
  assert.match(shortTermSmokeRunner, /collectShortTermDesignInteractionProof/);
  assert.match(shortTermSmokeProofModel, /visibleFocusableElements/);
  assert.match(shortTermSmokeProofModel, /metadataSelectable/);
  assert.match(shortTermSmokeProofModel, /surfaceCaptureStatesSynced/);
  assert.match(shortTermSmokeProofModel, /menuStateDiscoverable/);
  assert.match(shortTermSmokeProofModel, /settingsSheetAvailable/);
  assert.match(shortTermSmokeProofModel, /appearanceSwitchingWorks/);
  assert.match(shortTermSmokeProofModel, /appearanceScreenshotsCaptured/);
  assert.match(shortTermSmokeProofModel, /appearanceMenuStateSynced/);
  assert.match(shortTermSmokeProofModel, /noMainSurfaceAppearanceButton/);
  assert.match(shortTermSmokeProofModel, /noVisibleCompareEntrypoint/);
  assert.match(shortTermSmokeProofModel, /canvasModeSwitchReachable/);
  assert.match(shortTermSmokeProofModel, /focusedControlSpaceNotGlobalPlayback/);
  assert.match(shortTermSmokeRunner, /focusedControlSpaceProof/);
  assert.match(shortTermSmokeRunner, /settingsAppearanceProof/);
  assert.match(shortTermSmokeRunner, /setAppearance\("dark"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-appearance-dark"\)/);
  assert.match(shortTermSmokeRunner, /captureSmokeArtifact\("short-term-appearance-light"\)/);
  assert.match(shortTermSmokeRunner, /darkAppearanceScreenshotCaptured/);
  assert.match(shortTermSmokeRunner, /lightAppearanceScreenshotCaptured/);
  assert.match(shortTermSmokeProofModel, /minimumPreviewCaptured/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermReplaceableClassificationProof/);
  assert.match(shortTermSmokeProofModel, /short-term-replaceable-classification-proof/);
  assert.match(shortTermSmokeProofModel, /automaticKeysExcluded/);
  assert.match(shortTermSmokeRunner, /collectShortTermReplaceableClassificationProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-replaceable-classification-proof"/);
  assert.match(main, /validateShortTermOpenFlowProof/);
  assert.match(main, /dragDecisionOverlayVisible/);
  assert.match(main, /unsupportedDropSourceBytesRestoredAfterRecovery/);
  assert.match(main, /short-term-open-flow-proof\.json/);
  assert.match(main, /validateShortTermLoadFailureProof/);
  assert.match(main, /short-term-load-failure-proof\.json/);
  assert.match(main, /validateShortTermSpecComparisonProof/);
  assert.match(main, /short-term-spec-comparison-proof\.json/);
  assert.match(main, /function validateShortTermRightSurfaceNavigationProof/);
  assert.match(main, /shortTermRightSurfaceNavigationProof = validateShortTermRightSurfaceNavigationProof/);
  assert.match(main, /short-term-right-surface-navigation-proof\.json/);
  assert.match(main, /shortTermRightSurfaceNavigationProof: Boolean\(shortTermRightSurfaceNavigationProof\)/);
  assert.match(main, /function validateShortTermDesignInteractionProof/);
  assert.match(main, /normalizeBoundedStringList/);
  assert.match(main, /typeof normalized\.activeElementId !== "string"/);
  assert.match(main, /item\.activeElementId\.length > 80/);
  assert.match(main, /short-term-preview-optimization", "optimization", "panelOptimization"/);
  assert.match(main, /short-term-preview-replaceable", "replaceable", "panelOverview"/);
  assert.match(main, /shortTermDesignInteractionProof = validateShortTermDesignInteractionProof/);
  assert.match(main, /short-term-design-interaction-proof\.json/);
  assert.match(main, /shortTermDesignInteractionProof: Boolean\(shortTermDesignInteractionProof\)/);
  assert.match(main, /validateShortTermReplaceableClassificationProof/);
  assert.match(main, /short-term-replaceable-classification-proof\.json/);
  assert.doesNotMatch(shortTermEntry, /const screenshotCaptures = \[\]/);
  assert.match(shortTermSmokeRunner, /shortTermScreenshots: smokeArtifactCapture\.allSmokeArtifactsCaptured\(9\)/);
  assert.match(shortTermSmokeRunner, /shortTermSaveFailed: saveFailedVisible/);
  assert.match(shortTermSmokeRunner, /shortTermLoadFailed: loadFailedVisible/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermEmptyStateProof/);
  assert.match(shortTermSmokeProofModel, /short-term-empty-state-proof/);
  assert.match(shortTermSmokeRunner, /collectShortTermEmptyStateProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-empty-state-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRuntimeTextBoundaryProof/);
  assert.match(shortTermSmokeProofModel, /short-term-runtime-text-boundary-proof/);
  assert.match(shortTermSmokeProofModel, /inputSpaceSuppressed/);
  assert.match(shortTermSmokeProofModel, /productCompleteClaimed: true/);
  assert.match(shortTermSmokeRunner, /runtimeTextPlaybackBeforeSpace/);
  assert.match(shortTermSmokeRunner, /sourceSha256Before: runtimeTextSourceSha256Before/);
  assert.match(shortTermSmokeRunner, /sourceSha256AfterApply: runtimeTextSourceSha256AfterApply/);
  assert.match(shortTermSmokeProofModel, /runtimeTextKeySource: "official_svga_dynamic_text_imagekey"/);
  assert.match(shortTermSmokeProofModel, /runtimeOverlayVisibleAfterApply/);
  assert.match(shortTermSmokeRunner, /collectShortTermRuntimeTextBoundaryProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-runtime-text-boundary-proof"/);
  assert.match(shortTermSmokeRunner, /resetClearedOverlay/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermThumbnailProof/);
  assert.match(shortTermSmokeProofModel, /short-term-thumbnail-proof/);
  assert.match(shortTermSmokeProofModel, /sequenceFourGridVisible/);
  assert.match(shortTermSmokeProofModel, /sequenceThumbnailImageCount/);
  assert.match(shortTermSmokeRunner, /collectShortTermThumbnailProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-thumbnail-proof"/);
  assert.match(shortTermOverviewModel, /overviewVisibleFacts/);
  assert.match(shortTermRenderModel, /"fileSize", "decodedMemory", "canvas", "fps", "assetCount"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermOptimizationProof/);
  assert.match(shortTermSmokeProofModel, /short-term-optimization-proof/);
  assert.match(shortTermSmokeProofModel, /optimizedBytesSmaller/);
  assert.match(shortTermSmokeProofModel, /executedActionCount/);
  assert.match(shortTermSmokeProofModel, /executedActionRowsVisible/);
  assert.match(shortTermSmokeProofModel, /skippedMethodRowsVisible/);
  assert.match(shortTermSmokeRunner, /collectShortTermOptimizationProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-optimization-proof"/);
  assert.match(shortTermOptimizationModel, /groupOptimizationItems/);
  assert.match(shortTermRenderModel, /item\.count > 1/);
  assert.match(shortTermCompareModel, /data-optimization-actions/);
  assert.match(shortTermCompareModel, /data-optimization-skipped/);
  assert.match(shortTermCompareModel, /optimizationMetricGrid/);
  assert.match(shortTermCompareModel, /optimizationActions/);
  assert.match(shortTermCompareModel, /data-action="save-as">另存为 SVGA/);
  assert.match(shortTermCompareModel, /data-action="save-overwrite">覆盖保存/);
  assert.match(shortTermCompareModel, /data-action="back-preview">放弃优化/);
  assert.ok(
    shortTermCompareModel.indexOf("optimizationMetricGrid") < shortTermCompareModel.indexOf("optimizationActions")
      && shortTermCompareModel.indexOf("optimizationActions") < shortTermCompareModel.indexOf("data-optimization-actions"),
    "optimization result actions stay above long detail lists"
  );
  assert.match(shortTermFeedbackModel, /function bannerTone/);
  assert.match(shortTermFeedbackSurface, /showSaveFeedbackBanner\(nodes\.saveBanner, title, message, tone\)/);
  assert.match(shortTermFeedbackSurface, /clearSaveFeedbackBanner\(nodes\.saveBanner\)/);
  assert.match(shortTermFeedbackSurface, /hideSaveFeedbackBanner\(nodes\.saveBanner\)/);
  assert.doesNotMatch(shortTermEntry, /nodes\.saveBanner\.hidden = true|nodes\.saveBanner\.dataset\.status|nodes\.saveBanner\.innerHTML =/);
  assert.match(shortTermSaveRenderers, /node\.dataset\.status = view\.status/);
  assert.match(shortTermSaveRenderers, /node\.innerHTML = view\.html/);
  assert.doesNotMatch(shortTermEntry, /function messageRow|renderMessageRowHtml/);
  assert.doesNotMatch(shortTermEntry, /document\.createElement\("p"\)|empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermOptimizationRenderers, /row\.dataset\.component = "InlineStatus"/);
  assert.doesNotMatch(shortTermEditReservedRenderers, /empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermInlineStatusRenderers, /empty\.dataset\.component = "InlineStatus"/);
  assert.match(shortTermEditReservedRenderers, /row\.dataset\.component = "LayerRow"/);
  assert.match(shortTermReplaceableRenderers, /class="rowIndex"/);
  assert.match(shortTermSmokeProofModel, /comparisonVisible/);
  assert.match(shortTermSmokeProofModel, /sourceBytesUnchanged/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermRenameProof/);
  assert.match(shortTermSmokeProofModel, /short-term-rename-proof/);
  assert.match(shortTermSmokeProofModel, /contextMenuOpened/);
  assert.match(shortTermSmokeProofModel, /enterConfirmed/);
  assert.match(shortTermSmokeProofModel, /renamedKeyVisible/);
  assert.match(shortTermSmokeProofModel, /referenceFieldsChecked: \["imageKey", "matteKey"\]/);
  assert.match(shortTermSmokeProofModel, /referenceClosurePassed/);
  assert.match(shortTermSmokeProofModel, /matteKeyReferenceClosurePassed/);
  assert.match(shortTermSmokeProofModel, /danglingReferenceCount === 0/);
  assert.match(shortTermSmokeRunner, /collectShortTermRenameProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-rename-proof"/);
  assert.match(shortTermSmokeProofModel, /export function collectShortTermReplacementProof/);
  assert.match(shortTermSmokeProofModel, /short-term-replacement-proof/);
  assert.match(shortTermSmokeProofModel, /resetCommandEnabled/);
  assert.match(shortTermSmokeProofModel, /resetRestoredOriginal/);
  assert.match(shortTermSmokeProofModel, /resourceMenuKeyboardNavigationPassed/);
  assert.match(shortTermSmokeRunner, /resourceMenuArrowDownFocusedAction/);
  assert.match(shortTermSmokeRunner, /resourceMenuEndFocusedAction/);
  assert.match(shortTermSmokeRunner, /resourceMenuHomeFocusedAction/);
  assert.match(shortTermSmokeProofModel, /resourceMenuFocusReturnedAfterClose/);
  assert.match(shortTermSmokeRunner, /const resourceMenuFocusReturnedAfterClose = document\.activeElement === replacementRow/);
  assert.match(shortTermSmokeProofModel, /saveAsEnabledBeforeReset/);
  assert.match(shortTermSmokeRunner, /collectShortTermReplacementProof/);
  assert.doesNotMatch(shortTermEntry, /proofId: "short-term-replacement-proof"/);
  assert.match(shortTermSmokeProofModel, /noAudioVisible/);
  assert.match(shortTermSmokeProofModel, /noReplaceableImagesMinimal/);
  assert.match(shortTermSmokeProofModel, /textUnavailableMinimal/);
  assert.match(shortTermSmokeProofModel, /ordinaryImagesNotDuplicatedInReplaceables/);
  assert.match(shortTermSmokeProofModel, /ordinaryImageThumbnailVisible/);
  assert.match(shortTermController, /function createSaveFailureProofOutput/);
  assert.match(shortTermSaveSurface, /const savedModel = await inspectShortTerm\(outputBytes/);
  assert.ok(
    shortTermSaveSurface.indexOf("const savedModel = await inspectShortTerm(outputBytes") < shortTermSaveSurface.indexOf("state.sourceBytes = outputBytes"),
    "saved output must reopen before becoming the current source bytes"
  );
  assert.match(shortTermSmokeRunner, /playerLifecycleOk/);
  assert.match(shortTermSmokeRunner, /dragDropLoaded/);
  assert.match(shortTermSmokeProofModel, /export async function waitForCanvasPixels/);
  assert.match(shortTermSmokeProofModel, /export function resourceEntriesAreLocalOnly/);
  assert.match(shortTermSmokeRunner, /waitForCanvasPixels/);
  assert.match(shortTermApiClient, /name=invalid\.svga/);
  assert.match(shortTermPlaybackModel, /toParserArrayBuffer/);
  assert.match(shortTermByteModel, /view\.buffer\.slice\(view\.byteOffset, view\.byteOffset \+ view\.byteLength\)/);
  assert.match(shortTermController, /confirmDiscardUnsavedOutput/);
  assert.match(shortTermController, /renderTextElements/);
  assert.match(shortTermController, /selectedTextElement/);
  assert.match(shortTermReplaceableSurface, /当前文件没有可预览文本元素/);
  assert.match(shortTermFileSurface, /打开新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermFileSurface, /拖入新文件会放弃当前未保存的 SVGA 输出/);
  assert.match(shortTermOptimizationSurface, /showOperationFailure\("优化未完成。", error\)/);
  assert.match(shortTermReplaceableSurface, /showOperationFailure\("重命名未完成。", error\)/);
  assert.match(shortTermReplaceableSurface, /showOperationFailure\("替换未完成。", error\)/);
  assert.match(shortTermFeedbackModel, /源文件没有被修改。/);
  assert.match(shortTermController, /currentStateSummary/);
  assert.match(shortTermFeedbackModel, /错误：\$\{input\.errorText\.trim\(\)\}/);
  assert.match(shortTermFeedbackModel, /提示：\$\{input\.saveBannerText\.trim\(\)\}/);
  assert.match(shortTermActionBridge, /writeClipboardText\?\.\(handlers\.currentStateSummary\(\)\)/);
  assert.match(shortTermCommandSurface, /syncShortTermMenuState/);
  assert.match(shortTermHostClient, /updateShortTermMenuState/);
  assert.match(shortTermCommandState, /canShowOptimizationComparison/);
  assert.match(shortTermController, /showOptimizationComparison/);
  assert.match(shortTermCompareModel, /compareSummary/);
  assert.match(shortTermCompareModel, /compareMetricGrid/);
  assert.match(shortTermCompareModel, /compareActions/);
  assert.match(shortTermResourceMenuModel, /input\.activeOutput\?\.kind !== "replacement"/);
  assert.match(shortTermEventBindings, /addEventListener\("contextmenu"/);
  assert.match(shortTermController, /openResourceContextMenu/);
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
  assert.match(main, /const productArtifactRoot = process\.env\.AUTO_SVGA_PRODUCT_ARTIFACTS[\s\S]*path\.join\(repoRoot, "\.artifacts\/product", productMilestoneId\)/);
  assert.match(main, /path: `\.artifacts\/product\/\$\{productMilestoneId\}\/\$\{fileName\}`/);
  assert.doesNotMatch(main, /productArtifactRoot[\s\S]{0,160}\.artifacts\/internal-trial/);
  assert.match(main, /installShortTermApplicationMenu/);
  assert.match(main, /function updateShortTermMenuState/);
  assert.match(main, /function validateShortTermMenuState/);
  assert.match(main, /short-term-menu-state-proof/);
  assert.match(main, /stateReflectsLoadedSmoke/);
  assert.match(main, /openMenuAvailable/);
  assert.match(main, /recentMenuExists/);
  assert.match(main, /clearRecentMenuExists/);
  assert.match(main, /recentMenuRecordCountMatchesState/);
  assert.match(main, /recentMenuRecordLimitRespected/);
  assert.match(main, /recentMenuLabelsPathRedacted/);
  assert.match(main, /recentMenuPlaceholderMatchesEmptyState/);
  assert.match(main, /clearRecentEnabledMatchesState/);
  assert.match(main, /function menuSubmenuItems/);
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
  assert.match(main, /resetButtonEnabledAfterApply/);
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
  assert.match(main, /short-term-appearance-dark/);
  assert.match(main, /short-term-appearance-light/);
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

test("short-term design system check enforces UI implementation guardrails", () => {
  const source = readFileSync(path.join(experimentRoot, "scripts/check-short-term-design-system.mjs"), "utf8");
  const dynamicDomAllowlist = source.match(/const allowedDynamicDomModules = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  const dataComponentAllowlist = source.match(/const allowedDataComponents = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(dynamicDomAllowlist, /short-term-macos-dom-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-compare-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-edit-reserved-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-inline-status-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-launch-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-optimization-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-overview-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-replaceable-renderers\.mjs/);
  assert.match(dynamicDomAllowlist, /short-term-macos-save-renderers\.mjs/);
  assert.doesNotMatch(dynamicDomAllowlist, /short-term-macos-compare-model\.mjs|short-term-macos-render-model\.mjs|short-term-macos-recent-files-model\.mjs/);
  assert.match(dataComponentAllowlist, /DragDecisionOverlay/);
  assert.match(dataComponentAllowlist, /CanvasToast/);
  assert.match(source, /const disallowedLaunchCopyPatterns = \[/);
  assert.match(source, /launch-page-copy-stays-minimal/);
  assert.match(source, /const disallowedLegacySurfaceCopyPatterns = \[/);
  assert.match(source, /visible-surface-avoids-legacy-workbench-and-inspector-language/);
  assert.match(source, /<p>拖拽文件到此处<\\\/p>/);
  assert.match(source, /largeOpenButton/);
  assert.match(source, /recentNote" hidden/);
  const output = execFileSync(process.execPath, ["scripts/check-short-term-design-system.mjs"], {
    cwd: experimentRoot,
    encoding: "utf8"
  });
  const report = JSON.parse(output);
  assert.equal(report.proofId, "short-term-design-system-check");
  assert.equal(report.passed, true);
  assert.ok(report.checks.some((check) => check.name === "stylesheet-order" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "focus-visible-covered-by-ui-layers" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "reduced-motion-covered" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "foreground-validation-rule-documented" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "launch-page-copy-stays-minimal" && check.passed === true));
  assert.ok(report.checks.some((check) => check.name === "visible-surface-avoids-legacy-workbench-and-inspector-language" && check.passed === true));
});

test("root package exposes explicit desktop entrypoints without changing default scripts", async () => {
  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const experimentPackage = JSON.parse(await readFile(path.join(experimentRoot, "package.json"), "utf8"));
  const legacyPackage = JSON.parse(await readFile(path.join(experimentRoot, "../../package.json"), "utf8"));
  assert.equal(rootPackage.scripts["desktop:dev"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:dev");
  assert.equal(rootPackage.scripts["desktop:smoke"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke");
  assert.match(rootPackage.scripts["desktop:p2:normal-proof"], /desktop:p2:normal-proof/);
  assert.equal(rootPackage.scripts["desktop:short-term:acceptance-matrix"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:acceptance-matrix");
  assert.equal(rootPackage.scripts["desktop:short-term:design-system-check"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check");
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
  assert.match(experimentPackage.scripts["desktop:short-term:design-system-check"], /check-short-term-design-system\.mjs/);
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
