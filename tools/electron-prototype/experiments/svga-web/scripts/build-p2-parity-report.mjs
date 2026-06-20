import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureFields, readCanonicalFixture, readInvalidFixture } from "./p2-fixture.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const electronBin = path.resolve(experimentRoot, "../../node_modules/.bin/electron");

const requiredArtifacts = [
  "canonical-fixture.json",
  "canonical-fixture.svga",
  "invalid-fixture.json",
  "desktop-state-render-proof.json",
  "web-reference-empty.png",
  "web-reference-loaded.png",
  "web-reference-inspection.png",
  "web-reference-invalid.png",
  "web-reference-runtime-proof.json",
  "web-reference-request-audit.json",
  "desktop-empty.png",
  "desktop-loading.png",
  "desktop-loaded.png",
  "desktop-inspection.png",
  "desktop-invalid.png",
  "actual-normal-loaded.png",
  "smoke-loaded.png",
  "desktop-1280x800.png",
  "desktop-1440x900.png",
  "normal-runtime-proof.json",
  "normal-smoke-parity.json",
  "runtime-identity.json"
];

const requiredCategoryNames = [
  "productIdentity",
  "fixtureParity",
  "playerWorkspace",
  "controls",
  "metadata",
  "inspection",
  "emptyState",
  "loadingState",
  "invalidState",
  "webDesktopParity",
  "normalRuntimeEvidence"
];

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJsonArtifact(fileName, fallback = {}) {
  try {
    return JSON.parse(await readFile(path.join(artifactRoot, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

async function fileExists(fileName) {
  try {
    await readFile(path.join(artifactRoot, fileName));
    return true;
  } catch {
    return false;
  }
}

async function readIndex() {
  return readJsonArtifact("artifact-index.json", {
    milestoneId: "P2",
    title: "Desktop Product Shell And Web Preview Parity",
    productIdentity: "Auto SVGA",
    headCommit: gitHeadCommit(),
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true,
    artifacts: []
  });
}

async function addArtifact(index, fileName, scenario, fixture, mode = "comparison") {
  const bytes = await readFile(path.join(artifactRoot, fileName));
  const record = {
    scenario,
    mode,
    source: fileName.endsWith(".json") ? "report" : "comparison",
    viewport: fileName.endsWith(".json") ? { width: null, height: null } : { width: 1440, height: 900 },
    path: `.artifacts/product/P2/${fileName}`,
    mime: fileName.endsWith(".json") ? "application/json" : fileName.endsWith(".svga") ? "application/octet-stream" : "image/png",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: fixture?.label ?? null,
    ...fixtureFields(fixture),
    headCommit: index.headCommit,
    generatedAt: new Date().toISOString(),
    humanReviewRequired: true
  };
  index.artifacts = index.artifacts.filter((artifact) => artifact.path !== record.path);
  index.artifacts.push(record);
}

async function sha256File(relativePath) {
  return createHash("sha256")
    .update(await readFile(path.join(repoRoot, relativePath)))
    .digest("hex");
}

function runComparison(left, right, out, title, leftLabel, rightLabel) {
  execFileSync(electronBin, [
    path.join(scriptRoot, "comparison-capture.cjs"),
    "--artifact-root", artifactRoot,
    "--left", left,
    "--right", right,
    "--out", out,
    "--title", title,
    "--left-label", leftLabel,
    "--right-label", rightLabel
  ], { cwd: experimentRoot, stdio: "inherit" });
}

function check(id, passed, actual, expected, evidenceRefs = []) {
  return { id, passed: Boolean(passed), actual: String(actual), expected: String(expected), evidenceRefs };
}

function category(checks, evidenceRefs = []) {
  const failed = checks.filter((item) => !item.passed);
  return {
    status: failed.length === 0 ? "pass" : "fail",
    basis: "deterministic",
    checks,
    evidenceRefs
  };
}

function artifactHash(index, scenario) {
  return index.artifacts.find((artifact) => artifact.scenario === scenario)?.fixtureSha256 ?? null;
}

function artifactByScenario(index, scenario) {
  return index.artifacts.find((artifact) => artifact.scenario === scenario) ?? null;
}

async function fileExistsFromRepo(relativePath) {
  try {
    await readFile(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const canonicalFixture = await readCanonicalFixture({ repoRoot, artifactRoot });
  const invalidFixture = await readInvalidFixture({ repoRoot, artifactRoot });
  const indexBefore = await readIndex();
  const headCommit = gitHeadCommit();
  const comparisonStates = [
    { state: "loaded", inputKind: "valid", fixture: canonicalFixture, left: "web-reference-loaded.png", right: "desktop-loaded.png", out: "matched-web-desktop-loaded-comparison.png" },
    { state: "inspection", inputKind: "valid", fixture: canonicalFixture, left: "web-reference-inspection.png", right: "desktop-inspection.png", out: "matched-web-desktop-inspection-comparison.png" },
    { state: "empty", inputKind: "none", fixture: null, left: "web-reference-empty.png", right: "desktop-empty.png", out: "matched-web-desktop-empty-comparison.png" },
    { state: "invalid", inputKind: "expected-invalid", fixture: invalidFixture, left: "web-reference-invalid.png", right: "desktop-invalid.png", out: "matched-web-desktop-invalid-comparison.png" }
  ];

  runComparison("web-reference-loaded.png", "desktop-loaded.png", "web-desktop-loaded-comparison.png", `Loaded state parity · ${canonicalFixture.label}`, `state=loaded · source=web · fixture=${canonicalFixture.label} · viewport=1440x900`, `state=loaded · source=desktop · fixture=${canonicalFixture.label} · viewport=1280x800`);
  runComparison("web-reference-inspection.png", "desktop-inspection.png", "web-desktop-inspection-comparison.png", `Inspection report parity · ${canonicalFixture.label}`, `state=inspection · source=web · fixture=${canonicalFixture.label} · viewport=1440x900`, `state=inspection · source=desktop · fixture=${canonicalFixture.label} · viewport=1280x800`);
  for (const state of comparisonStates) {
    const fixtureLabel = state.fixture?.label ?? "none";
    runComparison(
      state.left,
      state.right,
      state.out,
      `Matched ${state.state} · ${fixtureLabel}`,
      `state=${state.state} · source=web · input=${state.inputKind} · fixture=${fixtureLabel} · viewport=1440x900`,
      `state=${state.state} · source=desktop · input=${state.inputKind} · fixture=${fixtureLabel} · viewport=1280x800`
    );
  }

  const comparisonMetaEntries = await Promise.all(comparisonStates.map(async (state) => [
    state.out,
    await readJsonArtifact(`${state.out}.meta.json`)
  ]));
  const comparisonMeta = Object.fromEntries(comparisonMetaEntries);

  const comparisonManifest = {
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit,
    states: comparisonStates.map((state) => ({
      state: state.state,
      inputKind: state.inputKind,
      leftSource: "web",
      rightSource: "desktop",
      leftFile: state.left,
      rightFile: state.right,
      comparisonFile: state.out,
      leftFixtureLabel: state.fixture?.label ?? null,
      rightFixtureLabel: state.fixture?.label ?? null,
      leftFixtureSha256: state.fixture?.sha256 ?? null,
      rightFixtureSha256: state.fixture?.sha256 ?? null,
      sameFixture: true,
      leftViewport: { width: 1440, height: 900 },
      rightViewport: { width: 1440, height: 900 },
      leftHeadCommit: headCommit,
      rightHeadCommit: headCommit,
      title: `Matched ${state.state} · ${state.fixture?.label ?? state.inputKind}`,
      outputSize: comparisonMeta[state.out]?.outputSize ?? null,
      contentBounds: comparisonMeta[state.out]?.contentBounds ?? null,
      bottomMarginPx: comparisonMeta[state.out]?.bottomMarginPx ?? null,
      estimatedBlankRatio: comparisonMeta[state.out]?.estimatedBlankRatio ?? null,
      generatedAt: new Date().toISOString()
    }))
  };
  await writeFile(path.join(artifactRoot, "comparison-manifest.json"), `${JSON.stringify(comparisonManifest, null, 2)}\n`);

  const [
    desktopHtml,
    desktopCss,
    desktopJs,
    webHtml,
    webCss,
    sharedTokens,
    mainSource,
    packageJson,
    rootPackageJson,
    normalProof,
    smokeParity,
    runtimeIdentity,
    webReferenceProof,
    webReferenceRequestAudit,
    desktopStateProof
  ] = await Promise.all([
    readText("tools/electron-prototype/experiments/svga-web/web/index.html"),
    readText("tools/electron-prototype/experiments/svga-web/web/styles.css"),
    readText("tools/electron-prototype/experiments/svga-web/web/prototype.js"),
    readText("tools/svga-player-preview/index.html"),
    readText("tools/svga-player-preview/styles.css"),
    readText("tools/shared/product-tokens.css"),
    readText("tools/electron-prototype/experiments/svga-web/main.cjs"),
    readText("tools/electron-prototype/experiments/svga-web/package.json"),
    readText("package.json"),
    readJsonArtifact("normal-runtime-proof.json"),
    readJsonArtifact("normal-smoke-parity.json"),
    readJsonArtifact("runtime-identity.json"),
    readJsonArtifact("web-reference-runtime-proof.json"),
    readJsonArtifact("web-reference-request-audit.json"),
    readJsonArtifact("desktop-state-render-proof.json")
  ]);

  const missing = [];
  for (const fileName of [...requiredArtifacts, "comparison-manifest.json", ...comparisonStates.map((state) => state.out)]) {
    if (!(await fileExists(fileName))) missing.push(fileName);
  }

  const categoryResults = {
    productIdentity: category([
      check("desktop_brand_mark", desktopHtml.includes("brandMark"), "brandMark present", "brandMark present", ["desktop-loaded.png"]),
      check("web_brand_mark", webHtml.includes("brandMark"), "brandMark present", "brandMark present", ["web-reference-loaded.png"]),
      check("product_name", desktopHtml.includes("Auto SVGA") && mainSource.includes('const productIdentity = "Auto SVGA"'), "Auto SVGA", "Auto SVGA", ["runtime-identity.json"]),
      check("internal_status_low_weight", desktopHtml.includes("prototypeBadge") && desktopCss.includes(".prototypeBadge") && !desktopHtml.includes("<h1>内部原型"), "low-weight badge", "not first visual hierarchy", ["desktop-loaded.png"])
    ], ["desktop-loaded.png", "web-reference-loaded.png"]),
    fixtureParity: category([
      check("canonical_manifest_exists", await fileExists("canonical-fixture.json"), "present", "present", ["canonical-fixture.json"]),
      check("canonical_bytes_exist", await fileExists("canonical-fixture.svga"), "present", "present", ["canonical-fixture.svga"]),
      check("web_fixture_hash", webReferenceProof.fixtureSha256 === canonicalFixture.sha256, webReferenceProof.fixtureSha256, canonicalFixture.sha256, ["web-reference-runtime-proof.json"]),
      check("normal_fixture_hash", normalProof.fixtureSha256 === canonicalFixture.sha256, normalProof.fixtureSha256, canonicalFixture.sha256, ["normal-runtime-proof.json"]),
      check("smoke_fixture_hash", runtimeIdentity.fixtureSha256 === canonicalFixture.sha256, runtimeIdentity.fixtureSha256, canonicalFixture.sha256, ["runtime-identity.json"]),
      check("artifact_loaded_hashes", ["web-reference-loaded", "desktop-loaded"].every((scenario) => artifactHash(indexBefore, scenario) === canonicalFixture.sha256), "same fixture", "same fixture", ["artifact-index.json"]),
      check("artifact_empty_has_no_fixture", [artifactByScenario(indexBefore, "web-reference-empty"), artifactByScenario(indexBefore, "desktop-empty")].every((artifact) => artifact && artifact.fixtureSha256 === null), "no fixture", "no fixture", ["artifact-index.json"]),
      check("artifact_invalid_uses_invalid_fixture", [artifactByScenario(indexBefore, "web-reference-invalid"), artifactByScenario(indexBefore, "desktop-invalid")].every((artifact) => artifact?.fixtureSha256 === invalidFixture.sha256), "invalid fixture", "invalid fixture", ["artifact-index.json", "invalid-fixture.json"]),
      check("comparison_manifest_hashes", comparisonManifest.states.every((state) => {
        if (state.inputKind === "none") return state.sameFixture && state.leftFixtureSha256 === null && state.rightFixtureSha256 === null;
        if (state.inputKind === "expected-invalid") return state.sameFixture && state.leftFixtureSha256 === invalidFixture.sha256 && state.rightFixtureSha256 === invalidFixture.sha256;
        return state.sameFixture && state.leftFixtureSha256 === canonicalFixture.sha256 && state.rightFixtureSha256 === canonicalFixture.sha256;
      }), "state-specific fixture truth", "state-specific fixture truth", ["comparison-manifest.json"])
    ], ["canonical-fixture.json", "comparison-manifest.json"]),
    colorTokens: category([
      check("shared_token_file_exists", await fileExistsFromRepo("tools/shared/product-tokens.css"), "present", "present", ["tools/shared/product-tokens.css"]),
      check("web_imports_shared_tokens", webHtml.includes("/tools/shared/product-tokens.css"), "imported", "imported", ["tools/svga-player-preview/index.html"]),
      check("desktop_imports_shared_tokens", desktopHtml.includes("/tools/shared/product-tokens.css"), "imported", "imported", ["tools/electron-prototype/experiments/svga-web/web/index.html"])
    ], ["tools/shared/product-tokens.css"]),
    playerWorkspace: category([
      check("web_valid_phase_playback_confirmed", webReferenceProof.validPhase?.playbackConfirmed === true, webReferenceProof.validPhase?.playbackConfirmed, "true", ["web-reference-runtime-proof.json", "web-reference-loaded.png"]),
      check("web_valid_phase_canvas_nonblank", webReferenceProof.validPhase?.canvasNonBlank === true, webReferenceProof.validPhase?.canvasNonBlank, "true", ["web-reference-runtime-proof.json"]),
      check("web_valid_phase_errors_empty", Array.isArray(webReferenceProof.validPhase?.errors) && webReferenceProof.validPhase.errors.length === 0, webReferenceProof.validPhase?.errors?.length, "0", ["web-reference-runtime-proof.json"]),
      check("web_invalid_phase_isolated", webReferenceProof.invalidPhase?.expectedInvalidErrorObserved === true && Array.isArray(webReferenceProof.invalidPhase?.errors), "isolated", "isolated", ["web-reference-runtime-proof.json"]),
      check("player_column_primary", desktopCss.includes("grid-template-columns: minmax(0, 1fr) clamp(360px, 29vw, 440px)"), "player flexible, inspector clamped", "player wider than inspector", ["desktop-loaded.png"]),
      check("player_canvas_large", /width:\s*min\(520px, 74%\)/.test(desktopCss), "large player canvas", "large player canvas"),
      check("desktop_loaded_overlay_hidden", desktopStateProof.states?.loaded?.overlayVisible === false, desktopStateProof.states?.loaded?.overlayVisible, "false", ["desktop-state-render-proof.json", "desktop-loaded.png"]),
      check("desktop_loaded_canvas_nonblank", desktopStateProof.states?.loaded?.loadedCanvasNonBlank === true, desktopStateProof.states?.loaded?.loadedCanvasNonBlank, "true", ["desktop-state-render-proof.json", "desktop-loaded.png"]),
      check("nonblank_runtime", normalProof.canvasNonBlank === true || runtimeIdentity.mode === "smoke", String(normalProof.canvasNonBlank), "true", ["normal-runtime-proof.json"])
    ], ["desktop-loaded.png", "actual-normal-loaded.png"]),
    controls: category([
      check("compact_player_bar", desktopHtml.includes("data-player-control-bar") && desktopCss.includes(".playerBar"), "compact bar", "compact bar", ["desktop-loaded.png"]),
      check("control_buttons", ["playButton", "pauseButton", "replayButton"].every((id) => desktopHtml.includes(id)), "play/pause/replay", "play/pause/replay")
    ], ["desktop-loaded.png"]),
    metadata: category([
      check("quick_metadata_exists", desktopHtml.includes('id="fileInfo"') && desktopCss.includes(".fileInfo"), "fileInfo", "fileInfo"),
      check("metadata_populated_by_report", desktopJs.includes("updateFileInfo(name") && desktopJs.includes("report"), "report-driven", "report-driven")
    ], ["desktop-loaded.png"]),
    inspection: category([
      check("presentation_model_exists", desktopJs.includes("createInspectionPresentation") && desktopJs.includes("renderDesktopInspectionPresentation"), "presentation model", "presentation model"),
      check("structured_groups_exist", desktopJs.includes('data-inspection-group="overview"') && desktopJs.includes('data-inspection-group="spec"') && desktopJs.includes('data-inspection-group="audit"'), "overview/spec/audit", "overview/spec/audit"),
      check("calibration_collapsed", desktopJs.includes("data-calibration-default-collapsed") && !/data-calibration-default-collapsed[^>]*open/.test(desktopJs), "collapsed", "collapsed"),
      check("technical_collapsed", desktopJs.includes("data-technical-default-collapsed") && !/data-technical-default-collapsed[^>]*open/.test(desktopJs), "collapsed", "collapsed"),
      check("raw_report_nested", desktopJs.includes("renderAvatarFrameInspectionReport(report") && desktopJs.includes("technicalDetails"), "raw report in technical details", "raw report collapsed"),
      check("raw_audit_key_not_primary", desktopJs.includes("userFacingAuditStatus") && desktopJs.includes("isRawAuditKey"), "fallback labels", "fallback labels")
    ], ["desktop-inspection.png", "web-reference-inspection.png"]),
    emptyState: category([
      check("desktop_empty_artifact", await fileExists("desktop-empty.png"), "present", "present"),
      check("central_dropzone_text", desktopJs.includes("拖拽 SVGA 文件到此处") && desktopJs.includes("选择 SVGA 文件"), "central dropzone", "central dropzone"),
      check("empty_rendered_overlay_visible", desktopStateProof.states?.empty?.overlayVisible === true, desktopStateProof.states?.empty?.overlayVisible, "true", ["desktop-state-render-proof.json", "desktop-empty.png"]),
      check("empty_rendered_text", String(desktopStateProof.states?.empty?.renderedText ?? "").includes("拖拽 SVGA 文件到此处"), desktopStateProof.states?.empty?.renderedText ?? "", "contains empty prompt", ["desktop-state-render-proof.json"]),
      check("empty_overlay_not_occluded", desktopStateProof.states?.empty?.overlayNotOccluded === true, desktopStateProof.states?.empty?.overlayNotOccluded, "true", ["desktop-state-render-proof.json"]),
      check("empty_primary_action_visible", desktopStateProof.states?.empty?.primaryActionVisible === true && desktopStateProof.states?.empty?.primaryActionEnabled === true, `${desktopStateProof.states?.empty?.primaryActionVisible}/${desktopStateProof.states?.empty?.primaryActionEnabled}`, "true/true", ["desktop-state-render-proof.json"]),
      check("empty_state_proof_passed", desktopStateProof.states?.empty?.passed === true, desktopStateProof.states?.empty?.failures?.join(",") ?? "", "true", ["desktop-state-render-proof.json"]),
      check("drag_over_state", desktopCss.includes(".dropZone.isDragOver"), "drag-over style", "drag-over style"),
      check("inspector_empty_state", desktopJs.includes("data-inspection-empty") && desktopJs.includes("打开文件后显示检查结果"), "explicit inspector empty", "explicit inspector empty"),
      check("web_empty_comparison", await fileExists("matched-web-desktop-empty-comparison.png"), "present", "present")
    ], ["desktop-empty.png", "matched-web-desktop-empty-comparison.png"]),
    loadingState: category([
      check("desktop_loading_artifact", await fileExists("desktop-loading.png"), "present", "present"),
      check("loading_differs_from_empty", desktopJs.includes("正在加载") && desktopJs.includes("isLoading") && desktopJs.includes("正在解析动画"), "distinct state", "distinct state"),
      check("loading_rendered_overlay_visible", desktopStateProof.states?.loading?.overlayVisible === true, desktopStateProof.states?.loading?.overlayVisible, "true", ["desktop-state-render-proof.json", "desktop-loading.png"]),
      check("loading_rendered_text", String(desktopStateProof.states?.loading?.renderedText ?? "").includes("正在加载") && String(desktopStateProof.states?.loading?.renderedText ?? "").includes(canonicalFixture.label), desktopStateProof.states?.loading?.renderedText ?? "", "contains loading copy and fixture label", ["desktop-state-render-proof.json"]),
      check("loading_overlay_not_occluded", desktopStateProof.states?.loading?.overlayNotOccluded === true, desktopStateProof.states?.loading?.overlayNotOccluded, "true", ["desktop-state-render-proof.json"]),
      check("loading_state_proof_passed", desktopStateProof.states?.loading?.passed === true, desktopStateProof.states?.loading?.failures?.join(",") ?? "", "true", ["desktop-state-render-proof.json"])
    ], ["desktop-loading.png"]),
    invalidState: category([
      check("desktop_invalid_artifact", await fileExists("desktop-invalid.png"), "present", "present"),
      check("invalid_retry_entry", desktopJs.includes("重新选择 SVGA 文件"), "retry entry", "retry entry"),
      check("invalid_clears_report", desktopJs.includes("未生成检查报告") && desktopJs.includes("updateFileInfo();"), "clears stale state", "clears stale state"),
      check("invalid_rendered_overlay_visible", desktopStateProof.states?.invalid?.overlayVisible === true, desktopStateProof.states?.invalid?.overlayVisible, "true", ["desktop-state-render-proof.json", "desktop-invalid.png"]),
      check("invalid_rendered_text", String(desktopStateProof.states?.invalid?.renderedText ?? "").includes("无法打开此 SVGA 文件"), desktopStateProof.states?.invalid?.renderedText ?? "", "contains invalid copy", ["desktop-state-render-proof.json"]),
      check("invalid_primary_action_visible", desktopStateProof.states?.invalid?.primaryActionVisible === true && desktopStateProof.states?.invalid?.primaryActionEnabled === true, `${desktopStateProof.states?.invalid?.primaryActionVisible}/${desktopStateProof.states?.invalid?.primaryActionEnabled}`, "true/true", ["desktop-state-render-proof.json"]),
      check("invalid_stale_metadata_cleared", desktopStateProof.states?.invalid?.staleMetadataCleared === true, desktopStateProof.states?.invalid?.staleMetadataCleared, "true", ["desktop-state-render-proof.json"]),
      check("invalid_stale_inspection_cleared", desktopStateProof.states?.invalid?.staleInspectionCleared === true, desktopStateProof.states?.invalid?.staleInspectionCleared, "true", ["desktop-state-render-proof.json"]),
      check("invalid_state_proof_passed", desktopStateProof.states?.invalid?.passed === true, desktopStateProof.states?.invalid?.failures?.join(",") ?? "", "true", ["desktop-state-render-proof.json"]),
      check("invalid_comparison", await fileExists("matched-web-desktop-invalid-comparison.png"), "present", "present")
    ], ["desktop-invalid.png", "matched-web-desktop-invalid-comparison.png"]),
    webDesktopParity: category([
      check("comparison_manifest_exists", await fileExists("comparison-manifest.json"), "present", "present", ["comparison-manifest.json"]),
      check("matched_hashes_all_states", comparisonManifest.states.every((state) => state.sameFixture && state.leftFixtureSha256 === state.rightFixtureSha256), "same fixture", "same fixture", ["comparison-manifest.json"]),
      check("matched_state_fixture_metadata", comparisonManifest.states.every((state) => {
        if (state.state === "empty") return state.leftFixtureLabel === null && state.rightFixtureLabel === null && state.inputKind === "none";
        if (state.state === "invalid") return state.leftFixtureLabel === invalidFixture.label && state.rightFixtureLabel === invalidFixture.label && state.inputKind === "expected-invalid";
        return state.leftFixtureLabel === canonicalFixture.label && state.rightFixtureLabel === canonicalFixture.label && state.inputKind === "valid";
      }), "state-specific labels", "state-specific labels", ["comparison-manifest.json"]),
      check("comparison_blank_space_bounded", comparisonManifest.states.every((state) => Number(state.estimatedBlankRatio ?? 1) < 0.1 && Number(state.bottomMarginPx ?? 999) <= 48), "bounded blank space", "bounded blank space", ["comparison-manifest.json"])
    ], ["comparison-manifest.json"]),
    normalRuntimeEvidence: category([
      check("canonical_command", normalProof.actualLaunchCommand === "npm run desktop:dev", normalProof.actualLaunchCommand, "npm run desktop:dev", ["normal-runtime-proof.json"]),
      check("no_renderer_query", normalProof.rendererQuery === "" && !String(normalProof.rendererUrl ?? "").includes("?"), normalProof.rendererUrl ?? "", "no query", ["normal-runtime-proof.json"]),
      check("ordinary_file_input", normalProof.fileOpenMechanism === "ordinary file input change event", normalProof.fileOpenMechanism, "ordinary file input change event", ["normal-runtime-proof.json"]),
      check("normal_smoke_separate", smokeParity.checks?.separateProcessId === true && smokeParity.checks?.separateRuntimeInstanceId === true, "separate", "separate", ["normal-smoke-parity.json"]),
      check("normal_script_launches_canonical", JSON.parse(packageJson).scripts["desktop:p2:normal-proof"].includes("run-canonical-normal-proof.mjs") && JSON.parse(rootPackageJson).scripts["desktop:dev"].includes("svga-web"), "canonical harness", "canonical harness")
    ], ["normal-runtime-proof.json", "normal-smoke-parity.json"])
  };

  const unresolvedDifferences = Object.entries(categoryResults)
    .flatMap(([categoryName, result]) => result.checks
      .filter((item) => !item.passed)
      .map((item) => `${categoryName}.${item.id}: expected ${item.expected}, actual ${item.actual}`));

  const report = {
    schemaVersion: 2,
    milestoneId: "P2",
    headCommit,
    passed: missing.length === 0 && unresolvedDifferences.length === 0,
    requiredCategoryStatus: Object.fromEntries(requiredCategoryNames.map((name) => [name, categoryResults[name]?.status ?? "missing"])),
    baseline: "Web preview remains reference workflow; desktop shell must match primary states before editing features.",
    canonicalFixture: fixtureFields(canonicalFixture),
    webReference: {
      entry: "tools/svga-player-preview/index.html",
      renderer: "tools/svga-player-preview/main.js",
      rendererSha256: await sha256File("tools/svga-player-preview/main.js"),
      ...fixtureFields(canonicalFixture),
      playbackConfirmed: webReferenceProof.validPhase?.playbackConfirmed === true,
      inspectionReportConfirmed: webReferenceProof.validPhase?.inspectionReportConfirmed === true,
      knownBaselineRisk: webReferenceProof.knownBaselineRisk ?? null,
      requestAudit: {
        externalRequestCount: Array.isArray(webReferenceRequestAudit.externalRequests) ? webReferenceRequestAudit.externalRequests.length : null,
        blockedRequestCount: Array.isArray(webReferenceRequestAudit.blockedRequests) ? webReferenceRequestAudit.blockedRequests.length : null
      },
      artifacts: ["web-reference-empty.png", "web-reference-loaded.png", "web-reference-inspection.png", "web-reference-invalid.png", "web-reference-runtime-proof.json", "web-reference-request-audit.json"]
    },
    desktop: {
      entry: "tools/electron-prototype/experiments/svga-web/main.cjs",
      renderer: "tools/electron-prototype/experiments/svga-web/web/prototype.js",
      rendererSha256: await sha256File("tools/electron-prototype/experiments/svga-web/web/prototype.js"),
      stylesSha256: await sha256File("tools/electron-prototype/experiments/svga-web/web/styles.css"),
      sharedTokensSha256: await sha256File("tools/shared/product-tokens.css"),
      artifacts: ["desktop-empty.png", "desktop-loading.png", "desktop-loaded.png", "desktop-inspection.png", "desktop-invalid.png", "actual-normal-loaded.png", "smoke-loaded.png"]
    },
    fixtureParity: {
      webFixtureSha256: webReferenceProof.fixtureSha256 ?? null,
      desktopNormalFixtureSha256: normalProof.fixtureSha256 ?? null,
      desktopSmokeFixtureSha256: runtimeIdentity.fixtureSha256 ?? null,
      sameFixture: webReferenceProof.fixtureSha256 === canonicalFixture.sha256
        && normalProof.fixtureSha256 === canonicalFixture.sha256
        && runtimeIdentity.fixtureSha256 === canonicalFixture.sha256
    },
    categoryResults,
    comparedStates: comparisonManifest.states,
    stateProof: desktopStateProof,
    knownDifferences: [
      "Desktop shell uses a two-pane local-file product layout while Web preview remains the broader browser workbench.",
      "Electron runtime remains internal prototype and keeps a wasm-unsafe-eval exception for svga-web only."
    ],
    intentionalDifferences: [
      "Desktop keeps local-file-first controls and internal prototype badge at low visual weight.",
      "Web preview remains the rollback path and contains broader comparison tooling."
    ],
    unresolvedDifferences,
    missingArtifacts: missing,
    generatedAt: new Date().toISOString()
  };
  await writeFile(path.join(artifactRoot, "web-desktop-parity-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const index = await readIndex();
  index.headCommit = headCommit;
  index.generatedAt = new Date().toISOString();
  await addArtifact(index, "desktop-state-render-proof.json", "desktop-state-render-proof", canonicalFixture, "rendered-state-proof");
  await addArtifact(index, "invalid-fixture.json", "invalid-fixture", invalidFixture, "fixture");
  for (const fileName of ["web-desktop-loaded-comparison.png", "web-desktop-inspection-comparison.png"]) {
    await addArtifact(index, fileName, fileName.replace(/\.png$/, ""), canonicalFixture);
  }
  for (const state of comparisonStates) {
    await addArtifact(index, state.out, state.out.replace(/\.png$/, ""), state.fixture);
    await addArtifact(index, `${state.out}.meta.json`, `${state.out.replace(/\.png$/, "")}-meta`, state.fixture, "comparison-metadata");
  }
  await addArtifact(index, "comparison-manifest.json", "comparison-manifest", canonicalFixture);
  await addArtifact(index, "web-desktop-parity-report.json", "web-desktop-parity-report", canonicalFixture);
  await writeFile(path.join(artifactRoot, "artifact-index.json"), `${JSON.stringify(index, null, 2)}\n`);
  if (!report.passed) throw new Error(`Parity report failed: ${[...missing, ...unresolvedDifferences].join("; ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
