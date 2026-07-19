export { SvgaFormatAdapter } from "./format-adapter.js";
export { createSvgaAebBakeAdapterInput } from "./aeb-bake-adapter.js";
export type { SvgaAebBakeAdapterInput } from "./aeb-bake-adapter.js";
export {
  createSvgaBatchPngMappingReport,
  createSvgaBatchReplacementInputs
} from "./batch-png-mapping.js";
export {
  optimizeSvgaImageResources,
  SvgaImageOptimizationError
} from "./asset-optimizer.js";
export {
  repairSvgaSequenceFrameFlicker,
  SvgaSequenceFrameRepairError
} from "./sequence-frame-repair.js";
export {
  applySvgaImageEditTransaction,
  createSvgaImageEditHistory,
  markSvgaImageEditSaved,
  redoSvgaImageEditHistory,
  replacementDigest,
  selectSvgaImageEditResource,
  undoSvgaImageEditHistory
} from "./image-edit-history.js";
export { SvgaImageResourceEditor, SvgaImageEditError } from "./image-resource-editor.js";
export { NodeProtobufSvgaInspector } from "./node-protobuf-inspector.js";
export { SvgaMotionSpecChecker } from "./spec-checker.js";
export { readEmbeddedImageMetadata } from "./image-metadata.js";
export type { EmbeddedImageMetadata } from "./image-metadata.js";
export type {
  CreateSvgaImageEditHistoryOptions,
  SvgaImageEditBatchMappingRecord,
  SvgaImageEditExportState,
  SvgaImageEditReplacementState,
  SvgaImageEditResourceIdentity,
  SvgaImageEditRevisionSnapshot,
  SvgaImageEditSourceFileIdentity,
  SvgaImageEditTransactionInput,
  SvgaImageEditTransactionRecord,
  SvgaImageEditTransactionType,
  SvgaImageEditHistoryState
} from "./image-edit-history.js";
export type {
  SvgaImageOptimizationAction,
  SvgaImageOptimizationActionType,
  SvgaImageOptimizationInvariantCheck,
  SvgaImageOptimizationRedirect,
  SvgaImageOptimizationReport,
  SvgaImageOptimizationResult
} from "./asset-optimizer.js";
export type {
  SvgaSequenceFrameAlphaProof,
  SvgaSequenceFrameRepairOptions,
  SvgaSequenceFrameRepairReport,
  SvgaSequenceFrameRepairResult
} from "./sequence-frame-repair.js";
export type {
  SvgaBatchPngConfidenceClass,
  SvgaBatchPngImportLimits,
  SvgaBatchPngInput,
  SvgaBatchPngIssue,
  SvgaBatchPngMappingRecord,
  SvgaBatchPngMappingReport,
  SvgaBatchPngMappingRuleId,
  SvgaBatchPngMappingStatus
} from "./batch-png-mapping.js";
export type {
  SvgaEditableImageResource,
  SvgaImageEditExportResult,
  SvgaImageEditIssue,
  SvgaImageEditSession,
  SvgaImageReplacementInput,
  SvgaImageReplacementStatus,
  SvgaImageValidationStatus,
  SvgaInvariantCheck,
  SvgaPngValidationLimits,
  SvgaPngValidationResult,
  SvgaReplacementSummary,
  SvgaRoundTripAppliedMappingCheck,
  SvgaRoundTripBatchMappingInput,
  SvgaRoundTripReport,
  SvgaRoundTripReportV4
} from "./image-resource-editor.js";
export type {
  SvgaBinaryInspector,
  SvgaImageInspection,
  SvgaMovieInspection,
  SvgaMovieParamsInspection,
  SvgaSpriteInspection
} from "./types.js";
