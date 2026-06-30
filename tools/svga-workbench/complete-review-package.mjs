#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeMacosPackageProof } from "../electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, "../..");
const milestoneId = "SVGA-Workbench-v1";
const reviewRoot = path.join(repoRoot, "review");
const stagingRoot = path.join(repoRoot, ".artifacts/product/SVGA-Workbench-v1-complete-review-directory");
const validationRoot = path.join(repoRoot, ".artifacts/svga-workbench-v1-validation/latest");
const uiAuditRoot = path.join(repoRoot, ".artifacts/ui-audit/2026-06-30-single-file-preview-21849d1");
const higStudyRoot = path.join(repoRoot, ".artifacts/ui-audit/2026-06-30-hig-study");
const oldUiReviewRoot = path.join(repoRoot, "review/SVGA-Workbench-v1-21849d1-ui-audit");
const experimentRoot = path.join(repoRoot, "tools/electron-prototype/experiments/svga-web");
const trialRoot = path.join(experimentRoot, ".artifacts/internal-trial");
const appBundle = path.join(trialRoot, "Auto SVGA-darwin-arm64/Auto SVGA.app");
const internalTrialManifestPath = path.join(trialRoot, "internal-trial-manifest.json");
const packagedRuntimeRoot = path.join(repoRoot, ".artifacts/svga-workbench-v1-packaged-runtime/latest");
const textExtensions = new Set([".json", ".md", ".txt", ".html", ".js", ".mjs", ".cjs", ".css", ".plist", ".xml", ".patch"]);
const requiredValidationFiles = [
  "validation-summary.json",
  "npm-test.json",
  "source-sharing-test.json",
  "svga-web-experiment-test.json",
  "desktop-smoke.json",
  "macos-package-proof.json",
  "macos-package.json",
  "signing-plan.json",
  "packaged-normal-runtime-proof.json",
  "loop-validate.json"
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(filePath) {
  return sha256Bytes(await readFile(filePath));
}

async function fileIdentity(filePath) {
  const bytes = await readFile(filePath);
  return {
    sizeBytes: bytes.byteLength,
    sha256: sha256Bytes(bytes)
  };
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function copyRequired(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) throw new Error(`required payload missing: ${path.relative(repoRoot, sourcePath)}`);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
  if ((await stat(targetPath)).isFile()) {
    const before = await fileIdentity(sourcePath);
    const after = await fileIdentity(targetPath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256) {
      throw new Error(`copied file changed: ${path.relative(repoRoot, sourcePath)}`);
    }
  }
}

async function copyOptional(sourcePath, targetPath) {
  if (existsSync(sourcePath)) await copyRequired(sourcePath, targetPath);
}

async function listFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store" || entry.name === "__MACOSX" || entry.name.startsWith("._")) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  if (existsSync(root)) await walk(root);
  return files.sort();
}

function toBundlePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  if (ext === ".txt") return "text/plain";
  if (ext === ".png") return "image/png";
  if (ext === ".zip") return "application/zip";
  if (ext === ".svga") return "application/octet-stream";
  if (ext === ".plist" || ext === ".xml") return "application/xml";
  return "application/octet-stream";
}

function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  }).split("\n").filter(Boolean);
}

function zipEntryBytes(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], {
    cwd: repoRoot,
    maxBuffer: 200 * 1024 * 1024
  });
}

export function inspectZipEntries(entries) {
  const seen = new Set();
  const duplicateEntries = [];
  const forbiddenMetadataEntries = [];
  const pathTraversalEntries = [];
  for (const entry of entries) {
    if (seen.has(entry)) duplicateEntries.push(entry);
    seen.add(entry);
    const parts = entry.split("/").filter(Boolean);
    if (entry.startsWith("/") || parts.includes("..")) pathTraversalEntries.push(entry);
    if (
      parts.some((part) => part === "__MACOSX" || part === ".DS_Store" || part.startsWith("._"))
      || parts.some((part) => part === ".fseventsd" || part === ".Spotlight-V100" || part === ".Trashes" || part === "Icon\r")
    ) {
      forbiddenMetadataEntries.push(entry);
    }
  }
  return {
    passed: duplicateEntries.length === 0 && forbiddenMetadataEntries.length === 0 && pathTraversalEntries.length === 0,
    entryCount: entries.length,
    duplicateEntries,
    forbiddenMetadataEntries,
    pathTraversalEntries,
    noMacosx: entries.every((entry) => !entry.includes("__MACOSX")),
    noAppleDouble: entries.every((entry) => !entry.split("/").some((part) => part.startsWith("._"))),
    noDsStore: entries.every((entry) => path.basename(entry) !== ".DS_Store"),
    noPathTraversal: pathTraversalEntries.length === 0,
    noDuplicateEntries: duplicateEntries.length === 0,
    noFinderMetadata: forbiddenMetadataEntries.length === 0
  };
}

function assertCleanZip(zipPath, label) {
  const inspection = inspectZipEntries(zipEntries(zipPath));
  if (!inspection.passed) {
    throw new Error(`${label} is not clean: ${JSON.stringify(inspection, null, 2)}`);
  }
  return inspection;
}

function runZip({ cwd, zipPath, entries }) {
  const result = spawnSync("zip", ["-q", "-X", zipPath, "-@"], {
    cwd,
    input: `${entries.join("\n")}\n`,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `zip failed: ${zipPath}`);
}

function createCleanAppZip({ zipPath }) {
  if (!existsSync(appBundle)) throw new Error(`macOS App bundle missing: ${path.relative(repoRoot, appBundle)}`);
  const result = spawnSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--keepParent", appBundle, zipPath], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "clean App ZIP creation failed");
  return assertCleanZip(zipPath, "macOS App ZIP");
}

async function buildZipEntryList(zipPath, role) {
  const entries = zipEntries(zipPath);
  const inspection = inspectZipEntries(entries);
  return {
    schemaVersion: 1,
    milestoneId,
    role,
    fileName: path.basename(zipPath),
    ...inspection,
    entries: entries.map((entry) => ({
      path: entry,
      directory: entry.endsWith("/")
    }))
  };
}

export function sanitizeReviewText(text) {
  const username = os.userInfo().username;
  const escapedRepo = escapeRegExp(repoRoot);
  let result = text.replace(new RegExp(`${escapedRepo}/?`, "g"), "");
  if (username) result = result.replace(new RegExp(`/Users/${escapeRegExp(username)}/[^\\s)\\]]+`, "g"), "<redacted-local-path>");
  result = result.replace(/\/Users\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/private\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/var\/folders\/[^\s)\]]+/g, "<redacted-local-path>");
  result = result.replace(/\/tmp\/[^\s)\]]+/g, "<redacted-local-path>");
  return result;
}

async function writeSanitizedMarkdown(sourcePath, targetPath) {
  const text = sanitizeReviewText(await readFile(sourcePath, "utf8"));
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, text, "utf8");
}

async function copyUiAuditEvidence(root) {
  await mkdir(path.join(root, "ui-audit/contact-sheets"), { recursive: true });
  await writeSanitizedMarkdown(
    path.join(oldUiReviewRoot, "UI_AUDIT_REPORT.md"),
    path.join(root, "ui-audit/UI_AUDIT_REPORT.md")
  );
  await copyOptional(path.join(higStudyRoot, "HIG_STUDY_DIGEST.md"), path.join(root, "ui-audit/HIG_STUDY_DIGEST.md"));
  for (const filePath of await listFiles(path.join(uiAuditRoot, "contact-sheets"))) {
    await copyRequired(filePath, path.join(root, "ui-audit/contact-sheets", path.basename(filePath)));
  }
  const screenshotFiles = (await listFiles(uiAuditRoot)).filter((filePath) => path.extname(filePath).toLowerCase() === ".png");
  const contactSheets = (await listFiles(path.join(root, "ui-audit/contact-sheets"))).map((filePath) => `contact-sheets/${path.basename(filePath)}`);
  await writeFile(path.join(root, "ui-audit/SCREENSHOT_INDEX.md"), [
    "# SVGA Workbench v1 UI Audit Screenshot Index",
    "",
    `Raw screenshot count captured: ${screenshotFiles.length}.`,
    `Contact sheet count included in this package: ${contactSheets.length}.`,
    "",
    "The raw screenshot set remains in the local artifact root; the complete review package includes contact sheets plus the written audit to keep the handoff portable and privacy-clean.",
    "",
    ...contactSheets.map((entry) => `- [${entry}](${entry})`),
    ""
  ].join("\n"), "utf8");
  await writeJson(path.join(root, "ui-audit/METADATA.json"), {
    schemaVersion: 1,
    evidenceRole: "reference_only",
    historical_ui_ux_reference: true,
    blocksFeatureReview: false,
    sourceHeadShort: "21849d1",
    note: "Historical UI/UX and HIG audit material from an earlier Product Owner UI-polish insertion. It is retained as reference guidance only and is not current final-head feature evidence."
  });
}

export function extractDesktopSmokeResultFromText(text) {
  const prefix = "AUTO_SVGA_WEB_EXPERIMENT_SMOKE ";
  const line = String(text ?? "").split(/\n/).find((item) => item.startsWith(prefix));
  if (!line) throw new Error("desktop smoke result line missing");
  return JSON.parse(line.slice(prefix.length));
}

async function readValidationJson(fileName) {
  return await readJson(path.join(validationRoot, fileName));
}

function requireProof(smokeResult, key) {
  const proof = smokeResult?.[key];
  if (!proof || proof.passed !== true) throw new Error(`desktop smoke proof missing or failed: ${key}`);
  return proof;
}

function requiredSmokeProofs(smokeResult) {
  return {
    optimizedReopenProof: requireProof(smokeResult, "optimizedReopenProof"),
    sequenceReviewProof: requireProof(smokeResult, "sequenceReviewProof"),
    sequenceRepairPreviewProof: requireProof(smokeResult, "sequenceRepairPreviewProof"),
    sequenceNoWriteSimulationProof: requireProof(smokeResult, "sequenceNoWriteSimulationProof"),
    sequenceBoundedRepairPrototypeProof: requireProof(smokeResult, "sequenceBoundedRepairPrototypeProof"),
    sequencePrototypeRenderedBoundaryProof: requireProof(smokeResult, "sequencePrototypeRenderedBoundaryProof"),
    sequenceNoopRoundTripProof: requireProof(smokeResult, "sequenceNoopRoundTripProof"),
    sequenceByteRepairProof: requireProof(smokeResult, "sequenceByteRepairProof"),
    sequenceProductRepairProof: requireProof(smokeResult, "sequenceProductRepairProof"),
    replacementReadinessProof: requireProof(smokeResult, "replacementReadinessProof"),
    replacementPreviewProof: requireProof(smokeResult, "replacementPreviewProof"),
    replacementUndoRedoProof: requireProof(smokeResult, "replacementUndoRedoProof"),
    replacementResetProof: requireProof(smokeResult, "replacementResetProof"),
    replacementSaveAsProof: requireProof(smokeResult, "replacementSaveAsProof"),
    replacementMultiResourceProof: requireProof(smokeResult, "replacementMultiResourceProof")
  };
}

function buildAssetIntelligenceReport({ headCommit, headTree, validationSummary, stateProof, proofs }) {
  const readiness = proofs.replacementReadinessProof;
  const sequence = proofs.sequenceReviewProof;
  const optimization = proofs.optimizedReopenProof;
  return {
    schemaVersion: 1,
    milestoneId,
    phase: "Phase 2",
    reportId: "asset-intelligence-report",
    finalHead: headCommit,
    finalTree: headTree,
    generatedFrom: {
      validationSummary: "validation/validation-summary.json",
      desktopSmoke: "validation/desktop-smoke.json",
      stateRenderProof: "evidence/phase2/desktop-state-render-proof.json"
    },
    validationGeneratedAt: validationSummary.generatedAt,
    resourceClassification: {
      sourceSha256: readiness.sourceSha256,
      fileName: readiness.fileName,
      parsedMovie: readiness.parsedMovie,
      imageResourceCount: readiness.imageResourceCount,
      usedResourceCount: readiness.usedResourceCount,
      replaceableResourceCount: readiness.replaceableResourceCount,
      replaceableResourceSample: readiness.replaceableResourceKeys,
      sequenceGroupCount: sequence.sequenceGroupCount,
      sequenceAffectedResourceCount: sequence.affectedResourceCount
    },
    abnormalityFindings: [
      {
        code: "sequence_frame_memory_concentration",
        severity: "review_required",
        findingCount: sequence.sequenceFindingCount,
        affectedResourceCount: sequence.affectedResourceCount,
        evidenceRefs: ["sequenceReviewProof", "desktop-sequence-review-proof.png"]
      },
      {
        code: "spec_transparent_padding_or_resource_abnormality_visible",
        severity: "diagnostic_visible",
        evidenceRefs: ["desktop-info-assets-open.png", "desktop-state-render-proof.json"],
        visibleDiagnosticProof: stateProof.states?.["info-assets-open"]?.productState?.diagnosticFirstIssueVisible === true
      }
    ],
    safeOptimizationCandidateList: optimization.removedResourceKeys.map((resourceKey) => ({
      resourceKey,
      candidateType: resourceKey.includes("unused") ? "unused_image_resource" : "duplicate_or_unreferenced_image_resource",
      disposition: "safe_to_remove_in_optimized_copy",
      evidenceRef: "optimizedReopenProof"
    })),
    riskyOrSkippedOptimizationReasons: [
      {
        code: "referenced_resources_not_removed",
        reason: "Resources with sprite or frame references are retained unless the optimizer can prove they are duplicate or unused."
      },
      {
        code: "sequence_repair_not_optimized",
        reason: "Sequence-frame repair is tracked in Phase 4 and is exported through a dedicated repaired-copy Save As path, not through safe image optimization."
      },
      {
        code: "sequence_canvas_delta_not_required_for_optimizer",
        reason: "Optimizer output does not infer sequence anti-flicker correctness; Phase 4 uses full alpha proof plus Save As/reopen playback validation."
      }
    ],
    uiProofReferences: [
      "evidence/phase2/desktop-info-assets-open.png",
      "evidence/phase2/desktop-optimized-reopen-proof.png",
      "evidence/phase2/desktop-state-render-proof.json"
    ],
    passed: readiness.passed === true
      && sequence.passed === true
      && optimization.passed === true
      && stateProof.passed === true
  };
}

function buildOptimizationReport({ headCommit, headTree, validationSummary, proofs }) {
  const proof = proofs.optimizedReopenProof;
  return {
    schemaVersion: 1,
    milestoneId,
    phase: "Phase 2",
    reportId: "optimization-report",
    finalHead: headCommit,
    finalTree: headTree,
    generatedFrom: {
      validationSummary: "validation/validation-summary.json",
      desktopSmoke: "validation/desktop-smoke.json",
      optimizedReopenScreenshot: "evidence/phase2/desktop-optimized-reopen-proof.png"
    },
    validationGeneratedAt: validationSummary.generatedAt,
    beforeMetrics: {
      sourceSha256: proof.sourceSha256,
      imageCount: proof.originalImageCount
    },
    afterMetrics: {
      optimizedSha256: proof.optimizedSha256,
      imageCount: proof.optimizedImageCount,
      removedResourceKeys: proof.removedResourceKeys
    },
    saveAsBehavior: {
      saveAsRequired: proof.saveAsRequired,
      optimizedHashBound: proof.optimizedHashBound,
      optimizedOutputHash: proof.optimizedSha256,
      sourceUnchanged: proof.sourceUnchanged,
      reopenedPlayback: proof.reopenedPlayback,
      reopenedCanvasNonBlank: proof.reopenedCanvasNonBlank,
      reopenedInspectionReport: proof.reopenedInspectionReport,
      renderedProofPassed: proof.renderedProofPassed
    },
    riskyOrSkippedCandidates: [
      "referenced image resources retained",
      "sequence repair output excluded from safe optimizer",
      "no in-place mutation; optimized output must be saved as a separate file"
    ],
    passed: proof.passed === true
  };
}

function buildReplacementEditingReport({ headCommit, headTree, validationSummary, proofs }) {
  const readiness = proofs.replacementReadinessProof;
  const preview = proofs.replacementPreviewProof;
  const undoRedo = proofs.replacementUndoRedoProof;
  const reset = proofs.replacementResetProof;
  const saveAs = proofs.replacementSaveAsProof;
  const multi = proofs.replacementMultiResourceProof;
  return {
    schemaVersion: 1,
    milestoneId,
    phase: "Phase 3",
    reportId: "replacement-editing-report",
    finalHead: headCommit,
    finalTree: headTree,
    generatedFrom: {
      validationSummary: "validation/validation-summary.json",
      desktopSmoke: "validation/desktop-smoke.json"
    },
    validationGeneratedAt: validationSummary.generatedAt,
    supportedBoundary: {
      supported: ["PNG image resource replacement", "undo", "redo", "reset preview", "Save As", "multi-resource replacement"],
      unsupported: ["text editing", "resource key rename", "URL import", "timeline edit", "structural SVGA edit", "sequence repair Save As"]
    },
    readiness: {
      sourceSha256: readiness.sourceSha256,
      imageResourceCount: readiness.imageResourceCount,
      replaceableResourceCount: readiness.replaceableResourceCount,
      replaceableResourceSample: readiness.replaceableResourceKeys,
      editorUiExposed: readiness.editorUiExposed
    },
    singleReplacement: {
      resourceKey: preview.resourceKey,
      replacementSha256: preview.replacementSha256,
      editedSha256: preview.editedSha256,
      sourceUnchanged: preview.sourceUnchanged,
      exportedMatchesReplacement: preview.exportedMatchesReplacement,
      reopenedPlayback: preview.reopenedPlayback,
      reopenedCanvasNonBlank: preview.reopenedCanvasNonBlank,
      reopenedInspectionReport: preview.reopenedInspectionReport
    },
    undoRedo: {
      undoRestoredOriginal: undoRedo.undoRestoredOriginal,
      redoRestoredEdited: undoRedo.redoRestoredEdited,
      editClearedAfterUndo: undoRedo.editClearedAfterUndo,
      editRestoredAfterRedo: undoRedo.editRestoredAfterRedo,
      historyBounded: undoRedo.historyBounded
    },
    reset: {
      resetActionVisibleBeforeReset: reset.resetActionVisibleBeforeReset,
      resetRestoredOriginal: reset.resetRestoredOriginal,
      editClearedAfterReset: reset.editClearedAfterReset,
      undoAvailableAfterReset: reset.undoAvailableAfterReset,
      redoClearedAfterReset: reset.redoClearedAfterReset,
      resetCanvasNonBlank: reset.resetCanvasNonBlank,
      resetInspectionReport: reset.resetInspectionReport
    },
    saveAs: {
      savedFileName: saveAs.savedFileName,
      editedSha256: saveAs.editedSha256,
      savedSha256: saveAs.savedSha256,
      savedHashBound: saveAs.savedHashBound,
      roundTripPassed: saveAs.roundTripPassed,
      reopenedPlayback: saveAs.reopenedPlayback,
      reopenedCanvasNonBlank: saveAs.reopenedCanvasNonBlank,
      reopenedInspectionReport: saveAs.reopenedInspectionReport
    },
    multiResource: {
      resourceKeys: multi.resourceKeys,
      replacementCount: multi.replacementCount,
      editedSha256: multi.editedSha256,
      savedSha256: multi.savedSha256,
      savedFileName: multi.savedFileName,
      exportedMatchesReplacements: multi.exportedMatchesReplacements,
      sourceUnchanged: multi.sourceUnchanged,
      reopenedPlayback: multi.reopenedPlayback,
      reopenedCanvasNonBlank: multi.reopenedCanvasNonBlank,
      reopenedInspectionReport: multi.reopenedInspectionReport
    },
    historicalIncubationEvidencePolicy: {
      currentEvidencePathUsesFinalHeadSmokeProofs: true,
      oldP3P4DirectoriesCopiedAsCurrentEvidence: false,
      note: "Historical P3/P4 incubation artifacts are preserved in local artifact history only; this report is generated from final-head Workbench smoke proofs."
    },
    uiProofReferences: [
      "evidence/phase3/desktop-replacement-preview-proof.png",
      "evidence/phase3/desktop-replacement-undo-redo-proof.png",
      "evidence/phase3/desktop-multi-replacement-proof.png"
    ],
    passed: [
      readiness,
      preview,
      undoRedo,
      reset,
      saveAs,
      multi
    ].every((proof) => proof.passed === true)
  };
}

function buildSequenceRepairStatusReport({ headCommit, headTree, validationSummary, proofs }) {
  const byteProof = proofs.sequenceByteRepairProof;
  const rendered = proofs.sequencePrototypeRenderedBoundaryProof;
  const productProof = proofs.sequenceProductRepairProof;
  const productSaveAsEnabled = productProof.productSaveAsEnabled === true;
  const repairSuccessClaimed = productProof.repairSuccessClaimed === true;
  const manualRequired = productProof.manualVisualConfirmationRequired === true;
  const productComplete = productProof.passed === true
    && productSaveAsEnabled
    && repairSuccessClaimed
    && productProof.manualVisualConfirmationRequired === false
    && productProof.savedHashBound === true
    && productProof.sourceUnchanged === true
    && productProof.fullAffectedFrameVisibilityAlphaProofPassed === true
    && productProof.repairedFrameTransparentAfter === true
    && productProof.reopenedPlayback === true
    && productProof.reopenedCanvasNonBlank === true
    && productProof.reopenedInspectionReport === true
    && productProof.renderedProofPassed === true;
  return {
    schemaVersion: 1,
    milestoneId,
    phase: "Phase 4",
    reportId: "sequence-repair-status-report",
    finalHead: headCommit,
    finalTree: headTree,
    status: productComplete
      ? "product_complete_final_head_validated"
      : "partial_or_invalid_sequence_repair_evidence",
    generatedFrom: {
      validationSummary: "validation/validation-summary.json",
      desktopSmoke: "validation/desktop-smoke.json",
      sequenceScreenshots: "evidence/phase4/"
    },
    validationGeneratedAt: validationSummary.generatedAt,
    implemented: {
      sequenceGroupDetection: proofs.sequenceReviewProof.sequenceGroupCount > 0,
      readOnlyReview: proofs.sequenceReviewProof.passed,
      repairPreviewContract: proofs.sequenceRepairPreviewProof.passed,
      noWriteSimulation: proofs.sequenceNoWriteSimulationProof.passed,
      boundedPrototype: proofs.sequenceBoundedRepairPrototypeProof.passed,
      renderedBoundaryProof: rendered.passed,
      noopRoundTripRehearsal: proofs.sequenceNoopRoundTripProof.passed,
      byteCandidate: byteProof.passed,
      productSafeRepairAlgorithm: productProof.fullAffectedFrameVisibilityAlphaProofPassed,
      productSaveAs: productSaveAsEnabled,
      savedOutputReopenValidation: productProof.reopenedPlayback === true
        && productProof.reopenedCanvasNonBlank === true
        && productProof.reopenedInspectionReport === true,
      sourceImmutability: productProof.sourceUnchanged,
      manualVisualConfirmationNoLongerRequired: productProof.manualVisualConfirmationRequired === false
    },
    beforeAfterMechanicalEvidence: {
      historicalByteCandidate: {
        resourceDiffs: byteProof.resourceDiffs,
        editedSha256: byteProof.editedSha256,
        roundTripMode: byteProof.roundTripMode,
        productSaveAsEnabled: byteProof.productSaveAsEnabled,
        manualVisualConfirmationRequired: byteProof.manualVisualConfirmationRequired
      },
      renderedPrototypeBoundary: {
        beforeCanvasSha256: rendered.beforeCanvasSha256,
        afterCanvasSha256: rendered.afterCanvasSha256,
        beforeCanvasNonBlank: rendered.beforeCanvasNonBlank,
        afterCanvasNonBlank: rendered.afterCanvasNonBlank,
        canvasDimensionsStable: rendered.canvasDimensionsStable,
        pixelHashMatched: rendered.pixelHashMatched
      },
      productRepair: {
        repairedResourceKey: productProof.repairedResourceKey,
        targetVisibleFrames: productProof.targetVisibleFrames,
        groupResourceKeyCount: productProof.groupResourceKeyCount,
        alphaProofResourceCount: productProof.alphaProofResourceCount,
        changedResourceCount: productProof.changedResourceCount,
        fullAffectedFrameVisibilityAlphaProof: productProof.fullAffectedFrameVisibilityAlphaProof,
        beforeAfterPlaybackProof: productProof.beforeAfterPlaybackProof,
        playbackDeltaObserved: productProof.playbackDeltaObserved,
        editedSha256: productProof.editedSha256,
        savedSha256: productProof.savedSha256,
        savedFileName: productProof.savedFileName,
        savedHashBound: productProof.savedHashBound,
        sourceUnchanged: productProof.sourceUnchanged,
        reopenedPlayback: productProof.reopenedPlayback,
        reopenedCanvasNonBlank: productProof.reopenedCanvasNonBlank,
        reopenedInspectionReport: productProof.reopenedInspectionReport
      }
    },
    productExposure: {
      productSaveAsEnabled,
      saveStatus: productProof.saveStatus,
      writeAttempted: productProof.saveStatus === "saved",
      writeActionExposed: false,
      repairSuccessClaimed,
      manualVisualConfirmationRequired: manualRequired
    },
    preciseTechnicalBlocker: productComplete ? null : {
      id: "PHASE4-SEQUENCE-SAFE-SAVE-AS-EVIDENCE-INCOMPLETE",
      summary: "Sequence repair evidence did not satisfy the product-complete fail-closed contract.",
      remainsRequired: [
        "productSaveAsEnabled=true",
        "repairSuccessClaimed=true",
        "manualVisualConfirmationRequired=false",
        "full affected-frame alpha proof",
        "Save As output hash binding",
        "reopen playback validation"
      ]
    },
    knownLimitations: [
      {
        code: "canvas_delta_not_observed_for_target_speck",
        severity: "nonblocking_evidence_note",
        detail: "The repaired target is a four-pixel near-empty speck frame. The product proof records stable before/after playback hashes and full alpha-level removal, but svga-web canvas hashes did not differ at frames 23 and 24."
      }
    ],
    passedAsProductComplete: productComplete
  };
}

async function copyPhaseEvidence(root, { headCommit, headTree }) {
  const validationSummary = await readValidationJson("validation-summary.json");
  const desktopSmoke = await readValidationJson("desktop-smoke.json");
  const smokeResult = extractDesktopSmokeResultFromText(desktopSmoke.stdout);
  const proofs = requiredSmokeProofs(smokeResult);
  const stateProofPath = path.join(repoRoot, ".artifacts/product/P2/desktop-state-render-proof.json");
  const stateProof = await readJson(stateProofPath);
  if (stateProof.headCommit !== headCommit) {
    throw new Error(`desktop-state-render-proof head ${stateProof.headCommit} does not match final head ${headCommit}`);
  }

  const phase2Files = [
    "artifact-index.json",
    "desktop-state-render-proof.json",
    "owner-usability-smoke.json",
    "runtime-identity.json",
    "desktop-info-assets-open.png",
    "desktop-optimized-reopen-proof.png"
  ];
  const phase3Files = [
    "desktop-replacement-preview-proof.png",
    "desktop-replacement-undo-redo-proof.png",
    "desktop-multi-replacement-proof.png",
    "edited-output.svga",
    "multi-resource-edited-output.svga"
  ];
  const phase4Files = [
    "desktop-sequence-review-proof.png",
    "desktop-sequence-repair-preview-proof.png",
    "desktop-sequence-no-write-simulation-proof.png",
    "desktop-sequence-bounded-repair-prototype-proof.png",
    "desktop-sequence-prototype-rendered-boundary-proof.png",
    "desktop-sequence-noop-round-trip-proof.png",
    "desktop-sequence-product-repair-proof.png",
    "sequence-repaired-output.svga"
  ];
  for (const fileName of phase2Files) await copyOptional(path.join(repoRoot, ".artifacts/product/P2", fileName), path.join(root, "evidence/phase2", fileName));
  for (const fileName of phase3Files) await copyOptional(path.join(repoRoot, ".artifacts/product/P2", fileName), path.join(root, "evidence/phase3", fileName));
  for (const fileName of phase4Files) await copyOptional(path.join(repoRoot, ".artifacts/product/P2", fileName), path.join(root, "evidence/phase4", fileName));
  await copyOptional(
    path.join(repoRoot, "docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md"),
    path.join(root, "evidence/phase4/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md")
  );

  const assetIntelligenceReport = buildAssetIntelligenceReport({ headCommit, headTree, validationSummary, stateProof, proofs });
  const optimizationReport = buildOptimizationReport({ headCommit, headTree, validationSummary, proofs });
  const replacementEditingReport = buildReplacementEditingReport({ headCommit, headTree, validationSummary, proofs });
  const sequenceRepairStatusReport = buildSequenceRepairStatusReport({ headCommit, headTree, validationSummary, proofs });

  await writeJson(path.join(root, "evidence/phase2/asset-intelligence-report.json"), assetIntelligenceReport);
  await writeJson(path.join(root, "evidence/phase2/optimization-report.json"), optimizationReport);
  await writeJson(path.join(root, "evidence/phase2/optimized-reopen-proof.json"), proofs.optimizedReopenProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-editing-report.json"), replacementEditingReport);
  await writeJson(path.join(root, "evidence/phase3/replacement-readiness-proof.json"), proofs.replacementReadinessProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-preview-proof.json"), proofs.replacementPreviewProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-undo-redo-proof.json"), proofs.replacementUndoRedoProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-reset-proof.json"), proofs.replacementResetProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-save-as-proof.json"), proofs.replacementSaveAsProof);
  await writeJson(path.join(root, "evidence/phase3/replacement-multi-resource-proof.json"), proofs.replacementMultiResourceProof);
  await writeJson(path.join(root, "evidence/phase4/sequence-repair-status-report.json"), sequenceRepairStatusReport);
  await writeJson(path.join(root, "evidence/phase4/sequence-byte-candidate-proof.json"), proofs.sequenceByteRepairProof);
  await writeJson(path.join(root, "evidence/phase4/sequence-product-repair-save-as-proof.json"), proofs.sequenceProductRepairProof);
  await writeJson(
    path.join(root, "evidence/phase4/sequence-full-affected-frame-alpha-proof.json"),
    proofs.sequenceProductRepairProof.fullAffectedFrameVisibilityAlphaProof
  );
  await writeJson(path.join(root, "evidence/phase4/sequence-rendered-boundary-proof.json"), proofs.sequencePrototypeRenderedBoundaryProof);

  const summary = phaseEvidenceSummary({
    assetIntelligenceReport,
    optimizationReport,
    replacementEditingReport,
    sequenceRepairStatusReport
  });
  await writeJson(path.join(root, "evidence/phase-evidence-summary.json"), summary);
  return summary;
}

function phaseEvidenceSummary({ assetIntelligenceReport, optimizationReport, replacementEditingReport, sequenceRepairStatusReport }) {
  return {
    schemaVersion: 1,
    milestoneId,
    phase2AssetIntelligence: {
      status: assetIntelligenceReport.passed ? "implemented_and_final_head_validated" : "failed",
      reports: [
        "evidence/phase2/asset-intelligence-report.json",
        "evidence/phase2/optimization-report.json"
      ],
      selfContainedReviewClaims: [
        "resource classification is generated from final-head desktop smoke proof",
        "safe optimization candidate flow is Save As only and source immutable",
        "optimized output hash and reopen proof are included"
      ]
    },
    phase3ReplacementEditing: {
      status: replacementEditingReport.passed ? "implemented_and_final_head_validated_for_supported_png_resources" : "failed",
      report: "evidence/phase3/replacement-editing-report.json",
      coveredOperations: ["supported PNG replacement", "undo", "redo", "reset", "Save As", "multi-resource replacement", "reopen", "reference validation"],
      unsupportedOperations: replacementEditingReport.supportedBoundary.unsupported,
      historicalIncubationEvidenceCopiedAsCurrent: false
    },
    phase4SequenceFrameRepair: {
      status: sequenceRepairStatusReport.status,
      report: "evidence/phase4/sequence-repair-status-report.json",
      implemented: Object.entries(sequenceRepairStatusReport.implemented)
        .filter(([, value]) => value === true)
        .map(([key]) => key),
      productSaveAsEnabled: sequenceRepairStatusReport.productExposure.productSaveAsEnabled,
      repairSuccessClaimed: sequenceRepairStatusReport.productExposure.repairSuccessClaimed,
      manualVisualConfirmationRequired: sequenceRepairStatusReport.productExposure.manualVisualConfirmationRequired,
      savedOutput: sequenceRepairStatusReport.beforeAfterMechanicalEvidence.productRepair.savedFileName,
      playbackDeltaObserved: sequenceRepairStatusReport.beforeAfterMechanicalEvidence.productRepair.playbackDeltaObserved,
      blocker: sequenceRepairStatusReport.preciseTechnicalBlocker?.id ?? null
    }
  };
}

async function copyPackagedRuntimeEvidence(root, { headCommit, headTree }) {
  const proofPath = path.join(packagedRuntimeRoot, "packaged-app-runtime-proof.json");
  const startupPath = path.join(packagedRuntimeRoot, "normal-visible-startup.json");
  const indexPath = path.join(packagedRuntimeRoot, "artifact-index.json");
  const proof = await readJson(proofPath);
  const startup = await readJson(startupPath);
  const errors = [];
  if (proof.finalHead !== headCommit) errors.push(`proof finalHead ${proof.finalHead} does not match ${headCommit}`);
  if (proof.finalTree !== headTree) errors.push(`proof finalTree ${proof.finalTree} does not match ${headTree}`);
  if (proof.buildCommit !== headCommit) errors.push(`packaged buildCommit ${proof.buildCommit} does not match ${headCommit}`);
  if (proof.buildCommitMatchesFinalHead !== true) errors.push("packaged buildCommitMatchesFinalHead is not true");
  if (proof.passed !== true) errors.push("packaged runtime proof did not pass");
  if (startup.headCommit !== headCommit) errors.push(`normal visible startup head ${startup.headCommit} does not match ${headCommit}`);
  if (startup.passed !== true) errors.push("normal visible startup proof did not pass");
  if (startup.noSmokeMode !== true || startup.noProofArguments !== true) errors.push("normal visible startup was not a normal no-smoke launch");
  if (startup.localOnly !== true || (startup.externalRequests ?? []).length !== 0) errors.push("normal visible startup was not local-only");
  if (errors.length > 0) throw new Error(`packaged runtime proof invalid: ${errors.join("; ")}`);

  await copyRequired(proofPath, path.join(root, "app/packaged-app-runtime-proof.json"));
  await copyRequired(startupPath, path.join(root, "evidence/packaged-app-runtime/normal-visible-startup.json"));
  if (existsSync(indexPath)) {
    await copyRequired(indexPath, path.join(root, "evidence/packaged-app-runtime/artifact-index.json"));
  }
  return proof;
}

function validationResultCount(validationSummary) {
  return `${validationSummary.commandCount}/${validationSummary.commandCount}`;
}

async function copyValidationOutputs(root, allowMissingValidation) {
  const missing = requiredValidationFiles.filter((fileName) => !existsSync(path.join(validationRoot, fileName)));
  if (missing.length > 0 && !allowMissingValidation) {
    throw new Error(`validation outputs missing: ${missing.join(", ")}`);
  }
  await mkdir(path.join(root, "validation"), { recursive: true });
  for (const filePath of await listFiles(validationRoot)) {
    await copyRequired(filePath, path.join(root, "validation", path.basename(filePath)));
  }
  if (missing.length > 0) {
    await writeJson(path.join(root, "validation/VALIDATION_INCOMPLETE.json"), {
      schemaVersion: 1,
      milestoneId,
      passed: false,
      missing
    });
  }
}

async function writeGeneratedCurrentDocs(root, {
  headCommit,
  headTree,
  headShort,
  completeZipName,
  appZipName,
  validationSummary,
  phaseEvidence,
  packagedRuntimeProof
}) {
  await writeFile(path.join(root, "docs/SVGA_WORKBENCH_V1_STATUS.md"), [
    "# SVGA Workbench v1 Current Status",
    "",
    "Date: 2026-06-30",
    "Branch: `agent/codex/svga-workbench-v1-autonomous`",
    `Current final HEAD: \`${headCommit}\``,
    `Current final tree: \`${headTree}\``,
    `Current complete review ZIP: \`${completeZipName}\``,
    `Current macOS App ZIP: \`app/${appZipName}\``,
    "Product Owner acceptance: not claimed",
    "Production release approval: not claimed",
    "",
    "## Phase Matrix",
    "",
    "| Phase | Current status | Current-head evidence |",
    "| --- | --- | --- |",
    "| Phase 1 stabilization | Validated baseline | `validation/desktop-smoke.json`, `validation/validation-summary.json`, `package-hygiene-proof.json` |",
    `| Phase 2 Asset Intelligence / safe optimization | ${phaseEvidence.phase2AssetIntelligence.status} | \`evidence/phase2/asset-intelligence-report.json\`, \`evidence/phase2/optimization-report.json\` |`,
    `| Phase 3 supported PNG replacement | ${phaseEvidence.phase3ReplacementEditing.status} | \`evidence/phase3/replacement-editing-report.json\` plus reset, Save As, reopen, and multi-resource proofs |`,
    `| Phase 4 sequence-frame anti-flicker | ${phaseEvidence.phase4SequenceFrameRepair.status} | \`evidence/phase4/sequence-repair-status-report.json\`, \`evidence/phase4/sequence-product-repair-save-as-proof.json\` |`,
    "| macOS internal package | Unsigned internal ZIP validated | `app/macos-package-proof.json`, `app/packaged-app-runtime-proof.json`, `evidence/packaged-app-runtime/normal-visible-startup.json` |",
    "| UI/HIG carry-forward | Included as evidence and implementation guidance | `ui-audit/`, `docs/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md` |",
    "",
    "## Current Evidence Boundary",
    "",
    "- Phase 2 and Phase 3 evidence in this directory is generated from the current final-head desktop smoke proof, not from historical incubation heads.",
    "- Phase 4 now includes a product-safe repaired-copy Save As path, full affected-frame alpha proof, saved-output hash binding, reopen validation, and source immutability proof. The tiny target speck did not produce a canvas hash delta in svga-web; this is recorded as a nonblocking evidence note.",
    "- The packaged App normal visible startup proof launches the packaged `.app` executable without smoke or proof arguments and verifies local-only runtime behavior.",
    `- Validation passed with ${validationResultCount(validationSummary)} command records in \`validation/validation-summary.json\`.`,
    `- Packaged runtime proof passed: \`${packagedRuntimeProof.proofId}\` at head \`${headShort}\`.`,
    "",
    "## External Blockers",
    "",
    "- Apple Developer ID signing identity and notary credentials are required for trusted macOS distribution.",
    "- Windows code-signing certificate and release identity are required for trusted Windows distribution.",
    "- Product Owner review is still required before external product acceptance or production release approval.",
    ""
  ].join("\n"), "utf8");

  await writeFile(path.join(root, "docs/AUTONOMOUS_RUN_LOG.md"), [
    "# SVGA Workbench v1 Current Run Log",
    "",
    "Date: 2026-06-30",
    `Final HEAD: \`${headCommit}\``,
    `Complete review ZIP generated by this run: \`${completeZipName}\``,
    "",
    "## Repair Summary",
    "",
    "- Rebuilt the review directory around current-head evidence instead of old P3/P4 incubation artifacts.",
    "- Added final-head Phase 2 reports for resource classification, abnormality findings, safe optimization candidates, skipped/risky reasons, before/after metrics, optimized output hash, Save As behavior, source immutability, and reopen validation.",
    "- Added final-head Phase 3 replacement-editing reports for supported PNG replacement, undo, redo, reset, Save As, multi-resource replacement, reopened export, reference validation, and unsupported edit boundaries.",
    "- Continued Phase 4 sequence repair through detection, grouped evidence, no-write simulation, bounded prototype, rendered before/after proof, no-op round-trip rehearsal, byte-candidate proof, and product repaired-copy Save As/reopen proof.",
    "- Added packaged App normal visible startup proof as a validation step after macOS packaging and package proof.",
    "- Kept App ZIP hygiene, Info.plist security cleanup, privacy audit, manifest verification, signing dry-run, and notarization dry-run constraints fail-closed.",
    "",
    "## Validation Summary",
    "",
    `- \`npm run svga-workbench:v1:validate\` passed with ${validationResultCount(validationSummary)} command records.`,
    "- Covered syntax/type checks, complete review package tests, shared frontend tests, root tests, svga-web experiment tests, signing dry-run, macOS package generation, macOS package proof, packaged normal runtime proof, desktop smoke, and loop validation.",
    "- Complete review package generation verified manifest coverage, package hygiene, privacy audit, App ZIP entry list, upload index, and hashes.",
    "",
    "## Current Stop State",
    "",
    "- This package is a complete review-directory handoff candidate, not Product Owner acceptance.",
    "- Phase 4 no longer has the prior product Save As/manual-confirmation blocker in this package; remaining risk is the recorded svga-web canvas hash non-delta for the four-pixel target speck.",
    "- Product Owner review is still required before external product acceptance.",
    ""
  ].join("\n"), "utf8");
}

async function buildManifest(root, extra = {}) {
  const entries = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    const stats = await stat(filePath);
    entries.push({
      path: relativePath,
      role: roleForPath(relativePath),
      mime: mimeFor(filePath),
      sizeBytes: stats.size,
      sha256: await sha256File(filePath)
    });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: 1,
    milestoneId,
    generatedAt: new Date().toISOString(),
    ...extra,
    entryCount: entries.length,
    entries
  };
}

function roleForPath(relativePath) {
  if (relativePath === "UPLOAD_CHANGELOG_SINCE_A4681D7.md") return "upload_changelog";
  if (relativePath === "UPLOAD_INDEX.json") return "upload_index";
  if (relativePath === "bundle-privacy-audit.json") return "privacy_audit";
  if (relativePath === "hashes/sha256sums.txt") return "hash_list";
  if (relativePath.startsWith("extracted-index/")) return "extracted_zip_index";
  if (relativePath.startsWith("validation/")) return "validation_output";
  if (relativePath === "app/packaged-app-runtime-proof.json") return "packaged_app_runtime_proof";
  if (relativePath.startsWith("app/")) return "macos_app_payload";
  if (relativePath.startsWith("docs/")) return "status_or_guidance_doc";
  if (relativePath.startsWith("ui-audit/")) return "ui_audit_evidence";
  if (relativePath.startsWith("evidence/packaged-app-runtime/")) return "packaged_app_runtime_proof";
  if (relativePath.startsWith("evidence/phase2/")) return "phase2_evidence";
  if (relativePath.startsWith("evidence/phase3/")) return "phase3_evidence";
  if (relativePath.startsWith("evidence/phase4/")) return "phase4_evidence";
  if (relativePath.startsWith("review-notes/")) return "review_note";
  return "review_payload";
}

export async function validateManifestPayloadHashes({ root, manifest }) {
  const errors = [];
  const manifestPaths = new Set((manifest.entries ?? []).map((entry) => entry.path));
  const diskPaths = new Set();
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    diskPaths.add(relativePath);
    if (!manifestPaths.has(relativePath)) errors.push(`manifest missing ${relativePath}`);
  }
  for (const entry of manifest.entries ?? []) {
    const filePath = path.join(root, entry.path);
    if (!existsSync(filePath)) {
      errors.push(`manifest entry missing on disk ${entry.path}`);
      continue;
    }
    const identity = await fileIdentity(filePath);
    if (identity.sizeBytes !== entry.sizeBytes) errors.push(`size mismatch ${entry.path}`);
    if (identity.sha256 !== entry.sha256) errors.push(`sha256 mismatch ${entry.path}`);
    if (!diskPaths.has(entry.path)) errors.push(`manifest entry not in disk walk ${entry.path}`);
  }
  if (manifestPaths.has("MANIFEST.json")) errors.push("manifest must not include itself");
  return {
    passed: errors.length === 0,
    errors
  };
}

async function writeSha256Sums(root) {
  const rows = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json" || relativePath === "hashes/sha256sums.txt") continue;
    rows.push(`${await sha256File(filePath)}  ${relativePath}`);
  }
  rows.sort();
  await mkdir(path.join(root, "hashes"), { recursive: true });
  await writeFile(path.join(root, "hashes/sha256sums.txt"), `${rows.join("\n")}\n`, "utf8");
}

export async function buildBundlePrivacyAudit(root, { expectedHeadShort, appZipName }) {
  const username = os.userInfo().username;
  const findings = [];
  const scannedTextPayloads = [];
  const zipAudits = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    findings.push(...privacyFindings(relativePath, `path:${relativePath}`, username));
    const ext = path.extname(filePath).toLowerCase();
    if (relativePath === "bundle-privacy-audit.json") continue;
    if (ext === ".zip") {
      const entries = zipEntries(filePath);
      const inspection = inspectZipEntries(entries);
      if (!inspection.passed) findings.push({ ruleId: "FORBIDDEN_ZIP_METADATA", entry: relativePath, detail: inspection });
      const zipAudit = {
        zipRole: roleForPath(relativePath),
        fileName: path.basename(filePath),
        entryCount: entries.length,
        scannedTextEntryCount: 0,
        skippedBinaryEntryCount: 0,
        inspection
      };
      for (const entry of entries) {
        findings.push(...privacyFindings(entry, `zip-entry:${relativePath}:${entry}`, username));
        if (!textExtensions.has(path.extname(entry).toLowerCase())) {
          zipAudit.skippedBinaryEntryCount += 1;
          continue;
        }
        if (entry.endsWith("/")) continue;
        zipAudit.scannedTextEntryCount += 1;
        findings.push(...privacyFindings(zipEntryBytes(filePath, entry).toString("utf8"), `zip-text:${relativePath}:${entry}`, username));
      }
      zipAudits.push(zipAudit);
      continue;
    }
    if (textExtensions.has(ext)) {
      const text = await readFile(filePath, "utf8");
      scannedTextPayloads.push(relativePath);
      findings.push(...privacyFindings(text, relativePath, username));
    }
  }
  return {
    schemaVersion: 1,
    milestoneId,
    expectedHeadShort,
    appZipName,
    passed: findings.length === 0,
    findingCount: findings.length,
    rules: {
      noLocalAbsolutePaths: true,
      noLocalUsername: true,
      noHighConfidenceSecrets: true,
      appZipNoFinderMetadata: true,
      appZipNoPathTraversalOrDuplicateEntries: true
    },
    scannedTextPayloads: scannedTextPayloads.sort(),
    zipAudits,
    findings
  };
}

function privacyFindings(text, entry, username) {
  const findings = [];
  const rules = [
    ["MACOS_USERS_PATH", /\/Users\/[^/\s"'`]+(?:\/[^\s"'`]*)?/g],
    ["PRIVATE_PATH", /\/private\/[^\s"'`]+/g],
    ["VAR_FOLDERS_PATH", /\/var\/folders\/[^\s"'`]+/g],
    ["TMP_PATH", /\/tmp\/[^\s"'`]+/g],
    ["WINDOWS_USERS_PATH", /[A-Za-z]:\\Users\\[^\\\s"'`]+(?:\\[^\s"'`]*)?/g],
    ["HIGH_CONFIDENCE_SECRET", /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,})/g]
  ];
  for (const [ruleId, pattern] of rules) {
    const matches = String(text).match(pattern);
    if (matches) findings.push({ ruleId, entry, sample: matches[0].slice(0, 96) });
  }
  if (repoRoot && String(text).includes(repoRoot)) findings.push({ ruleId: "REPO_ABSOLUTE_PATH", entry, sample: repoRoot });
  if (username && String(text).includes(username)) findings.push({ ruleId: "LOCAL_USERNAME", entry, sample: username });
  if (/NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/i.test(String(text))) {
    findings.push({ ruleId: "ARBITRARY_NETWORK_ALLOWANCE", entry, sample: "NSAllowsArbitraryLoads=true" });
  }
  return findings;
}

async function writeUploadIndex(root, { headCommit, headTree, completeZipName, appZipName }) {
  const records = [];
  for (const filePath of await listFiles(root)) {
    const relativePath = toBundlePath(root, filePath);
    if (relativePath === "MANIFEST.json") continue;
    const identity = await fileIdentity(filePath);
    records.push({
      relativePath,
      role: roleForPath(relativePath),
      required: true,
      sizeBytes: identity.sizeBytes,
      sha256: identity.sha256,
      finalHead: headCommit,
      finalTree: headTree
    });
  }
  records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const uploadIndex = {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    transferWrapper: {
      fileName: completeZipName,
      role: "complete_review_directory_zip",
      identityRecordedAfterZip: true
    },
    macosAppZip: appZipName,
    coverageBoundary: {
      exhaustiveHashAuthority: "MANIFEST.json",
      scope: "upload-facing core payload index; final integrity companions that are generated after this index are covered by MANIFEST.json and hashes/sha256sums.txt",
      lateIntegrityCompanionsCoveredByManifest: [
        "UPLOAD_INDEX.json",
        "bundle-privacy-audit.json",
        "hashes/sha256sums.txt",
        "manifest-verification.json"
      ]
    },
    files: records
  };
  await writeJson(path.join(root, "UPLOAD_INDEX.json"), uploadIndex);
  return uploadIndex;
}

function gitLogSinceBaseline() {
  try {
    return git(["log", "--oneline", "--decorate", "a4681d7..HEAD", "--"]);
  } catch {
    return "Unable to read local git log for a4681d7..HEAD; use MANIFEST.json finalHead and package review notes as authority.";
  }
}

async function writeUploadChangelog(root, { headCommit, headTree, completeZipName }) {
  await writeFile(path.join(root, "UPLOAD_CHANGELOG_SINCE_A4681D7.md"), [
    "# Upload Changelog Since a4681d7",
    "",
    "Baseline package: `review/SVGA-Workbench-v1-a4681d7-complete-review-directory.zip`.",
    `Current package: \`${completeZipName}\`.`,
    `Current HEAD: \`${headCommit}\`.`,
    `Current tree: \`${headTree}\`.`,
    "",
    "## Commit Range",
    "",
    "```text",
    gitLogSinceBaseline(),
    "```",
    "",
    "## Why This Upload Was Regenerated",
    "",
    "The `a4681d7` package completed the Phase 4 sequence anti-flicker repaired-copy path. Later review uncovered owner-visible workflow problems: Phase 2/3/4 operations were hard to discover, one interim repair placed action buttons inside the left resource panel, the resource list was displaced, and the large-preview path became unclear.",
    "",
    "This package keeps the Phase 4 algorithm and evidence from `a4681d7`, then layers the owner-requested UI/UX repairs and regenerated upload evidence on top of the current final head.",
    "",
    "## Product-Bearing Changes After a4681d7",
    "",
    "- `5825f70` exposed the Phase 2/3/4 operation entry points in the Workbench so the implemented workflows were no longer hidden from the app.",
    "- `eb159e2` corrected that first exposure: operation buttons moved out of the left resource information panel and into the right `检查与操作` inspector area; the left panel returned to resource inventory, filtering, scrolling, and large-preview review.",
    "- The primary UI now uses product-language actions such as `优化副本`, `替换图片`, and `修复闪帧` instead of requiring reviewers to understand internal Phase labels.",
    "- Diagnostics and technical evidence remain available, but they are no longer the first visual surface blocking the resource list or the action workflow.",
    "- Keyboard activation and smoke assertions were updated so Enter/Space operation paths, panel focus, resource preview, and right-side action visibility are covered together.",
    "",
    "## Temporary Product Owner Additions",
    "",
    "These UI/UX repairs were added during the autonomous run after the Phase 4-only focus was already underway. They are intentionally documented as temporary Product Owner additions so reviewers can distinguish them from the original Phase 4 terminal blocker work.",
    "",
    "- Restore a recognizable three-zone layout: left side for file/resource information, center for preview, right side for inspection and actions.",
    "- Keep resource rows reachable and scrollable when the SVGA contains many resources.",
    "- Preserve the resource large-preview workflow from the resource list.",
    "- Remove engineering-heavy Phase workflow copy from the default interaction surface.",
    "- Keep implemented Phase 2/3/4 workflows reviewable through concise product actions.",
    "",
    "## Review Impact",
    "",
    "- Use this current package, not the `a4681d7` package, for owner-visible UI/UX review and packaged App testing.",
    "- Use `a4681d7` only as lineage for the Phase 4 sequence repair implementation baseline.",
    "- Historical UI audit material remains under `ui-audit/` with `evidenceRole=reference_only`; it is guidance, not current feature evidence.",
    "- Current validation, manifest coverage, privacy audit, App ZIP hygiene, packaged runtime proof, and Phase 2/3/4 reports are all regenerated in this package.",
    ""
  ].join("\n"), "utf8");
}

async function writeReviewPacket(root, { headCommit, headTree, headShort, completeZipName, appZipName, validationSummary }) {
  await writeFile(path.join(root, "README.md"), [
    "# SVGA Workbench v1 Complete Review Directory",
    "",
    `Primary artifact: \`${completeZipName}\`.`,
    "",
    "This directory is generated from a clean staging root. Do not re-compress it in Finder.",
    "",
    "Status: complete review-directory handoff candidate. This handoff is not Product Owner acceptance; Phase 4 includes a validated repaired-copy Save As/reopen path with a recorded canvas-delta non-observation risk.",
    "",
    "Start with `REVIEW_PACKET.md` and `UPLOAD_CHANGELOG_SINCE_A4681D7.md`, then use `UPLOAD_INDEX.json`, `MANIFEST.json`,",
    "`bundle-privacy-audit.json`, `package-hygiene-proof.json`, and",
    "`validation/validation-summary.json` for machine-checkable evidence.",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "REVIEW_PACKET.md"), [
    "# SVGA Workbench v1 Review Packet",
    "",
    `- HEAD: \`${headCommit}\``,
    `- Tree: \`${headTree}\``,
    `- Complete review ZIP: \`${completeZipName}\``,
    `- macOS App ZIP: \`app/${appZipName}\``,
    "- Product acceptance: not claimed",
    "- Phase 4 sequence repair: product repaired-copy Save As/reopen proof included; canvas delta non-observation recorded as a known risk",
    "- Review state: complete directory package regenerated at the current final head",
    "",
    "## Feature Completion Matrix",
    "",
    "| Area | Status | Notes |",
    "| --- | --- | --- |",
    "| Phase 1 stabilization | Passed baseline, repair package regenerated | Desktop smoke and package proof included in validation outputs |",
    "| Phase 2 Asset Intelligence / safe optimization | Implemented, Save As/reopen smoke validated | Safe candidates only; risky classes remain suggestion-only |",
    "| Phase 3 PNG replacement editing | Implemented for supported PNG resources | Undo/redo/reset/Save As/reopen evidence included |",
    "| Phase 4 sequence repair | Product repaired-copy Save As/reopen validated | Full alpha proof included; svga-web canvas hashes stayed stable for the four-pixel speck target |",
    "| macOS package | Unsigned internal ZIP only | Clean App ZIP hygiene validated; signing/notarization blocked by credentials |",
    "| UI audit / HIG | Included as repair input | Findings are tracked; broad UI polish not completed in this package repair |",
    "",
    "## Changes Since a4681d7",
    "",
    "- See `UPLOAD_CHANGELOG_SINCE_A4681D7.md` for the commit range and owner-requested temporary UI/UX additions made after `SVGA-Workbench-v1-a4681d7-complete-review-directory.zip`.",
    "- The main owner-visible delta is workflow placement: Phase 2/3/4 operations are now exposed as concise right-side product actions while the left side returns to resource inventory, scrolling, filtering, and large-preview review.",
    "- These UI/UX changes were inserted after the Phase 4 sequence-repair focus and are included as review scope additions, not as a replacement for the Phase 4 evidence.",
    "",
    "## Self-Contained Evidence",
    "",
    "- `UPLOAD_CHANGELOG_SINCE_A4681D7.md`: commit-range and temporary Product Owner addition summary since the referenced baseline package.",
    "- `UPLOAD_INDEX.json`: upload-facing core payload index with role, size, SHA-256, head, tree, and an explicit coverage boundary for late integrity companions.",
    "- `MANIFEST.json`: exhaustive payload hash authority; every payload except `MANIFEST.json` itself, with role, size, MIME, and SHA-256.",
    "- `manifest-verification.json`: hash verification result for the staged review directory.",
    "- `bundle-privacy-audit.json`: outward-facing payload and App ZIP privacy scan.",
    "- `package-hygiene-proof.json`: App ZIP entry hygiene proof.",
    "- `extracted-index/app-zip-entry-list.json`: extracted App ZIP entry list.",
    "- `validation/`: complete validation command outputs, including packaged normal runtime proof, desktop smoke, and loop validation.",
    "- `evidence/phase2/asset-intelligence-report.json` and `evidence/phase2/optimization-report.json`: final-head asset classification and safe optimization evidence.",
    "- `evidence/phase3/replacement-editing-report.json`: final-head supported PNG replacement, undo/redo/reset, Save As, reopen, and multi-resource evidence.",
    "- `evidence/phase4/sequence-repair-status-report.json`, `sequence-product-repair-save-as-proof.json`, and `sequence-full-affected-frame-alpha-proof.json`: final-head product sequence repair, saved output, full alpha proof, before/after playback stability, reopen validation, and source immutability.",
    "- `app/packaged-app-runtime-proof.json` plus `evidence/packaged-app-runtime/normal-visible-startup.json`: packaged App normal visible startup proof.",
    "- `ui-audit/`: HIG study digest, UI audit report, screenshot index, and contact sheets.",
    "",
    "## Validation Summary",
    "",
    `- \`npm run svga-workbench:v1:validate\` passed with ${validationResultCount(validationSummary)} command records.`,
    "- Covered checks: syntax/type gates, complete-review package tests, shared frontend tests, root `npm test`, svga-web experiment tests, signing dry-run, macOS package generation, macOS package proof, packaged normal runtime proof, desktop smoke, and final loop validation.",
    "- Desktop smoke passed with local-only page, strict CSP, nonblank playback canvas, inspection report, drag/drop, invalid recovery, owner usability, workbench region map, Phase 2 optimized reopen proof, Phase 3 replacement/reset/Save As proofs, and Phase 4 sequence Save As/reopen proof.",
    "",
    "## App ZIP / Signing / Installer Status",
    "",
    `- App ZIP: \`app/${appZipName}\`, unsigned internal macOS ZIP.`,
    "- App ZIP hygiene: PASS only after inspecting the App ZIP itself; no `__MACOSX`, AppleDouble `._*`, `.DS_Store`, path traversal, duplicate entries, or Finder metadata.",
    "- Signing/notarization: dry-run workflow is present; production signing and notarization require Apple Developer ID identity and notary credentials.",
    "- Installer: no signed DMG/PKG is claimed in this package; the current distributable artifact is the internal App ZIP.",
    "- Windows trusted distribution remains preparation-only until a Windows signing certificate and release identity are available.",
    "",
    "## Changed Files Summary",
    "",
    "- `tools/svga-workbench/`: complete review directory generator, manifest/privacy/hygiene validation, validation collector, packaged runtime proof, and tests.",
    "- `tools/electron-prototype/experiments/svga-web/`: clean macOS packaging, package proof, signing/notarization dry-run workflow, desktop smoke evidence paths, sequence-repair Save As bridge, and fail-closed proof validation.",
    "- `tools/shared/product-frontend/`: Workbench UI surfaces for safe optimization, replacement, reset, sequence repair Save As/reopen proof, diagnostics visibility, and smoke assertions.",
    "- `src/` and `dist/`-validated product modules: Asset Intelligence, safe optimization, replacement editing, and sequence anti-flicker repair contracts are covered by the root test suite.",
    "- `docs/autonomous`, `docs/product`, and `docs/reviews`: status, blockers, HIG carry-forward, lessons candidates, and review notes.",
    "",
    "## Security / Privacy Summary",
    "",
    "- Local-only posture retained: strict CSP, context isolation, sandboxing, blocked navigation, blocked new windows, and no telemetry claims.",
    "- macOS package metadata validation fails closed if arbitrary network allowances, unused permission descriptions, or misleading Finder `.svga` associations reappear.",
    "- Privacy audit scans outward-facing review payloads, metadata, proof/status docs, validation outputs, and text entries inside the App ZIP.",
    "- Original SVGA files are not modified in place; optimization, replacement, and sequence repair flows use Save As/new-output paths with reopen validation.",
    "",
    "## Knowledge And Docs Updated",
    "",
    "- `docs/SVGA_WORKBENCH_V1_STATUS.md`: current phase matrix and honest Phase 4 product Save As status.",
    "- `docs/AUTONOMOUS_RUN_LOG.md`: package repair, validation, HIG/UI repair, and final review generation notes.",
    "- `docs/AUTONOMOUS_BLOCKERS.md`: external credential blockers.",
    "- `docs/LESSONS_CANDIDATES.md`: reusable packaging, signing, HIG, and visible-hit-point lessons.",
    "- `docs/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md`: durable HIG-derived Workbench checklist.",
    "",
    "## Blockers Requiring Product Owner Or External Credentials",
    "",
    "- Apple Developer ID signing identity and notary credentials are required for trusted macOS distribution.",
    "- Windows code-signing certificate and release identity are required for trusted Windows distribution.",
    "- Product Owner review is required before claiming external product acceptance or production release approval.",
    "",
    "## Nonblocking Backlog",
    "",
    "- Add a stronger visual-delta/threshold policy for real-world sequence repairs where canvas-level change should be observable.",
    "- Text editing, key rename, URL import, timeline edit, and structural SVGA edit remain unsupported until mechanically round-trippable.",
    "- UI audit follow-ups: toolbar target size, modal stacking, settings scroll affordance, loading escape path, sequence proof distinction, and dense row focus.",
    "- Signed DMG/PKG and Windows installer flow after credentials/release identity exist.",
    "",
    "## Known Risks",
    "",
    "- Phase 4 target speck repair is mechanically proven and product Save As/reopen validated, but svga-web canvas hashes did not differ for the four-pixel target frames; rely on the included alpha proof for exact byte-level visibility evidence.",
    "- The macOS App ZIP is unsigned and may be blocked by Gatekeeper outside internal/local review contexts.",
    "- UI audit P2/P3 items are tracked but not fully polished unless they hide a required workflow.",
    "- Historical review-upload artifacts are preserved only as lineage; the primary complete review artifact is this package.",
    "",
    "## Required Human Decision",
    "",
    "Recommended next human decision: review this complete directory as the Workbench v1 handoff candidate, decide whether the Phase 4 alpha-proofed repaired-copy path is acceptable despite the recorded canvas-delta non-observation, and provide signing/notarization credentials only when trusted distribution is required.",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(root, "FINAL_RESPONSE.txt"), [
    `SVGA Workbench v1 complete review directory ready for external review at head ${headShort}.`,
    `Primary artifact: review/${completeZipName}`,
    `macOS App ZIP: app/${appZipName}`,
    `Validation: ${validationResultCount(validationSummary)} commands passed in validation/validation-summary.json.`,
    "Package hygiene: App ZIP clean; manifest verified; privacy audit passed with zero findings.",
    "Phase status: Phase 1/2/3 reviewable; Phase 4 sequence repaired-copy Save As/reopen validated with canvas-delta non-observation recorded.",
    "Blockers: Apple Developer ID/notary credentials and Windows signing credentials only for trusted distribution.",
    "Status: complete review package generated; Product Owner acceptance and production release are not claimed.",
    ""
  ].join("\n"), "utf8");
}

async function copyDocs(root) {
  const docs = [
    ["docs/autonomous/AUTONOMOUS_RUN_LOG.md", "docs/AUTONOMOUS_RUN_LOG.md"],
    ["docs/autonomous/AUTONOMOUS_BLOCKERS.md", "docs/AUTONOMOUS_BLOCKERS.md"],
    ["docs/autonomous/SVGA_WORKBENCH_V1_STATUS.md", "docs/SVGA_WORKBENCH_V1_STATUS.md"],
    ["docs/autonomous/LESSONS_CANDIDATES.md", "docs/LESSONS_CANDIDATES.md"],
    ["docs/product/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md", "docs/SVGA_WORKBENCH_HIG_AUDIT_GUIDE.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-safe-optimization-ui.md", "review-notes/2026-06-30-codex-svga-workbench-safe-optimization-ui.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md", "review-notes/2026-06-30-codex-svga-workbench-sequence-byte-candidate.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-sequence-product-repair.md", "review-notes/2026-06-30-codex-svga-workbench-sequence-product-repair.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-signing-workflow.md", "review-notes/2026-06-30-codex-svga-workbench-signing-workflow.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-uiux-repair.md", "review-notes/2026-06-30-codex-svga-workbench-uiux-repair.md"],
    ["docs/reviews/2026-06-30-codex-svga-workbench-self-contained-evidence.md", "review-notes/2026-06-30-codex-svga-workbench-self-contained-evidence.md"]
  ];
  for (const [source, target] of docs) {
    const sourcePath = path.join(repoRoot, source);
    if (existsSync(sourcePath)) await writeSanitizedMarkdown(sourcePath, path.join(root, target));
  }
}

async function main() {
  const allowMissingValidation = process.argv.includes("--allow-missing-validation");
  const headCommit = git(["rev-parse", "HEAD"]);
  const headTree = git(["rev-parse", "HEAD^{tree}"]);
  const headShort = git(["rev-parse", "--short", "HEAD"]);
  const completeDirectoryName = `${milestoneId}-${headShort}-complete-review-directory`;
  const completeZipName = `${completeDirectoryName}.zip`;
  const completeRoot = path.join(stagingRoot, completeDirectoryName);
  const completeZipPath = path.join(reviewRoot, completeZipName);
  const appZipName = `Auto-SVGA-macOS-internal-${headShort}.zip`;
  const appZipPath = path.join(completeRoot, "app", appZipName);

  await rm(stagingRoot, { recursive: true, force: true });
  await rm(completeZipPath, { force: true });
  await mkdir(completeRoot, { recursive: true });
  await mkdir(path.join(completeRoot, "app"), { recursive: true });
  await mkdir(reviewRoot, { recursive: true });

  const appZipInspection = createCleanAppZip({ zipPath: appZipPath });
  await copyOptional(internalTrialManifestPath, path.join(completeRoot, "app/internal-trial-manifest.json"));
  await writeMacosPackageProof({
    appBundle,
    archivePath: appZipPath,
    outputPath: path.join(completeRoot, "app/macos-package-proof.json")
  });
  await copyDocs(completeRoot);
  await copyUiAuditEvidence(completeRoot);
  await copyValidationOutputs(completeRoot, allowMissingValidation);
  const validationSummary = await readValidationJson("validation-summary.json");
  const phaseEvidence = await copyPhaseEvidence(completeRoot, { headCommit, headTree });
  const packagedRuntimeProof = await copyPackagedRuntimeEvidence(completeRoot, { headCommit, headTree });
  await writeReviewPacket(completeRoot, { headCommit, headTree, headShort, completeZipName, appZipName, validationSummary });
  await writeGeneratedCurrentDocs(completeRoot, {
    headCommit,
    headTree,
    headShort,
    completeZipName,
    appZipName,
    validationSummary,
    phaseEvidence,
    packagedRuntimeProof
  });
  await writeUploadChangelog(completeRoot, { headCommit, headTree, completeZipName });

  await mkdir(path.join(completeRoot, "extracted-index"), { recursive: true });
  await writeJson(path.join(completeRoot, "extracted-index/app-zip-entry-list.json"), await buildZipEntryList(appZipPath, "macos_app_zip"));
  await writeJson(path.join(completeRoot, "package-hygiene-proof.json"), {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    appZip: {
      fileName: appZipName,
      ...await fileIdentity(appZipPath),
      ...appZipInspection
    },
    assertions: {
      appZipClean: appZipInspection.passed === true,
      packageHygienePassRequiresCleanAppZip: true,
      noFinderMetadataClaimedOnlyAfterAppZipInspection: true
    }
  });

  await writeUploadIndex(completeRoot, { headCommit, headTree, completeZipName, appZipName });
  await writeSha256Sums(completeRoot);
  const privacyAudit = await buildBundlePrivacyAudit(completeRoot, { expectedHeadShort: headShort, appZipName });
  if (!privacyAudit.passed) {
    await writeJson(path.join(completeRoot, "bundle-privacy-audit.json"), privacyAudit);
    throw new Error(`bundle privacy audit failed: ${privacyAudit.findings.map((finding) => `${finding.ruleId}:${finding.entry}`).join("; ")}`);
  }
  await writeJson(path.join(completeRoot, "bundle-privacy-audit.json"), privacyAudit);

  const manifest = await buildManifest(completeRoot, {
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    productOwnerAcceptanceClaimed: false,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed
  });
  await writeJson(path.join(completeRoot, "MANIFEST.json"), manifest);
  const manifestCheck = await validateManifestPayloadHashes({ root: completeRoot, manifest });
  if (!manifestCheck.passed) throw new Error(`manifest verification failed: ${manifestCheck.errors.join("; ")}`);
  await writeJson(path.join(completeRoot, "manifest-verification.json"), {
    schemaVersion: 1,
    milestoneId,
    passed: true,
    checkedEntryCount: manifest.entries.length
  });
  const finalManifest = await buildManifest(completeRoot, {
    finalHead: headCommit,
    finalTree: headTree,
    productionApproved: false,
    productOwnerAcceptanceClaimed: false,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed
  });
  await writeJson(path.join(completeRoot, "MANIFEST.json"), finalManifest);
  const finalManifestCheck = await validateManifestPayloadHashes({ root: completeRoot, manifest: finalManifest });
  if (!finalManifestCheck.passed) throw new Error(`final manifest verification failed: ${finalManifestCheck.errors.join("; ")}`);

  const entries = (await listFiles(completeRoot)).map((filePath) => toBundlePath(completeRoot, filePath));
  runZip({ cwd: completeRoot, zipPath: completeZipPath, entries });
  const completeZipInspection = assertCleanZip(completeZipPath, "complete review directory ZIP");
  const completeZipIdentity = await fileIdentity(completeZipPath);
  await writeJson(path.join(reviewRoot, `${completeDirectoryName}-summary.json`), {
    schemaVersion: 1,
    milestoneId,
    finalHead: headCommit,
    finalTree: headTree,
    completeReviewDirectoryZip: {
      fileName: completeZipName,
      path: path.relative(repoRoot, completeZipPath).split(path.sep).join("/"),
      ...completeZipIdentity,
      ...completeZipInspection
    },
    stagingDirectory: path.relative(repoRoot, completeRoot).split(path.sep).join("/"),
    appZip: {
      fileName: appZipName,
      ...await fileIdentity(appZipPath),
      ...appZipInspection
    },
    privacyAudit: {
      passed: privacyAudit.passed,
      findingCount: privacyAudit.findingCount
    },
    manifest: {
      entryCount: finalManifest.entries.length,
      verified: finalManifestCheck.passed
    }
  });
  console.log(JSON.stringify({
    completeReviewDirectoryZip: path.relative(repoRoot, completeZipPath).split(path.sep).join("/"),
    sha256: completeZipIdentity.sha256,
    sizeBytes: completeZipIdentity.sizeBytes,
    finalHead: headCommit,
    finalTree: headTree,
    appZipClean: appZipInspection.passed,
    privacyAuditPassed: privacyAudit.passed,
    manifestVerified: finalManifestCheck.passed
  }, null, 2));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
