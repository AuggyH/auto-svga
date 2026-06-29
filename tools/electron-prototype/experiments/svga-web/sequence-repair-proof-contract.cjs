function isBoundedString(value, maxLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
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
  validateSequenceByteRepairProof
};
