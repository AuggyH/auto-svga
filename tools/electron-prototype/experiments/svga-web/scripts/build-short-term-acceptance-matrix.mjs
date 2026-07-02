import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(experimentRoot, "../../../..");
const artifactRoot = process.env.AUTO_SVGA_PRODUCT_ARTIFACTS
  ? path.resolve(process.env.AUTO_SVGA_PRODUCT_ARTIFACTS)
  : path.join(repoRoot, ".artifacts/product/short-term");
const outputPath = path.join(artifactRoot, "short-term-acceptance-matrix.json");
const evidenceRootLabel = ".artifacts/product/short-term";

const requirements = [
  {
    id: "S1",
    title: "Open SVGA locally",
    summary: "Open from macOS menu/host dialog and drag/drop are proven through paired current-head proof.",
    proof: "short-term-open-flow-proof.json",
    passWhen: (proof, ctx) => proof?.passed === true
      && ctx.proof("normal-runtime-proof.json")?.hostOpen === true
      && ctx.proof("normal-runtime-proof.json")?.menuOpen === true
      && ctx.proof("normal-runtime-proof.json")?.localOnly === true,
    partialWhen: (proof, ctx) => proof?.passed === true || ctx.proof("normal-runtime-proof.json")?.hostOpen === true,
    evidence: ["short-term-open-flow-proof.json", "normal-runtime-proof.json", "actual-normal-loaded.png"],
    partialGaps: ["Need both drag/drop proof and macOS menu/host-dialog normal proof on the current head."]
  },
  {
    id: "S2",
    title: "Play SVGA and report abnormal states",
    summary: "Playback, invalid-file recovery, and playback-failure recovery have structured current-head proof.",
    proof: "short-term-load-failure-proof.json",
    passWhen: (proof, ctx) => proof?.passed === true
      && proof?.loadFailedVisible === true
      && proof?.invalidApiRejected === true
      && proof?.playbackFailureInjected === true
      && proof?.playbackFailureVisible === true
      && proof?.playbackFailureRecovered === true
      && proof?.sourceBytesRestoredAfterRecovery === true
      && proof?.playbackFailureSourceBytesRestoredAfterRecovery === true
      && ctx.proof("normal-runtime-proof.json")?.playback === true
      && ctx.proof("normal-runtime-proof.json")?.canvasNonBlank === true
      && ctx.hasArtifact("short-term-load-failed.png")
      && ctx.hasArtifact("short-term-playback-failed.png"),
    partialWhen: (proof, ctx) => proof?.passed === true
      && ctx.proof("normal-runtime-proof.json")?.playback === true
      && ctx.proof("normal-runtime-proof.json")?.canvasNonBlank === true,
    evidence: ["short-term-load-failure-proof.json", "normal-runtime-proof.json", "short-term-load-failed.png", "short-term-playback-failed.png"],
    partialGaps: ["Need playback-failure-specific abnormal-state proof in addition to invalid-file recovery."]
  },
  {
    id: "S3",
    title: "Show basic file information",
    summary: "Overview and normal runtime inspection are captured.",
    proof: "normal-runtime-proof.json",
    passWhen: (proof, ctx) => proof?.inspectionReport === true && ctx.hasArtifact("short-term-preview-overview.png"),
    evidence: ["normal-runtime-proof.json", "short-term-preview-overview.png"]
  },
  {
    id: "S4",
    title: "Show production-spec comparison inside Overview",
    summary: "Overview shows current values, production requirements, status, and active spec profile without exposing a separate spec module.",
    proof: "short-term-spec-comparison-proof.json",
    passWhen: (proof, ctx) => proof?.passed === true
      && proof?.profileId === "production_target"
      && proof?.actualRequirementPairsVisible === true
      && proof?.separateProductionSpecModuleExposed === false
      && ctx.hasArtifact("short-term-preview-overview.png"),
    partialWhen: (_proof, ctx) => ctx.hasArtifact("short-term-preview-overview.png"),
    evidence: ["short-term-spec-comparison-proof.json", "short-term-preview-overview.png"]
  },
  {
    id: "S5",
    title: "Show all asset information",
    summary: "Image, sequence, no-audio, and replaceable-empty states are covered by thumbnail and empty-state proof.",
    proof: "short-term-thumbnail-proof.json",
    passWhen: (proof, ctx) => proof?.passed === true && ctx.proof("short-term-empty-state-proof.json")?.passed === true,
    evidence: ["short-term-thumbnail-proof.json", "short-term-empty-state-proof.json", "short-term-sequence-thumbnails.png"]
  },
  {
    id: "S6",
    title: "Show image thumbnails",
    summary: "Ordinary image thumbnails and sequence four-grid thumbnails are rendered.",
    proof: "short-term-thumbnail-proof.json",
    passWhen: (proof) => proof?.ordinaryImageThumbnailVisible === true && proof?.sequenceFourGridVisible === true && proof?.audioEmptyStateVisible === true,
    evidence: ["short-term-thumbnail-proof.json", "short-term-sequence-thumbnails.png"]
  },
  {
    id: "S7",
    title: "Identify replaceable elements by naming rule",
    summary: "Designer-named image keys are included while automatic image keys are excluded from replacement.",
    proof: "short-term-replaceable-classification-proof.json",
    passWhen: (proof) => proof?.passed === true
      && proof?.automaticKeysExcluded === true
      && proof?.designerKeysIncluded === true
      && proof?.replaceableElementsNotAllImages === true,
    partialWhen: (_proof, ctx) => ctx.proof("short-term-replacement-proof.json")?.passed === true
      && ctx.proof("short-term-empty-state-proof.json")?.ordinaryImagesNotDuplicatedInReplaceables === true,
    evidence: ["short-term-replaceable-classification-proof.json", "short-term-replacement-proof.json", "short-term-empty-state-proof.json"],
    partialGaps: ["Need current-head replaceable-key classification report with included and excluded examples."]
  },
  {
    id: "S8",
    title: "Detect optimization opportunities",
    summary: "Optimization candidates and skipped method rows are visible.",
    proof: "short-term-optimization-proof.json",
    passWhen: (proof) => proof?.optimizationCandidatesVisible === true && proof?.optimizationCandidateRows > 0 && proof?.skippedMethodRowsVisible > 0,
    evidence: ["short-term-optimization-proof.json", "short-term-preview-optimization.png"]
  },
  {
    id: "S9",
    title: "Run real optimization",
    summary: "Safe optimization produces smaller, different SVGA bytes while source bytes stay unchanged.",
    proof: "short-term-optimization-proof.json",
    passWhen: (proof) => proof?.optimizedOutputProduced === true && proof?.optimizedBytesDifferent === true && proof?.optimizedBytesSmaller === true && proof?.sourceBytesUnchanged === true,
    evidence: ["short-term-optimization-proof.json", "short-term-smoke-save-as.svga"]
  },
  {
    id: "S10",
    title: "Enter optimization comparison flow",
    summary: "Before/after comparison and result metrics are captured.",
    proof: "short-term-optimization-proof.json",
    passWhen: (proof) => proof?.comparisonVisible === true && proof?.compareCanvasANonBlank === true && proof?.compareCanvasBNonBlank === true && proof?.metricsVisible === true,
    evidence: ["short-term-optimization-proof.json", "short-term-optimization-result.png"]
  },
  {
    id: "S11",
    title: "Rename imageKey",
    summary: "UI rename proof exposes current-head imageKey and matteKey reference closure after rename.",
    proof: "short-term-rename-proof.json",
    passWhen: (proof) => proof?.passed === true
      && proof?.decodePassed === true
      && proof?.reopenPassed === true
      && proof?.referenceClosurePassed === true
      && proof?.imageKeyReferenceClosurePassed === true
      && proof?.matteKeyReferenceClosurePassed === true
      && proof?.danglingReferenceCount === 0
      && proof?.newKeyPresent === true
      && proof?.imageBytesPreserved === true
      && Array.isArray(proof?.referenceFieldsChecked)
      && proof.referenceFieldsChecked.join(",") === "imageKey,matteKey",
    partialWhen: (proof) => proof?.passed === true,
    evidence: ["short-term-rename-proof.json", "src/tests/short-term-rename-workflow.test.ts"],
    partialGaps: ["Need current-head runtime report showing imageKey and matteKey reference closure after rename."]
  },
  {
    id: "S12",
    title: "Preview replaceable images",
    summary: "Runtime image replacement and reset stay in Preview mode and preserve source bytes.",
    proof: "short-term-replacement-proof.json",
    passWhen: (proof) => proof?.passed === true && proof?.previewModeStayed === true && proof?.resetRestoredOriginal === true && proof?.sourceBytesUnchanged === true,
    evidence: ["short-term-replacement-proof.json", "short-term-replacement-dirty.png", "short-term-replacement-reset.png"]
  },
  {
    id: "S13",
    title: "Preview replaceable text",
    summary: "Current parser/product model exposes no product-safe text keys; the app fails closed without byte mutation.",
    proof: "short-term-runtime-text-boundary-proof.json",
    blockedWhen: (proof) => proof?.productCompleteClaimed === false && proof?.editBlocked === true && proof?.sourceBytesUnchanged === true,
    evidence: ["short-term-runtime-text-boundary-proof.json"],
    blocker: "SVGA proto/product inspection model does not currently expose product-safe runtime text keys for a real modal preview flow."
  },
  {
    id: "S14",
    title: "Save edited output",
    summary: "Overwrite Save and Save As are separately validated after persisted output exists.",
    proof: "short-term-save-proof.json",
    passWhen: (proof, ctx) => proof?.passed === true
      && ctx.proof("short-term-optimization-proof.json")?.saveAsEnabled === true
      && ctx.proof("short-term-rename-proof.json")?.saveAsEnabled === true
      && ctx.proof("short-term-replacement-proof.json")?.saveAsEnabledBeforeReset === true,
    evidence: ["short-term-save-proof.json", "short-term-optimization-proof.json", "short-term-rename-proof.json", "short-term-replacement-proof.json"]
  },
  {
    id: "S15",
    title: "Keep audio deferred",
    summary: "No-audio state is visible and does not block release.",
    proof: "short-term-thumbnail-proof.json",
    passWhen: (proof, ctx) => proof?.audioEmptyStateVisible === true && ctx.proof("short-term-empty-state-proof.json")?.noAudioVisible === true,
    evidence: ["short-term-thumbnail-proof.json", "short-term-empty-state-proof.json"]
  },
  {
    id: "S16",
    title: "Show recent SVGA files",
    summary: "Recent launch/menu limits, path redaction, clear history, and missing-file recovery are validated.",
    proof: "short-term-recent-proof.json",
    passWhen: (proof) => proof?.passed === true && proof?.menuRecordLimit === 10 && proof?.launchRecordLimit === 5 && proof?.pathRedacted === true,
    evidence: ["short-term-recent-proof.json", "normal-runtime-proof.json"]
  }
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function readJson(fileName) {
  const filePath = path.join(artifactRoot, fileName);
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8"));
}

function relativeEvidencePath(fileName) {
  if (fileName.startsWith("src/") || fileName.startsWith("tools/") || fileName.startsWith("docs/")) return fileName;
  return `${evidenceRootLabel}/${fileName}`;
}

function proofHead(fileName, proof, artifactIndex) {
  if (typeof proof?.headCommit === "string") return proof.headCommit;
  if (typeof proof?.runtimeIdentity?.headCommit === "string") return proof.runtimeIdentity.headCommit;
  const artifact = artifactIndex?.artifacts?.find((entry) => {
    if (entry?.path?.endsWith(`/${fileName}`)) return true;
    return entry?.scenario === path.basename(fileName, path.extname(fileName));
  });
  return typeof artifact?.headCommit === "string" ? artifact.headCommit : undefined;
}

function statusCounts(items) {
  return items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function buildMatrix() {
  const headCommit = git(["rev-parse", "HEAD"]);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const tree = git(["rev-parse", "HEAD^{tree}"]);
  const artifactIndex = await readJson("artifact-index.json");
  const proofCache = new Map();

  async function proof(fileName) {
    if (!proofCache.has(fileName)) proofCache.set(fileName, await readJson(fileName));
    return proofCache.get(fileName);
  }

  function hasArtifact(fileName) {
    return existsSync(path.join(artifactRoot, fileName));
  }

  const ctx = {
    hasArtifact,
    proof: (fileName) => proofCache.get(fileName)
  };

  for (const requirement of requirements) {
    await proof(requirement.proof);
    for (const fileName of requirement.evidence ?? []) {
      if (fileName.endsWith(".json") && !fileName.startsWith("src/")) await proof(fileName);
    }
  }

  const items = requirements.map((requirement) => {
    const primaryProof = proofCache.get(requirement.proof);
    const evidence = unique([requirement.proof, ...(requirement.evidence ?? [])]).map(relativeEvidencePath);
    const gaps = [];
    let status = "missing";
    const primaryHead = proofHead(requirement.proof, primaryProof, artifactIndex);
    const primaryMissing = !primaryProof;
    const stalePrimary = primaryHead && primaryHead !== headCommit;

    if (primaryMissing) {
      gaps.push(`Missing current proof: ${relativeEvidencePath(requirement.proof)}.`);
    } else if (stalePrimary) {
      status = "stale";
      gaps.push(`Primary proof is bound to ${primaryHead}, not current HEAD ${headCommit}.`);
    } else if (requirement.blockedWhen?.(primaryProof, ctx)) {
      status = "blocked";
      gaps.push(requirement.blocker);
    } else if (requirement.passWhen?.(primaryProof, ctx)) {
      status = "pass";
    } else if (requirement.partialWhen?.(primaryProof, ctx)) {
      status = "partial";
      gaps.push(...(requirement.partialGaps ?? ["Current evidence is incomplete."]));
    } else {
      gaps.push(...(requirement.partialGaps ?? ["Current evidence does not satisfy the acceptance condition."]));
    }

    for (const fileName of requirement.evidence ?? []) {
      if (fileName.startsWith("src/") || fileName.startsWith("tools/") || fileName.startsWith("docs/")) {
        if (!existsSync(path.join(repoRoot, fileName))) gaps.push(`Missing source evidence: ${fileName}.`);
        continue;
      }
      if (!hasArtifact(fileName)) gaps.push(`Missing evidence artifact: ${relativeEvidencePath(fileName)}.`);
      const evidenceProof = fileName.endsWith(".json") ? proofCache.get(fileName) : undefined;
      const evidenceHead = proofHead(fileName, evidenceProof, artifactIndex);
      if (evidenceHead && evidenceHead !== headCommit) {
        gaps.push(`Evidence ${relativeEvidencePath(fileName)} is bound to ${evidenceHead}, not current HEAD ${headCommit}.`);
        if (status === "pass") status = "stale";
      }
    }

    return {
      id: requirement.id,
      title: requirement.title,
      status,
      summary: requirement.summary,
      evidence,
      gaps: unique(gaps)
    };
  });

  const counts = statusCounts(items);
  const releaseCandidateReady = items.every((item) => item.status === "pass");
  return {
    schemaVersion: 1,
    proofId: "short-term-acceptance-matrix",
    source: "current-head-product-artifacts",
    branch,
    headCommit,
    tree,
    artifactRoot: path.relative(repoRoot, artifactRoot),
    releaseCandidateReady,
    statusCounts: counts,
    statusPolicy: {
      pass: "Current-head evidence satisfies the documented acceptance condition.",
      partial: "Useful current-head evidence exists, but required acceptance evidence is incomplete.",
      blocked: "A focused implementation or parser/product constraint blocks completion without a product or technical decision.",
      missing: "Required evidence is absent or does not satisfy the condition.",
      stale: "Evidence exists but is not bound to the current HEAD."
    },
    requirements: items,
    generatedAt: new Date().toISOString()
  };
}

const matrix = await buildMatrix();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(JSON.stringify({
  proofId: matrix.proofId,
  headCommit: matrix.headCommit,
  releaseCandidateReady: matrix.releaseCandidateReady,
  statusCounts: matrix.statusCounts,
  outputPath: path.relative(repoRoot, outputPath)
}, null, 2));
