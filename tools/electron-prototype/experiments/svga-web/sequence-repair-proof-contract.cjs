function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isNonEmptyArray(value, maxLength) {
  return Array.isArray(value) && value.length > 0 && value.length <= maxLength;
}

function isIntegerArray(value, maxLength) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= maxLength
    && value.every((item) => Number.isInteger(item) && item >= 0);
}

function validateAlphaProofEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (!isBoundedString(value.resourceKey, 120)) return undefined;
  if (!Number.isInteger(value.spriteIndex) || value.spriteIndex < 0) return undefined;
  if (!Number.isInteger(value.frameIndex) || value.frameIndex < 0) return undefined;
  if (!Number.isInteger(value.usageCount) || value.usageCount !== 1) return undefined;
  if (!Number.isInteger(value.width) || value.width <= 0 || value.width > 4096) return undefined;
  if (!Number.isInteger(value.height) || value.height <= 0 || value.height > 4096) return undefined;
  if (!isSha256(value.beforeSha256) || !isSha256(value.afterSha256)) return undefined;
  if (!Number.isInteger(value.beforeNonTransparentPixelCount) || value.beforeNonTransparentPixelCount < 0) return undefined;
  if (!Number.isInteger(value.afterNonTransparentPixelCount) || value.afterNonTransparentPixelCount < 0) return undefined;
  if (!Number.isFinite(value.beforeNonTransparentRatio) || !Number.isFinite(value.afterNonTransparentRatio)) return undefined;
  if (!isIntegerArray(value.visibleFrameIndices, 200)) return undefined;
  if (!Number.isFinite(value.maxTimelineAlpha) || value.maxTimelineAlpha <= 0) return undefined;
  if (!isSha256(value.timelineAlphaDigest)) return undefined;
  if (typeof value.changed !== "boolean") return undefined;
  if (value.changeReason !== "near_empty_speck_to_transparent" && value.changeReason !== "unchanged") return undefined;
  if (value.changed && value.changeReason !== "near_empty_speck_to_transparent") return undefined;
  if (!value.changed && value.changeReason !== "unchanged") return undefined;
  if (value.changed && value.beforeSha256 === value.afterSha256) return undefined;
  if (!value.changed && value.beforeSha256 !== value.afterSha256) return undefined;
  if (value.changed && value.afterNonTransparentPixelCount !== 0) return undefined;
  if (value.passed !== true) return undefined;
  return {
    resourceKey: value.resourceKey,
    spriteIndex: value.spriteIndex,
    frameIndex: value.frameIndex,
    usageCount: value.usageCount,
    width: value.width,
    height: value.height,
    beforeSha256: value.beforeSha256,
    afterSha256: value.afterSha256,
    beforeNonTransparentPixelCount: value.beforeNonTransparentPixelCount,
    afterNonTransparentPixelCount: value.afterNonTransparentPixelCount,
    beforeNonTransparentRatio: value.beforeNonTransparentRatio,
    afterNonTransparentRatio: value.afterNonTransparentRatio,
    beforeAlphaBounds: value.beforeAlphaBounds ?? null,
    afterAlphaBounds: value.afterAlphaBounds ?? null,
    visibleFrameIndices: value.visibleFrameIndices.slice(),
    maxTimelineAlpha: value.maxTimelineAlpha,
    timelineAlphaDigest: value.timelineAlphaDigest,
    changed: value.changed,
    changeReason: value.changeReason,
    passed: true
  };
}

function validateInvariantSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const required = [
    "sourceUnchanged",
    "roundTripPassed",
    "imageResourceKeySetStable",
    "spriteTimelineStable",
    "untouchedResourceHashesStable",
    "onlySelectedResourceChanged",
    "replacementDimensionsMatchOriginal"
  ];
  if (!required.every((key) => value[key] === true)) return undefined;
  return Object.fromEntries(required.map((key) => [key, true]));
}

function validateSequenceRepairReportBinding(value, bytes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (!bytes || typeof bytes.byteLength !== "number") return undefined;
  if (value.schemaVersion !== 1 || value.repairId !== "svga-sequence-frame-anti-flicker-v1") return undefined;
  if (value.status !== "repaired") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.sourceSha256AfterRepair) || !isSha256(value.editedSha256)) return undefined;
  if (value.sourceSha256AfterRepair !== value.sourceSha256 || value.editedSha256 === value.sourceSha256) return undefined;
  const editedSha256 = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
  if (value.editedSha256 !== editedSha256) return undefined;
  const group = value.sequenceGroup;
  if (!group || typeof group !== "object" || Array.isArray(group)) return undefined;
  if (!isBoundedString(group.groupId, 140) || group.detectionMethod !== "continuous_numeric_resource_keys") return undefined;
  if (!isNonEmptyArray(group.resourceKeys, 128) || !group.resourceKeys.every((key) => isBoundedString(key, 120))) return undefined;
  if (new Set(group.resourceKeys).size !== group.resourceKeys.length) return undefined;
  if (!Number.isInteger(group.resourceKeyCount) || group.resourceKeyCount !== group.resourceKeys.length || group.resourceKeyCount < 8) return undefined;
  if (!isBoundedString(group.repairedResourceKey, 120) || !group.resourceKeys.includes(group.repairedResourceKey)) return undefined;
  if (!isIntegerArray(group.targetVisibleFrames, 200)) return undefined;
  if (!Array.isArray(group.fullAffectedFrameVisibilityAlphaProof)
    || group.fullAffectedFrameVisibilityAlphaProof.length !== group.resourceKeys.length) {
    return undefined;
  }
  const alphaProof = group.fullAffectedFrameVisibilityAlphaProof.map(validateAlphaProofEntry);
  if (alphaProof.some((entry) => !entry)) return undefined;
  const alphaResourceKeys = alphaProof.map((entry) => entry.resourceKey);
  if (new Set(alphaResourceKeys).size !== alphaResourceKeys.length) return undefined;
  if (!group.resourceKeys.every((resourceKey) => alphaResourceKeys.includes(resourceKey))) return undefined;
  const changed = alphaProof.filter((entry) => entry.changed);
  if (changed.length !== 1 || changed[0].resourceKey !== group.repairedResourceKey) return undefined;

  const selectedRepair = value.selectedRepair;
  if (!selectedRepair || typeof selectedRepair !== "object" || Array.isArray(selectedRepair)) return undefined;
  if (selectedRepair.resourceKey !== group.repairedResourceKey) return undefined;
  if (selectedRepair.reason !== "near_empty_visible_speck_frame") return undefined;
  if (selectedRepair.replacement !== "same_dimensions_transparent_png") return undefined;
  if (!Number.isInteger(selectedRepair.beforeNonTransparentPixelCount) || selectedRepair.beforeNonTransparentPixelCount <= 0) return undefined;
  if (selectedRepair.afterNonTransparentPixelCount !== 0) return undefined;
  if (!isSha256(selectedRepair.beforeSha256) || !isSha256(selectedRepair.afterSha256)) return undefined;
  if (selectedRepair.afterSha256 !== changed[0].afterSha256) return undefined;
  if (!value.roundTripReport || typeof value.roundTripReport !== "object" || Array.isArray(value.roundTripReport)) return undefined;
  if (value.roundTripReport.passed !== true || value.roundTripReport.sourceSha256 !== value.sourceSha256) return undefined;
  if (value.roundTripReport.sourceSha256AfterEditing !== value.sourceSha256) return undefined;
  if (value.roundTripReport.exportedSha256 !== value.editedSha256) return undefined;
  if (value.roundTripReport.replacedResourceKey !== group.repairedResourceKey) return undefined;
  if (value.roundTripReport.exportedResourceSha256 !== selectedRepair.afterSha256) return undefined;
  const invariantSummary = validateInvariantSummary(value.invariantSummary);
  if (!invariantSummary) return undefined;
  if (
    value.productSaveAsEnabled !== true
    || value.repairSuccessClaimed !== true
    || value.manualVisualConfirmationRequired !== false
    || value.failureClosed !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    repairId: value.repairId,
    status: "repaired",
    sourceSha256: value.sourceSha256,
    sourceSha256AfterRepair: value.sourceSha256AfterRepair,
    editedSha256: value.editedSha256,
    headCommit: typeof value.headCommit === "string" ? value.headCommit.slice(0, 80) : "",
    sequenceGroup: {
      groupId: group.groupId,
      detectionMethod: group.detectionMethod,
      resourceKeys: group.resourceKeys.slice(),
      resourceKeyCount: group.resourceKeyCount,
      repairedResourceKey: group.repairedResourceKey,
      targetVisibleFrames: group.targetVisibleFrames.slice(),
      fullAffectedFrameVisibilityAlphaProof: alphaProof
    },
    selectedRepair: {
      resourceKey: selectedRepair.resourceKey,
      reason: selectedRepair.reason,
      replacement: selectedRepair.replacement,
      beforeNonTransparentPixelCount: selectedRepair.beforeNonTransparentPixelCount,
      afterNonTransparentPixelCount: 0,
      beforeNonTransparentRatio: selectedRepair.beforeNonTransparentRatio,
      afterNonTransparentRatio: selectedRepair.afterNonTransparentRatio,
      beforeSha256: selectedRepair.beforeSha256,
      afterSha256: selectedRepair.afterSha256
    },
    roundTripReport: value.roundTripReport,
    invariantSummary,
    productSaveAsEnabled: true,
    repairSuccessClaimed: true,
    manualVisualConfirmationRequired: false,
    failureClosed: true,
    passed: true
  };
}

function validateSequenceProductRepairProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-product-repair-save-as-proof") return undefined;
  if (value.source !== "workbench-sequence-product-repair-save-as") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.editedSha256) || !isSha256(value.savedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256 || value.savedSha256 !== value.editedSha256) return undefined;
  if (!isBoundedString(value.savedFileName, 180) || !value.savedFileName.endsWith(".svga")) return undefined;
  if (!isBoundedString(value.repairedResourceKey, 120)) return undefined;
  if (!Number.isInteger(value.groupResourceKeyCount) || value.groupResourceKeyCount < 8) return undefined;
  if (!Number.isInteger(value.alphaProofResourceCount) || value.alphaProofResourceCount !== value.groupResourceKeyCount) return undefined;
  if (!Number.isInteger(value.changedResourceCount) || value.changedResourceCount !== 1) return undefined;
  if (!Array.isArray(value.fullAffectedFrameVisibilityAlphaProof)
    || value.fullAffectedFrameVisibilityAlphaProof.length !== value.alphaProofResourceCount) {
    return undefined;
  }
  const alphaProof = value.fullAffectedFrameVisibilityAlphaProof.map(validateAlphaProofEntry);
  if (alphaProof.some((entry) => !entry)) return undefined;
  const changedAlphaProof = alphaProof.filter((entry) => entry.changed);
  if (changedAlphaProof.length !== 1 || changedAlphaProof[0].resourceKey !== value.repairedResourceKey) return undefined;
  if (!isIntegerArray(value.targetVisibleFrames, 200)) return undefined;
  if (!isNonEmptyArray(value.beforeAfterPlaybackProof, 12)) return undefined;
  if (!value.beforeAfterPlaybackProof.every((entry) => (
    entry
    && typeof entry === "object"
    && !Array.isArray(entry)
    && Number.isInteger(entry.frameIndex)
    && entry.frameIndex >= 0
    && isSha256(entry.beforeCanvasSha256)
    && isSha256(entry.afterCanvasSha256)
    && Number.isInteger(entry.canvasWidth)
    && entry.canvasWidth > 0
    && Number.isInteger(entry.canvasHeight)
    && entry.canvasHeight > 0
    && entry.canvasDimensionsStable === true
    && entry.beforeCanvasNonBlank === true
    && entry.afterCanvasNonBlank === true
  ))) {
    return undefined;
  }
  if (
    value.saveStatus !== "saved"
    || value.savedHashBound !== true
    || value.sourceUnchanged !== true
    || value.fullAffectedFrameVisibilityAlphaProofPassed !== true
    || value.repairedFrameTransparentAfter !== true
    || value.productSaveAsEnabled !== true
    || value.repairSuccessClaimed !== true
    || value.manualVisualConfirmationRequired !== false
    || value.failureClosed !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    editedSha256: value.editedSha256,
    savedSha256: value.savedSha256,
    savedFileName: value.savedFileName,
    saveStatus: "saved",
    repairedResourceKey: value.repairedResourceKey,
    groupResourceKeyCount: value.groupResourceKeyCount,
    alphaProofResourceCount: value.alphaProofResourceCount,
    changedResourceCount: 1,
    fullAffectedFrameVisibilityAlphaProof: alphaProof,
    targetVisibleFrames: value.targetVisibleFrames.slice(),
    beforeAfterPlaybackProof: value.beforeAfterPlaybackProof.map((entry) => ({ ...entry })),
    savedHashBound: true,
    sourceUnchanged: true,
    fullAffectedFrameVisibilityAlphaProofPassed: true,
    repairedFrameTransparentAfter: true,
    playbackDeltaObserved: value.playbackDeltaObserved === true,
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
}

function describeSequenceProductRepairProofValidationFailure(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "shape";
  if (value.schemaVersion !== 1) return "schemaVersion";
  if (value.proofId !== "svga-sequence-product-repair-save-as-proof") return "proofId";
  if (value.source !== "workbench-sequence-product-repair-save-as") return "source";
  for (const key of ["sourceSha256", "editedSha256", "savedSha256"]) {
    if (!isSha256(value[key])) return key;
  }
  if (value.editedSha256 === value.sourceSha256) return "edited_equals_source";
  if (value.savedSha256 !== value.editedSha256) return "saved_not_bound_to_edited";
  if (!isBoundedString(value.savedFileName, 180) || !value.savedFileName.endsWith(".svga")) return "savedFileName";
  if (!isBoundedString(value.repairedResourceKey, 120)) return "repairedResourceKey";
  if (!Number.isInteger(value.groupResourceKeyCount) || value.groupResourceKeyCount < 8) return "groupResourceKeyCount";
  if (!Number.isInteger(value.alphaProofResourceCount) || value.alphaProofResourceCount !== value.groupResourceKeyCount) return "alphaProofResourceCount";
  if (!Number.isInteger(value.changedResourceCount) || value.changedResourceCount !== 1) return "changedResourceCount";
  if (!Array.isArray(value.fullAffectedFrameVisibilityAlphaProof) || value.fullAffectedFrameVisibilityAlphaProof.length !== value.alphaProofResourceCount) {
    return "fullAffectedFrameVisibilityAlphaProof";
  }
  const badAlphaIndex = value.fullAffectedFrameVisibilityAlphaProof.findIndex((entry) => !validateAlphaProofEntry(entry));
  if (badAlphaIndex >= 0) return `fullAffectedFrameVisibilityAlphaProof:${badAlphaIndex}`;
  if (!isIntegerArray(value.targetVisibleFrames, 200)) return "targetVisibleFrames";
  if (!isNonEmptyArray(value.beforeAfterPlaybackProof, 12)) return "beforeAfterPlaybackProof";
  const badFrameIndex = value.beforeAfterPlaybackProof.findIndex((entry) => !(
    entry
    && typeof entry === "object"
    && !Array.isArray(entry)
    && Number.isInteger(entry.frameIndex)
    && entry.frameIndex >= 0
    && isSha256(entry.beforeCanvasSha256)
    && isSha256(entry.afterCanvasSha256)
    && Number.isInteger(entry.canvasWidth)
    && entry.canvasWidth > 0
    && Number.isInteger(entry.canvasHeight)
    && entry.canvasHeight > 0
    && entry.canvasDimensionsStable === true
    && entry.beforeCanvasNonBlank === true
    && entry.afterCanvasNonBlank === true
  ));
  if (badFrameIndex >= 0) return `beforeAfterPlaybackProof:${badFrameIndex}`;
  const requiredTrue = [
    "savedHashBound",
    "sourceUnchanged",
    "fullAffectedFrameVisibilityAlphaProofPassed",
    "repairedFrameTransparentAfter",
    "productSaveAsEnabled",
    "repairSuccessClaimed",
    "failureClosed",
    "reopenedPlayback",
    "reopenedCanvasNonBlank",
    "reopenedInspectionReport",
    "renderedProofPassed",
    "passed"
  ];
  const missingTrue = requiredTrue.find((key) => value[key] !== true);
  if (missingTrue) return missingTrue;
  if (typeof value.playbackDeltaObserved !== "boolean") return "playbackDeltaObserved";
  if (value.manualVisualConfirmationRequired !== false) return "manualVisualConfirmationRequired";
  return validateSequenceProductRepairProof(value) ? "unknown-valid" : "unknown";
}

function isResourceDeltaList(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 32
    && value.every((delta) => (
      delta
      && typeof delta === "object"
      && !Array.isArray(delta)
      && isBoundedString(delta.resourceKey, 120)
      && isSha256(delta.beforeSha256)
      && isSha256(delta.afterSha256)
      && delta.beforeSha256 !== delta.afterSha256
    ))
    && new Set(value.map((delta) => delta.resourceKey)).size === value.length;
}

function validateSequenceByteRepairProof(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 1 || value.proofId !== "svga-sequence-byte-repair-proof") return undefined;
  if (value.source !== "workbench-sequence-byte-repair") return undefined;
  if (value.prototypeId !== "svga-bounded-sequence-repair-prototype-v1") return undefined;
  if (!isSha256(value.sourceSha256) || !isSha256(value.editedSha256)) return undefined;
  if (value.editedSha256 === value.sourceSha256) return undefined;
  if (value.sourceSha256AfterRepair !== value.sourceSha256) return undefined;
  if (value.roundTripMode === "no_op_source_reopen" || value.roundTripNoopOnly === true) return undefined;
  if (!Number.isInteger(value.resourceKeyCount) || value.resourceKeyCount <= 0 || value.resourceKeyCount > 32) return undefined;
  if (!Number.isInteger(value.operationCount) || value.operationCount <= 0) return undefined;
  if (!isResourceDeltaList(value.resourceDiffs) || value.resourceDiffs.length !== value.resourceKeyCount) return undefined;
  if (!isBoundedString(value.roundTripMode, 80) || value.roundTripMode !== "edited_bytes_reopen") return undefined;
  if (
    value.sourceDeltaProduced !== true
    || value.editedBytesProduced !== true
    || value.roundTripPassed !== true
    || value.reopenedPlayback !== true
    || value.reopenedCanvasNonBlank !== true
    || value.reopenedInspectionReport !== true
    || value.renderedProofPassed !== true
    || value.writeAttempted !== false
    || value.productSaveAsEnabled !== false
    || value.writeActionExposed !== false
    || value.repairSuccessClaimed !== false
    || value.manualVisualConfirmationRequired !== true
    || value.passed !== true
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    proofId: value.proofId,
    source: value.source,
    sourceSha256: value.sourceSha256,
    sourceSha256AfterRepair: value.sourceSha256AfterRepair,
    editedSha256: value.editedSha256,
    prototypeId: value.prototypeId,
    resourceKeyCount: value.resourceKeyCount,
    operationCount: value.operationCount,
    resourceDiffs: value.resourceDiffs.map((delta) => ({
      resourceKey: delta.resourceKey,
      beforeSha256: delta.beforeSha256,
      afterSha256: delta.afterSha256
    })),
    roundTripMode: value.roundTripMode,
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
}

module.exports = {
  validateSequenceByteRepairProof,
  describeSequenceProductRepairProofValidationFailure,
  validateSequenceProductRepairProof,
  validateSequenceRepairReportBinding
};
