export { SvgaFormatAdapter } from "./format-adapter.js";
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
  SvgaImageEditExportState,
  SvgaImageEditReplacementState,
  SvgaImageEditResourceIdentity,
  SvgaImageEditRevisionSnapshot,
  SvgaImageEditTransactionInput,
  SvgaImageEditTransactionRecord,
  SvgaImageEditTransactionType,
  SvgaImageEditHistoryState
} from "./image-edit-history.js";
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
  SvgaRoundTripReport
} from "./image-resource-editor.js";
export type {
  SvgaBinaryInspector,
  SvgaImageInspection,
  SvgaMovieInspection,
  SvgaMovieParamsInspection,
  SvgaSpriteInspection
} from "./types.js";
