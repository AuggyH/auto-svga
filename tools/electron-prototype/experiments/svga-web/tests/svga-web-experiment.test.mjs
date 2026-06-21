import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legacyBrowserBaselineAuditCsp, strictCsp, startSvgaWebExperimentServer } from "../server.mjs";
import {
  appName,
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

test("macOS internal package scaffold declares bounded unsigned .svga bundle metadata", async () => {
  const plist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  assert.equal(appName, "Auto SVGA");
  assert.match(plist, /CFBundleDisplayName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.match(plist, /CFBundleName[\s\S]*<string>Auto SVGA<\/string>/);
  assert.doesNotMatch(plist, /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(plist, /AutoSVGAInternalUseOnly/);
  assert.match(plist, /AutoSVGASigned/);
  assert.match(plist, /AutoSVGANotarized/);
  assert.match(plist, /AutoSVGAProductionApproved/);
  assert.match(plist, new RegExp(bundleIdentifier));
  assert.match(plist, /CFBundleDocumentTypes/);
  assert.match(plist, /CFBundleTypeRole[\s\S]*Viewer/);
  assert.match(plist, /LSHandlerRank[\s\S]*Alternate/);
  assert.match(plist, /UTExportedTypeDeclarations/);
  assert.match(plist, /com\.auto-svga\.svga/);
  assert.match(plist, /public\.filename-extension[\s\S]*svga/);

  const packagerArgs = macosPackagerArgs(".artifacts/internal-trial");
  assert.equal(packagerArgs[1], appName);
  assert.ok(packagerArgs.includes("--platform=darwin"));
  assert.ok(packagerArgs.includes("--arch=arm64"));
  assert.ok(packagerArgs.includes(`--app-bundle-id=${bundleIdentifier}`));
  assert.ok(packagerArgs.includes("--app-version=0.0.0-internal"));
  assert.ok(packagerArgs.includes("--build-version=0.0.0-internal"));
  assert.ok(packagerArgs.some((arg) => arg === "--extend-info=packaging/macos/Info.plist"));
});

test("macOS package proof manifest records audit boundaries without final App acceptance", async () => {
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64/Auto SVGA.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/Auto SVGA-darwin-arm64.zip")
  });
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
  assert.equal(proof.documentTypes[0].extension, "svga");
  assert.equal(proof.documentTypes[0].role, "Viewer");
  assert.equal(proof.privacyAudit.passed, true);
  assert.deepEqual(proof.privacyAudit.findings, []);
  assert.match(proof.packagingScaffold.extendInfoPath, /packaging\/macos\/Info\.plist$/);
  assert.match(proof.packagingScaffold.appBundlePath, /Auto SVGA-darwin-arm64\/Auto SVGA\.app$/);
  assert.doesNotMatch(JSON.stringify(proof), /AutoSVGAInternalPrototype|Auto SVGA Internal Prototype/);
  assert.match(proof.requestedIntegrationChanges[0], /root package script/);
});

test("macOS internal package scaffold declares bounded unsigned .svga bundle metadata", async () => {
  const plist = await readFile(path.join(experimentRoot, "packaging/macos/Info.plist"), "utf8");
  assert.match(plist, /AutoSVGAInternalUseOnly/);
  assert.match(plist, /AutoSVGASigned/);
  assert.match(plist, /AutoSVGANotarized/);
  assert.match(plist, /AutoSVGAProductionApproved/);
  assert.match(plist, new RegExp(bundleIdentifier));
  assert.match(plist, /CFBundleDocumentTypes/);
  assert.match(plist, /CFBundleTypeRole[\s\S]*Viewer/);
  assert.match(plist, /LSHandlerRank[\s\S]*Alternate/);
  assert.match(plist, /UTExportedTypeDeclarations/);
  assert.match(plist, /com\.auto-svga\.svga/);
  assert.match(plist, /public\.filename-extension[\s\S]*svga/);

  const packagerArgs = macosPackagerArgs(".artifacts/internal-trial");
  assert.equal(packagerArgs[1], appName);
  assert.ok(packagerArgs.includes("--platform=darwin"));
  assert.ok(packagerArgs.includes("--arch=arm64"));
  assert.ok(packagerArgs.includes(`--app-bundle-id=${bundleIdentifier}`));
  assert.ok(packagerArgs.includes("--app-version=0.0.0-internal"));
  assert.ok(packagerArgs.includes("--build-version=0.0.0-internal"));
  assert.ok(packagerArgs.some((arg) => arg === "--extend-info=packaging/macos/Info.plist"));
});

test("macOS package proof manifest records audit boundaries without final App acceptance", async () => {
  const proof = await buildMacosPackageProof({
    appBundle: path.join(experimentRoot, ".artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64/AutoSVGAInternalPrototype.app"),
    archivePath: path.join(experimentRoot, ".artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64.zip")
  });
  assert.equal(proof.schemaVersion, 1);
  assert.equal(proof.platform, "darwin");
  assert.equal(proof.architecture, "arm64");
  assert.equal(proof.distribution.internalUseOnly, true);
  assert.equal(proof.distribution.unsigned, true);
  assert.equal(proof.distribution.notarized, false);
  assert.equal(proof.distribution.productionApproved, false);
  assert.equal(proof.distribution.finalPackagedAppAcceptanceOwner, finalAcceptanceOwner);
  assert.equal(proof.documentTypes[0].extension, "svga");
  assert.equal(proof.documentTypes[0].role, "Viewer");
  assert.equal(proof.privacyAudit.passed, true);
  assert.deepEqual(proof.privacyAudit.findings, []);
  assert.match(proof.packagingScaffold.extendInfoPath, /packaging\/macos\/Info\.plist$/);
  assert.match(proof.requestedIntegrationChanges[0], /root package script/);
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
  const server = await startSvgaWebExperimentServer({ appRoot: experimentRoot, reportToken });
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
    assert.match(page, /auto-svga 播放验证/);
    assert.match(page, /brandMark/);
    assert.match(page, /desktop-product-entry\.mjs/);
    assert.doesNotMatch(page, /prototype\.js/);
    assert.doesNotMatch(page, /cdn\.jsdelivr|(?<!wasm-)unsafe-eval/);
    const sharedTokens = await fetch(`${server.origin}/tools/shared/product-tokens.css`);
    assert.equal(sharedTokens.status, 200);
    const missingAuditSample = await fetch(`${server.origin}/audit-samples/missing.svga`);
    assert.equal(missingAuditSample.status, 404);
    const legacyVendor = await fetch(`${server.origin}/legacy-vendor/pako-2.1.0.min.js`);
    assert.equal(legacyVendor.status, 200);
  } finally {
    await server.close();
  }
});

test("main process keeps sandboxed Electron security settings", async () => {
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const preload = await readFile(path.join(experimentRoot, "preload.cjs"), "utf8");
  const securePreferences = hostContract.createSecureWebPreferences({
    preloadPath: "/tmp/preload.cjs",
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
  assert.equal(hostContract.isAllowedHostUrl("file:///tmp/test.svga", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isAllowedHostUrl("devtools://devtools/bundled/inspector.html", "http://127.0.0.1:1234"), false);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:1234/index.html", "http://127.0.0.1:1234"), true);
  assert.equal(hostContract.isExpectedSenderUrl("http://127.0.0.1:4321/index.html", "http://127.0.0.1:1234"), false);
  const invocations = [];
  const preloadApi = hostContract.createPreloadApi((channel, input) => {
    invocations.push({ channel, input });
    return { channel, input };
  }, { reportToken: "test-token", productMilestoneId: "P6" });
  assert.equal(preloadApi.hostAdapterVersion, 1);
  assert.equal(preloadApi.telemetry, "disabled");
  assert.equal(preloadApi.capabilities.arbitraryFileSystemAccess, false);
  assert.equal(preloadApi.capabilities.shellAccess, false);
  assert.deepEqual(preloadApi.capabilities.documentTypes, ["svga"]);
  assert.equal(preloadApi.openSvgaFile().channel, hostContract.IPC_CHANNELS.openSvgaFile);
  assert.equal(preloadApi.saveEditedSvga({ bytesBase64: "AA==" }).channel, hostContract.IPC_CHANNELS.saveEditedSvga);
  assert.equal(invocations.length, 2);
  assert.equal(hostContract.ELECTRON_HOST_BRIDGE_NAME, "autoSvgaElectronHost");
  assert.equal(hostContract.LEGACY_PROTOTYPE_BRIDGE_NAME, "autoSvgaPrototype");
  const hostOpenReturn = main.match(/function openSvgaFileBytes[\s\S]*?\n}\n\nasync function openSvgaFile/)?.[0] ?? "";
  assert.match(main, /createSecureWebPreferences/);
  assert.match(main, /isAllowedHostUrl/);
  assert.match(main, /isExpectedSenderUrl/);
  assert.match(main, /productSmokeMode/);
  assert.match(main, /captureProductArtifact/);
  assert.match(main, /validateArtifactScenario/);
  assert.match(main, /const productIdentity = "Auto SVGA"/);
  assert.match(main, /runtimeIdentity/);
  assert.match(main, /normalSmokeParity/);
  assert.match(main, /runtime-identity\.json/);
  assert.match(main, /normal-smoke-parity\.json/);
  assert.match(main, /normal-runtime-proof\.json/);
  assert.match(main, /desktop-loaded/);
  assert.match(main, /actual-normal-loaded/);
  assert.match(main, /IPC_CHANNELS\.openSvgaFile/);
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
  assert.doesNotMatch(main, /actualArgv:\s*process\.argv/);
  assert.match(main, /driveCanonicalNormalProof/);
  assert.match(main, /window\.autoSvgaElectronHost\?\.openSvgaFile/);
  assert.match(main, /#svgaFileInput/);
  assert.doesNotMatch(main, /fetch\("\/fixture\/avatar-frame-smoke\.svga"\)/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /will-navigate/);
  assert.match(main, /webRequest\.onBeforeRequest/);
  assert.match(preload, /ELECTRON_HOST_BRIDGE_NAME/);
  assert.match(preload, /LEGACY_PROTOTYPE_BRIDGE_NAME/);
  assert.match(preload, /hostAdapterVersion:\s*1/);
  assert.match(preload, /arbitraryFileSystemAccess:\s*false/);
  assert.doesNotMatch(preload, /require\(["']\.\/host-adapter-contract\.cjs["']\)/);
  assert.doesNotMatch(preload, /\bdialog\s*[\s,:})]|shell\.|openPath|readFile/);
  assert.doesNotMatch(preload, /require\("node:fs"\)|require\("fs"\)/);
});

test("P6 normal App proof launches without smoke query mode and uses Web baseline fixture bytes", async () => {
  const runner = await readFile(path.join(experimentRoot, "scripts/run-canonical-normal-proof.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const prepareRuntime = await readFile(path.join(experimentRoot, "scripts/prepare-runtime.mjs"), "utf8");
  const p2Fixture = await readFile(path.join(experimentRoot, "scripts/p2-fixture.mjs"), "utf8");
  const p6Evidence = await readFile(path.join(repoRoot, "tools/p6/generate-p6-evidence.mjs"), "utf8");

  assert.match(runner, /AUTO_SVGA_P2_NORMAL_PROOF/);
  assert.match(runner, /npm", \["run", "desktop:dev"\]/);
  assert.doesNotMatch(runner, /--smoke|--product-smoke|--p2-normal-proof|\?mode=smoke/);
  assert.match(main, /normalProofMode\s*\?\s*""/);
  assert.match(main, /rendererQuery: location\.search/);
  assert.match(main, /window\.autoSvgaElectronHost\?\.openSvgaFile/);
  assert.match(main, /document\.querySelector\("#svgaFileInput"\)/);
  assert.match(prepareRuntime, /examples\/avatar_frame_basic\/output\/avatar_frame_basic\.svga/);
  assert.match(prepareRuntime, /"node", \["dist\/cli\.js", "export", "examples\/avatar_frame_basic"\]/);
  assert.match(p2Fixture, /repository-avatar-frame-basic\.svga/);
  assert.doesNotMatch(p2Fixture, /synthetic-avatar-frame\.svga/);
  assert.match(p6Evidence, /Auto SVGA-darwin-arm64\/Auto SVGA\.app\/Contents\/MacOS\/Auto SVGA/);
  assert.match(p6Evidence, /AUTO_SVGA_DESKTOP_NORMAL_PROOF/);
  assert.match(p6Evidence, /packaged Auto SVGA\.app/);
  assert.doesNotMatch(p6Evidence, /AutoSVGAInternalPrototype|--product-smoke"\]|--smoke", "--product-smoke"/);
});

test("default Electron renderer shares the Web product page and keeps editor incubation hidden", async () => {
  const desktopEntry = await readFile(path.join(experimentRoot, "web/desktop-product-entry.mjs"), "utf8");
  const main = await readFile(path.join(experimentRoot, "main.cjs"), "utf8");
  const page = await readFile(path.join(experimentRoot, "web/index.html"), "utf8");
  const styles = await readFile(path.join(experimentRoot, "web/styles.css"), "utf8");
  const prototypeRenderer = await readFile(path.join(experimentRoot, "web/prototype.js"), "utf8");
  assert.match(page, /<title>auto-svga 播放验证<\/title>/);
  assert.match(page, /brandMark/);
  assert.match(page, /\/tools\/shared\/product-tokens\.css/);
  assert.match(page, /class="shell"/);
  assert.match(page, /SVGA 本地预览/);
  assert.match(page, /SVGA 信息/);
  assert.match(page, /运行日志/);
  assert.match(page, /设置/);
  assert.match(page, /floatingRoot/);
  assert.match(page, /src="\/desktop-product-entry\.mjs"/);
  assert.doesNotMatch(page, /prototype\.js/);
  assert.equal(styles.trim(), '@import url("/tools/shared/product-frontend/product-styles.css");');
  assert.match(desktopEntry, /autoSvgaHostAdapter/);
  assert.match(desktopEntry, /installSvgaWebCompatibility/);
  assert.match(desktopEntry, /\/tools\/shared\/product-frontend\/product-app\.mjs/);
  assert.match(desktopEntry, /x-auto-svga-prototype-token/);
  assert.match(desktopEntry, /editorIncubationDefaultVisible: false/);
  assert.match(desktopEntry, /class CompatibleSvgaPlayer/);
  assert.match(desktopEntry, /class CompatibleSvgaParser/);
  assert.ok(
    desktopEntry.indexOf("class CompatibleSvgaParser") < desktopEntry.indexOf("installSvgaWebCompatibility();"),
    "svga-web compatibility classes must be defined before installation"
  );
  assert.match(main, /document\.querySelector\("#svgaFileInput"\)/);
  assert.match(main, /document\.querySelector\("#svgaCanvasA canvas"\)/);
  assert.match(main, /document\.querySelector\("\.auditReportSection"\)/);
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
  assert.match(renderer, /const hostBridge = window\.autoSvgaElectronHost \?\? window\.autoSvgaPrototype/);
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
  assert.equal(rootPackage.scripts["desktop:p2:reviewer-b"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:reviewer-b");
  assert.equal(rootPackage.scripts["desktop:p2:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p2:upload-package");
  assert.equal(rootPackage.scripts["desktop:p3:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p3:upload-package");
  assert.equal(rootPackage.scripts["desktop:p4:upload-package"], "npm --prefix tools/electron-prototype/experiments/svga-web run desktop:p4:upload-package");
  assert.equal(rootPackage.scripts.test, "npm run test:all");
  assert.equal(rootPackage.scripts["local:preview"], "node tools/launch-local-preview.mjs");
  assert.match(experimentPackage.scripts["desktop:dev"], /electron \.$/);
  assert.match(experimentPackage.scripts["desktop:smoke"], /--smoke --product-smoke/);
  assert.match(experimentPackage.scripts["desktop:p2:normal-proof"], /run-canonical-normal-proof\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:reviewer-b"], /build-p2-reviewer-b-categories\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p2:upload-package"], /build-p2-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p3:upload-package"], /build-p3-upload-package\.mjs/);
  assert.match(experimentPackage.scripts["desktop:p4:upload-package"], /build-p4-upload-package\.mjs/);
  assert.doesNotMatch(experimentPackage.scripts["desktop:p2:normal-proof"], /--p2-normal-proof/);
  assert.notEqual(rootPackage.scripts["desktop:dev"], legacyPackage.scripts["spike:electron:smoke"]);
  assert.doesNotMatch(rootPackage.scripts["desktop:dev"], /tools\/electron-prototype run/);
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
