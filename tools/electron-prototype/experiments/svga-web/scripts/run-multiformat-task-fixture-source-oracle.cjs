"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createMultiFormatDesktopPreviewSession
} = require("../multiformat-desktop-session.cjs");
const {
  PRODUCT_MILESTONE_ID,
  TASK_RUNTIME_FIXTURE_ALIASES,
  TASK_RUNTIME_ORACLE_PHASES,
  assertNoRawPathLeak,
  assertTaskRuntimeFixtureContract,
  createTaskRuntimeFixtureSet,
  sha256Text
} = require("./multiformat-task-runtime-fixtures.cjs");

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../../../..");
const proofRoot = process.env.AUTO_SVGA_TASK_FIXTURE_SOURCE_ORACLE_ROOT && path.isAbsolute(process.env.AUTO_SVGA_TASK_FIXTURE_SOURCE_ORACLE_ROOT)
  ? path.normalize(process.env.AUTO_SVGA_TASK_FIXTURE_SOURCE_ORACLE_ROOT)
  : mkdtempSync(path.join(os.tmpdir(), "auto-svga-task-fixture-source-oracle-"));
const fixtureRoot = path.join(proofRoot, "fixtures");
const proofOutputPath = path.join(proofRoot, "multiformat-task-fixture-source-oracle.json");

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main() {
  mkdirSync(proofRoot, { recursive: true });
  const fixtureSet = createTaskRuntimeFixtureSet({ root: fixtureRoot });
  const fixtureContract = assertTaskRuntimeFixtureContract({ root: fixtureRoot });
  const sourceStore = new Map();
  const session = createMultiFormatDesktopPreviewSession({
    repoRoot,
    sessionRoot: path.join(proofRoot, "session"),
    sourceStore,
    openTimeoutMs: 15_000
  });
  const signals = [signal("fixture_identity_bound", {
    fixtureHash: sha256Text(JSON.stringify(fixtureContract.fixtureHashes))
  })];
  const replacementDataUri = `data:image/png;base64,${readFileSync(fixtureSet.files.replacementPath).toString("base64")}`;

  const lottie = await proveLottieFlow({ session, fixtureSet, replacementDataUri, signals });
  const vap = await proveVapFlow({ session, fixtureSet, replacementDataUri, signals });
  await session.control({ action: "dispose" });
  sourceStore.clear();
  signals.push(signal("cleanup_completed", {
    sourceStoreSizeAfterClear: sourceStore.size,
    lifecycle: session.lifecycle
  }));

  const proof = {
    schemaVersion: 1,
    status: "passed",
    sourceHead: gitHead(),
    productMilestoneId: PRODUCT_MILESTONE_ID,
    pathRedacted: true,
    reportToken: "multiformat-task-fixture-source-oracle",
    fixtureContract,
    signals,
    lottie,
    vap,
    boundaries: {
      sourceOnly: true,
      electronLaunched: false,
      foregroundUsed: false,
      installedAppTouched: false,
      ownerMaterialUsed: false,
      runtimePixelPlayback: false,
      productAcceptanceClaim: false
    }
  };
  assertRequiredPhases(proof);
  assertNoRawPathLeak(proof, Object.values(fixtureSet.files));
  signals.push(signal("redacted_evidence_written", {
    proofSha256BeforeWrite: sha256Text(JSON.stringify(proof))
  }));
  const finalProof = { ...proof, signals };
  writeFileSync(proofOutputPath, `${JSON.stringify(finalProof, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({
    proofOutputPath,
    sha256: sha256File(proofOutputPath),
    status: finalProof.status
  })}\n`);
}

async function proveLottieFlow({ session, fixtureSet, replacementDataUri, signals }) {
  const runtimeValues = new Map();
  const opened = await requireOpened(
    session.openLocalFilePath(fixtureSet.files.lottiePath, "fileButton"),
    "lottie_external_opened"
  );
  if (opened.model.detectedFormat !== "lottie" || opened.model.status !== "previewReady") {
    throw new Error("Task external-image Lottie did not reach previewReady.");
  }
  signals.push(signal("lottie_external_opened", {
    modelStatus: opened.model.status,
    imageCount: opened.model.rightPanel.assetInventory.summary.imageCount,
    textCount: opened.model.rightPanel.assetInventory.summary.textCount
  }));

  const prepared = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "lottie",
    requestId: opened.model.requestId,
    replacements: opened.model.replacement
  });
  if (prepared.status !== "prepared" || prepared.format !== "lottie") {
    throw new Error("Task external-image Lottie did not produce a prepared runtime payload.");
  }
  const originalAsset = findLottieAsset(prepared, "avatar");
  if (!/^data:image\/png;base64,/u.test(originalAsset.p) || originalAsset.u !== "" || originalAsset.e !== 1) {
    throw new Error("Task external-image Lottie did not inline its adjacent image resource.");
  }
  signals.push(signal("lottie_runtime_prepared", {
    runtimeScriptHash: sha256Text(prepared.runtimeScripts.join(",")),
    imageDataUriHash: sha256Text(originalAsset.p)
  }));

  const played = await session.control({ action: "play" });
  const paused = await session.control({ action: "pause" });
  if (played.model.status !== "playing" || paused.model.status !== "paused") {
    throw new Error("Task external-image Lottie play/pause state did not advance.");
  }
  signals.push(signal("lottie_playback_state_changed", {
    playedStatus: played.model.status,
    pausedStatus: paused.model.status
  }));

  const imageApply = await applyReplacementWithAuthority({
    session,
    targetId: "avatar",
    kind: "image",
    value: replacementDataUri
  });
  upsertRuntimeValue(runtimeValues, imageApply.replacementRuntimeValue);
  const imageRuntime = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "lottie",
    requestId: `${opened.model.requestId}:image-replacement`,
    replacements: runtimeReplacementPayload(imageApply.model.replacement, runtimeValues)
  });
  const imageAsset = findLottieAsset(imageRuntime, "avatar");
  if (imageAsset.p !== replacementDataUri) throw new Error("Task Lottie image replacement did not reach the runtime payload.");
  signals.push(signal("lottie_image_replacement_applied", {
    publicTargetHash: sha256Text(imageApply.selection.publicTargetId),
    runtimeTargetHash: sha256Text(imageApply.selection.runtimeTargetId),
    replacementValueHash: sha256Text(replacementDataUri)
  }));

  const textTarget = opened.model.rightPanel.lottieTexts[0]?.id;
  if (!textTarget) throw new Error("Task external-image Lottie text target is unavailable.");
  const textApply = await applyReplacementWithAuthority({
    session,
    targetId: textTarget,
    kind: "text",
    value: "Runtime task title"
  });
  upsertRuntimeValue(runtimeValues, textApply.replacementRuntimeValue);
  const textRuntime = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "lottie",
    requestId: `${opened.model.requestId}:text-replacement`,
    replacements: runtimeReplacementPayload(textApply.model.replacement, runtimeValues)
  });
  if (findLottieTextValue(textRuntime) !== "Runtime task title") {
    throw new Error("Task Lottie text replacement did not reach the runtime payload.");
  }
  signals.push(signal("lottie_text_replacement_applied", {
    publicTargetHash: sha256Text(textApply.selection.publicTargetId),
    runtimeTargetHash: sha256Text(textApply.selection.runtimeTargetId)
  }));

  const resetImage = await resetReplacementWithAuthority({
    session,
    targetId: "avatar",
    kind: "image"
  });
  clearRuntimeValue(runtimeValues, resetImage.selection);
  const afterImageReset = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "lottie",
    requestId: `${opened.model.requestId}:image-reset`,
    replacements: runtimeReplacementPayload(resetImage.model.replacement, runtimeValues)
  });
  if (findLottieAsset(afterImageReset, "avatar").p !== originalAsset.p) {
    throw new Error("Task Lottie image reset did not restore the adjacent-image source payload.");
  }
  if (findLottieTextValue(afterImageReset) !== "Runtime task title") {
    throw new Error("Task Lottie image reset did not preserve sibling text replacement.");
  }

  const resetText = await resetReplacementWithAuthority({
    session,
    targetId: textTarget,
    kind: "text"
  });
  clearRuntimeValue(runtimeValues, resetText.selection);
  const afterTextReset = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "lottie",
    requestId: `${opened.model.requestId}:text-reset`,
    replacements: runtimeReplacementPayload(resetText.model.replacement, runtimeValues)
  });
  if (findLottieTextValue(afterTextReset) !== "Task title") {
    throw new Error("Task Lottie text reset did not restore source text.");
  }
  signals.push(signal("lottie_target_reset_restored", {
    imageResetDirty: resetImage.model.replacement.dirty,
    finalResetDirty: resetText.model.replacement.dirty,
    sourceImageRestored: true,
    siblingTextPreservedUntilTextReset: true
  }));

  return {
    alias: TASK_RUNTIME_FIXTURE_ALIASES.lottie,
    status: "passed",
    sourceIdHash: sha256Text(opened.sourceId),
    open: {
      status: opened.model.status,
      format: opened.model.detectedFormat,
      imageCount: opened.model.rightPanel.assetInventory.summary.imageCount,
      textCount: opened.model.rightPanel.assetInventory.summary.textCount
    },
    runtime: {
      status: prepared.status,
      scriptCount: prepared.runtimeScripts.length,
      externalImageInlined: true,
      originalImageDataUriHash: sha256Text(originalAsset.p)
    },
    replacement: {
      imagePublicTargetHash: sha256Text(imageApply.selection.publicTargetId),
      imageRuntimeTargetHash: sha256Text(imageApply.selection.runtimeTargetId),
      textPublicTargetHash: sha256Text(textApply.selection.publicTargetId),
      textRuntimeTargetHash: sha256Text(textApply.selection.runtimeTargetId),
      resetRestoredSource: true,
      siblingPreserved: true
    },
    playback: {
      playedStatus: played.model.status,
      pausedStatus: paused.model.status
    },
    pathRedacted: true
  };
}

async function proveVapFlow({ session, fixtureSet, replacementDataUri, signals }) {
  const runtimeValues = new Map();
  const opened = await requireOpened(
    session.openLocalFilePath(fixtureSet.files.vapPath, "fileButton"),
    "vap_fusion_opened"
  );
  if (opened.model.detectedFormat !== "vap" || opened.model.status !== "previewReady") {
    throw new Error("Task fusion VAP did not reach previewReady.");
  }
  const imageTarget = opened.model.rightPanel.vapFusionImages.find((entry) => entry.srcTag === "avatar");
  const textTarget = opened.model.rightPanel.vapFusionTexts.find((entry) => entry.srcTag === "title");
  if (!imageTarget || !textTarget) throw new Error("Task fusion VAP did not expose deterministic image/text targets.");
  signals.push(signal("vap_fusion_opened", {
    modelStatus: opened.model.status,
    imageTargetHash: sha256Text(imageTarget.resourceId),
    textTargetHash: sha256Text(textTarget.resourceId)
  }));

  const prepared = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "vap",
    requestId: opened.model.requestId,
    replacements: opened.model.replacement
  });
  if (prepared.status !== "prepared" || prepared.format !== "vap") {
    throw new Error("Task fusion VAP did not produce a prepared runtime payload.");
  }
  if (prepared.vapConfig?.src?.length !== 2 || Object.keys(prepared.fusionParams).length !== 0) {
    throw new Error("Task fusion VAP base runtime payload lost its sidecar config or started dirty.");
  }
  signals.push(signal("vap_runtime_prepared", {
    runtimeScriptHash: sha256Text(prepared.runtimeScripts.join(",")),
    sidecarSource: prepared.vapConfig ? "adjacent_json" : "missing",
    fusionSourceCount: prepared.vapConfig?.src?.length ?? 0
  }));

  const played = await session.control({ action: "play" });
  const paused = await session.control({ action: "pause" });
  if (played.model.status !== "playing" || paused.model.status !== "paused") {
    throw new Error("Task fusion VAP play/pause state did not advance.");
  }
  signals.push(signal("vap_playback_state_changed", {
    playedStatus: played.model.status,
    pausedStatus: paused.model.status
  }));

  const imageApply = await applyReplacementWithAuthority({
    session,
    targetId: imageTarget.resourceId,
    kind: "image",
    value: replacementDataUri
  });
  upsertRuntimeValue(runtimeValues, imageApply.replacementRuntimeValue);
  const imageRuntime = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "vap",
    requestId: `${opened.model.requestId}:image-replacement`,
    replacements: runtimeReplacementPayload(imageApply.model.replacement, runtimeValues)
  });
  if (imageRuntime.fusionParams.avatar !== replacementDataUri || imageRuntime.fusionParams[imageTarget.resourceId] !== undefined) {
    throw new Error("Task VAP image replacement did not use the canonical runtime fusion key.");
  }
  signals.push(signal("vap_image_replacement_applied", {
    publicTargetHash: sha256Text(imageApply.selection.publicTargetId),
    runtimeTargetHash: sha256Text(imageApply.selection.runtimeTargetId),
    canonicalRuntimeKey: imageApply.selection.runtimeTargetId
  }));

  const textApply = await applyReplacementWithAuthority({
    session,
    targetId: textTarget.resourceId,
    kind: "text",
    value: "Runtime VAP title"
  });
  upsertRuntimeValue(runtimeValues, textApply.replacementRuntimeValue);
  const textRuntime = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "vap",
    requestId: `${opened.model.requestId}:text-replacement`,
    replacements: runtimeReplacementPayload(textApply.model.replacement, runtimeValues)
  });
  if (textRuntime.fusionParams.avatar !== replacementDataUri || textRuntime.fusionParams.title !== "Runtime VAP title") {
    throw new Error("Task VAP text replacement did not preserve canonical sibling image binding.");
  }
  signals.push(signal("vap_text_replacement_applied", {
    publicTargetHash: sha256Text(textApply.selection.publicTargetId),
    runtimeTargetHash: sha256Text(textApply.selection.runtimeTargetId)
  }));

  const resetImage = await resetReplacementWithAuthority({
    session,
    targetId: imageTarget.resourceId,
    kind: "image"
  });
  clearRuntimeValue(runtimeValues, resetImage.selection);
  const afterImageReset = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "vap",
    requestId: `${opened.model.requestId}:image-reset`,
    replacements: runtimeReplacementPayload(resetImage.model.replacement, runtimeValues)
  });
  if (afterImageReset.fusionParams.avatar !== undefined || afterImageReset.fusionParams.title !== "Runtime VAP title") {
    throw new Error("Task VAP image reset did not clear only its canonical target.");
  }
  const resetText = await resetReplacementWithAuthority({
    session,
    targetId: textTarget.resourceId,
    kind: "text"
  });
  clearRuntimeValue(runtimeValues, resetText.selection);
  const afterTextReset = await session.prepareRuntimePreview({
    sourceId: opened.sourceId,
    format: "vap",
    requestId: `${opened.model.requestId}:text-reset`,
    replacements: runtimeReplacementPayload(resetText.model.replacement, runtimeValues)
  });
  if (Object.keys(afterTextReset.fusionParams).length !== 0 || resetText.model.replacement.resetEnabled !== false) {
    throw new Error("Task VAP final reset did not restore clean source fusion parameters.");
  }
  signals.push(signal("vap_target_reset_restored", {
    imageResetDirty: resetImage.model.replacement.dirty,
    finalResetDirty: resetText.model.replacement.dirty,
    sourceFusionParamsRestored: true,
    siblingTextPreservedUntilTextReset: true
  }));

  return {
    alias: TASK_RUNTIME_FIXTURE_ALIASES.vap,
    status: "passed",
    sourceIdHash: sha256Text(opened.sourceId),
    open: {
      status: opened.model.status,
      format: opened.model.detectedFormat,
      fusionImageCount: opened.model.rightPanel.vapFusionImages.length,
      fusionTextCount: opened.model.rightPanel.vapFusionTexts.length,
      issueReasons: opened.model.rightPanel.issues.map((issue) => issue.details?.reason).filter(Boolean)
    },
    runtime: {
      status: prepared.status,
      scriptCount: prepared.runtimeScripts.length,
      vapConfigSource: "adjacent_json",
      fusionParamsEmptyAtSource: true
    },
    replacement: {
      imagePublicTargetHash: sha256Text(imageApply.selection.publicTargetId),
      imageRuntimeTarget: imageApply.selection.runtimeTargetId,
      textPublicTargetHash: sha256Text(textApply.selection.publicTargetId),
      textRuntimeTarget: textApply.selection.runtimeTargetId,
      canonicalImageKeyUsed: imageRuntime.fusionParams.avatar === replacementDataUri,
      resetRestoredSource: true,
      siblingPreserved: true
    },
    playback: {
      playedStatus: played.model.status,
      pausedStatus: paused.model.status
    },
    pathRedacted: true
  };
}

async function applyReplacementWithAuthority({ session, targetId, kind, value }) {
  const selection = await session.resolveReplacementSelection({ targetId, kind });
  if (selection.status !== "accepted") {
    throw new Error(`replacement selection failed: ${selection.diagnostic?.code ?? "unknown"}`);
  }
  const model = await session.applyReplacement({
    targetId: selection.publicTargetId,
    kind,
    value
  });
  if (model.model?.replacement?.lastAction?.status !== "accepted") {
    throw new Error("replacement apply was not accepted by the owner model");
  }
  if (model.model.replacement.lastAction.runtimeTargetId !== selection.runtimeTargetId) {
    throw new Error("replacement apply did not echo the accepted canonical runtime target");
  }
  if (
    model.replacementRuntimeValue?.kind !== kind
    || model.replacementRuntimeValue.targetId !== selection.runtimeTargetId
    || model.replacementRuntimeValue.value !== value
  ) {
    throw new Error("replacement apply did not return the accepted canonical runtime value");
  }
  return { ...model, selection };
}

async function resetReplacementWithAuthority({ session, targetId, kind }) {
  const selection = await session.resolveReplacementSelection({ targetId, kind });
  if (selection.status !== "accepted") {
    throw new Error(`replacement reset selection failed: ${selection.diagnostic?.code ?? "unknown"}`);
  }
  const model = await session.resetReplacement({
    targetId: selection.publicTargetId,
    kind
  });
  if (model.model?.replacement?.lastAction?.type !== "resetReplacement" || model.model.replacement.lastAction.status !== "accepted") {
    throw new Error("replacement reset was not accepted by the owner model");
  }
  if (model.model.replacement.lastAction.runtimeTargetId !== selection.runtimeTargetId) {
    throw new Error("replacement reset did not echo the accepted canonical runtime target");
  }
  return { ...model, selection };
}

function runtimeReplacementPayload(replacement, runtimeValues) {
  return {
    ...(replacement ?? {}),
    runtimeValues: Array.from(runtimeValues.values())
  };
}

function runtimeValueKey(kind, targetId) {
  return `${kind}:${targetId}`;
}

function upsertRuntimeValue(runtimeValues, runtimeValue) {
  if (
    !runtimeValue
    || (runtimeValue.kind !== "image" && runtimeValue.kind !== "text")
    || typeof runtimeValue.targetId !== "string"
    || !runtimeValue.targetId.trim()
    || typeof runtimeValue.value !== "string"
    || !runtimeValue.value
  ) {
    throw new Error("replacement runtime value is incomplete");
  }
  runtimeValues.set(runtimeValueKey(runtimeValue.kind, runtimeValue.targetId.trim()), {
    kind: runtimeValue.kind,
    targetId: runtimeValue.targetId.trim(),
    value: runtimeValue.value
  });
}

function clearRuntimeValue(runtimeValues, selection) {
  if (selection?.kind !== "image" && selection?.kind !== "text") return;
  const runtimeTargetId = typeof selection.runtimeTargetId === "string" ? selection.runtimeTargetId.trim() : "";
  if (!runtimeTargetId) return;
  runtimeValues.delete(runtimeValueKey(selection.kind, runtimeTargetId));
}

async function requireOpened(promise, label) {
  const result = await Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} did not reach a terminal source state`)), 15_000))
  ]);
  if (result?.status !== "opened" || result?.pathRedacted !== true) {
    throw new Error(`${label} did not open with a redacted owner result`);
  }
  return result;
}

function findLottieAsset(runtime, id) {
  const asset = runtime.animationData?.assets?.find((entry) => entry?.id === id);
  if (!asset) throw new Error(`Lottie runtime asset ${id} is unavailable.`);
  return asset;
}

function findLottieTextValue(runtime) {
  const textLayer = runtime.animationData?.layers?.find((layer) => layer?.ty === 5);
  return textLayer?.t?.d?.k?.[0]?.s?.t;
}

function signal(phase, detail = {}) {
  return { phase, pathRedacted: true, ...detail };
}

function assertRequiredPhases(proof) {
  const phases = new Set(proof.signals.map(({ phase }) => phase));
  for (const phase of TASK_RUNTIME_ORACLE_PHASES.filter((entry) => entry !== "redacted_evidence_written")) {
    if (!phases.has(phase)) throw new Error(`Task source oracle missed required phase: ${phase}`);
  }
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
