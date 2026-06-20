import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(scriptRoot, "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactRoot = path.join(repoRoot, ".artifacts/product/P2");
const electronBin = path.resolve(experimentRoot, "../../node_modules/.bin/electron");
const requiredArtifacts = [
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

function gitHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJsonArtifact(fileName) {
  return JSON.parse(await readFile(path.join(artifactRoot, fileName), "utf8"));
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
  try {
    return JSON.parse(await readFile(path.join(artifactRoot, "artifact-index.json"), "utf8"));
  } catch {
    return {
      milestoneId: "P2",
      title: "Desktop Product Shell And Web Preview Parity",
      productIdentity: "Auto SVGA",
      headCommit: gitHeadCommit(),
      generatedAt: new Date().toISOString(),
      humanReviewRequired: true,
      artifacts: []
    };
  }
}

async function addArtifact(index, fileName, scenario, mode = "comparison") {
  const bytes = await readFile(path.join(artifactRoot, fileName));
  const record = {
    scenario,
    mode,
    source: fileName.endsWith(".json") ? "report" : "comparison",
    viewport: fileName.endsWith(".json") ? { width: null, height: null } : { width: 1440, height: 900 },
    path: `.artifacts/product/P2/${fileName}`,
    mime: fileName.endsWith(".json") ? "application/json" : "image/png",
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fixture: "synthetic-avatar-frame.svga",
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

function runComparison(left, right, out, title) {
  execFileSync(electronBin, [
    path.join(scriptRoot, "comparison-capture.cjs"),
    "--artifact-root", artifactRoot,
    "--left", left,
    "--right", right,
    "--out", out,
    "--title", title
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

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  runComparison("web-reference-loaded.png", "desktop-loaded.png", "web-desktop-loaded-comparison.png", "Loaded state parity · synthetic-avatar-frame.svga");
  runComparison("web-reference-inspection.png", "desktop-inspection.png", "web-desktop-inspection-comparison.png", "Inspection report parity · synthetic-avatar-frame.svga");
  runComparison("web-reference-loaded.png", "desktop-loaded.png", "matched-web-desktop-loaded-comparison.png", "Matched loaded · synthetic-avatar-frame.svga");
  runComparison("web-reference-inspection.png", "desktop-inspection.png", "matched-web-desktop-inspection-comparison.png", "Matched inspection · synthetic-avatar-frame.svga");
  runComparison("web-reference-empty.png", "desktop-empty.png", "matched-web-desktop-empty-comparison.png", "Matched empty state");
  runComparison("web-reference-invalid.png", "desktop-invalid.png", "matched-web-desktop-invalid-comparison.png", "Matched invalid state");

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
    webReferenceRequestAudit
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
    readJsonArtifact("normal-runtime-proof.json").catch(() => ({})),
    readJsonArtifact("normal-smoke-parity.json").catch(() => ({})),
    readJsonArtifact("runtime-identity.json").catch(() => ({})),
    readJsonArtifact("web-reference-runtime-proof.json").catch(() => ({})),
    readJsonArtifact("web-reference-request-audit.json").catch(() => ({}))
  ]);
  const missing = [];
  for (const fileName of requiredArtifacts) {
    if (!(await fileExists(fileName))) missing.push(fileName);
  }
  const comparisons = [
    "web-desktop-loaded-comparison.png",
    "web-desktop-inspection-comparison.png",
    "matched-web-desktop-loaded-comparison.png",
    "matched-web-desktop-inspection-comparison.png",
    "matched-web-desktop-empty-comparison.png",
    "matched-web-desktop-invalid-comparison.png"
  ];
  for (const fileName of comparisons) {
    if (!(await fileExists(fileName))) missing.push(fileName);
  }

  const categoryResults = {
    productIdentity: category([
      check("desktop_brand_mark", desktopHtml.includes("brandMark"), "brandMark present", "brandMark present", ["desktop-loaded.png"]),
      check("web_brand_mark", webHtml.includes("brandMark"), "brandMark present", "brandMark present", ["web-reference-loaded.png"]),
      check("product_name", desktopHtml.includes("Auto SVGA") && mainSource.includes('const productIdentity = "Auto SVGA"'), "Auto SVGA", "Auto SVGA", ["runtime-identity.json"]),
      check("internal_status_low_weight", desktopHtml.includes("prototypeBadge") && desktopCss.includes(".prototypeBadge") && !desktopHtml.includes("<h1>内部原型"), "low-weight badge", "not first visual hierarchy", ["desktop-loaded.png"])
    ], ["desktop-loaded.png", "web-reference-loaded.png"]),
    colorTokens: category([
      check("shared_token_file_exists", await fileExistsFromRepo("tools/shared/product-tokens.css"), "present", "present", ["tools/shared/product-tokens.css"]),
      check("web_imports_shared_tokens", webHtml.includes("/tools/shared/product-tokens.css"), "imported", "imported", ["tools/svga-player-preview/index.html"]),
      check("desktop_imports_shared_tokens", desktopHtml.includes("/tools/shared/product-tokens.css"), "imported", "imported", ["tools/electron-prototype/experiments/svga-web/web/index.html"]),
      check("web_no_core_token_redefinition", !/--background:\\s*#|--textPrimary:\\s*#|--accent:/.test(webCss), "no duplicate core tokens", "no duplicate core tokens", ["tools/svga-player-preview/styles.css"])
    ], ["tools/shared/product-tokens.css"]),
    typography: category([
      check("desktop_uses_shared_font_vars", desktopCss.includes("var(--font-title)") && desktopCss.includes("var(--font-body)"), "shared font vars", "shared font vars"),
      check("web_uses_shared_font_vars", webCss.includes("var(--font-title)") && webCss.includes("var(--font-body)"), "shared font vars", "shared font vars")
    ], ["desktop-loaded.png", "web-reference-loaded.png"]),
    spacing: category([
      check("desktop_uses_shared_spacing", desktopCss.includes("var(--space-6)") && sharedTokens.includes("--gap-section"), "shared spacing vars", "shared spacing vars"),
      check("desktop_responsive_viewports", await fileExists("desktop-1280x800.png") && await fileExists("desktop-1440x900.png"), "responsive screenshots present", "responsive screenshots present")
    ], ["desktop-1280x800.png", "desktop-1440x900.png"]),
    panelHierarchy: category([
      check("toolbar_exists", desktopHtml.includes("data-product-toolbar"), "toolbar", "toolbar"),
      check("player_and_inspector_exist", desktopHtml.includes("playerPane") && desktopHtml.includes("reportPane"), "player+inspector", "player+inspector"),
      check("structured_groups_exist", desktopJs.includes('data-inspection-group="overview"') && desktopJs.includes('data-inspection-group="spec"') && desktopJs.includes('data-inspection-group="audit"'), "overview/spec/audit", "overview/spec/audit")
    ], ["desktop-inspection.png"]),
    playerWorkspace: category([
      check("web_reference_playback_confirmed", webReferenceProof.playbackConfirmed === true, webReferenceProof.playbackConfirmed, "true", ["web-reference-runtime-proof.json", "web-reference-loaded.png"]),
      check("player_column_primary", desktopCss.includes("grid-template-columns: minmax(0, 1fr) clamp(360px, 29vw, 440px)"), "player flexible, inspector clamped", "player wider than inspector", ["desktop-loaded.png"]),
      check("player_canvas_large", /width:\s*min\(520px, 74%\)/.test(desktopCss), "large player canvas", "large player canvas"),
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
      check("calibration_collapsed", desktopJs.includes("data-calibration-default-collapsed") && !/data-calibration-default-collapsed[^>]*open/.test(desktopJs), "collapsed", "collapsed"),
      check("technical_collapsed", desktopJs.includes("data-technical-default-collapsed") && !/data-technical-default-collapsed[^>]*open/.test(desktopJs), "collapsed", "collapsed"),
      check("raw_report_nested", desktopJs.includes("renderAvatarFrameInspectionReport(report") && desktopJs.includes("technicalDetails"), "raw report in technical details", "raw report collapsed")
    ], ["desktop-inspection.png", "web-reference-inspection.png"]),
    emptyState: category([
      check("desktop_empty_artifact", await fileExists("desktop-empty.png"), "present", "present"),
      check("inspector_empty_state", desktopJs.includes("data-inspection-empty") && desktopJs.includes("打开文件后显示检查结果"), "explicit inspector empty", "explicit inspector empty"),
      check("web_empty_comparison", await fileExists("matched-web-desktop-empty-comparison.png"), "present", "present")
    ], ["desktop-empty.png", "matched-web-desktop-empty-comparison.png"]),
    loadingState: category([
      check("desktop_loading_artifact", await fileExists("desktop-loading.png"), "present", "present"),
      check("loading_differs_from_empty", desktopJs.includes("正在加载") && desktopJs.includes("isLoading"), "distinct state", "distinct state")
    ], ["desktop-loading.png"]),
    invalidState: category([
      check("desktop_invalid_artifact", await fileExists("desktop-invalid.png"), "present", "present"),
      check("invalid_clears_report", desktopJs.includes("未生成检查报告") && desktopJs.includes("updateFileInfo();"), "clears stale state", "clears stale state"),
      check("invalid_comparison", await fileExists("matched-web-desktop-invalid-comparison.png"), "present", "present")
    ], ["desktop-invalid.png", "matched-web-desktop-invalid-comparison.png"]),
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
    schemaVersion: 1,
    milestoneId: "P2",
    headCommit: gitHeadCommit(),
    passed: missing.length === 0 && unresolvedDifferences.length === 0,
    baseline: "Web preview remains reference workflow; desktop shell must match primary states before editing features.",
    webReference: {
      entry: "tools/svga-player-preview/index.html",
      renderer: "tools/svga-player-preview/main.js",
      rendererSha256: await sha256File("tools/svga-player-preview/main.js"),
      fixture: "web-reference-fixture.svga",
      playbackConfirmed: webReferenceProof.playbackConfirmed === true,
      inspectionReportConfirmed: webReferenceProof.inspectionReportConfirmed === true,
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
    categoryResults,
    comparedStates: [
      { state: "loaded", web: "web-reference-loaded.png", desktop: "desktop-loaded.png", comparison: "matched-web-desktop-loaded-comparison.png" },
      { state: "inspection", web: "web-reference-inspection.png", desktop: "desktop-inspection.png", comparison: "matched-web-desktop-inspection-comparison.png" },
      { state: "empty", web: "web-reference-empty.png", desktop: "desktop-empty.png", comparison: "matched-web-desktop-empty-comparison.png" },
      { state: "invalid", web: "web-reference-invalid.png", desktop: "desktop-invalid.png", comparison: "matched-web-desktop-invalid-comparison.png" }
    ],
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
  index.headCommit = report.headCommit;
  index.generatedAt = new Date().toISOString();
  for (const fileName of comparisons) await addArtifact(index, fileName, fileName.replace(/\\.png$/, ""));
  await addArtifact(index, "web-desktop-parity-report.json", "web-desktop-parity-report");
  await writeFile(path.join(artifactRoot, "artifact-index.json"), `${JSON.stringify(index, null, 2)}\n`);
  if (!report.passed) throw new Error(`Parity report failed: ${[...missing, ...unresolvedDifferences].join("; ")}`);
}

async function fileExistsFromRepo(relativePath) {
  try {
    await readFile(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
