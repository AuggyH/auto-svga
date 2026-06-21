import { createHash } from "node:crypto";
import { decodeRgbaPng } from "../../utils/png-reader.js";
import { readEmbeddedImageMetadata } from "./image-metadata.js";
import type { SvgaEditableImageResource, SvgaImageReplacementInput } from "./image-resource-editor.js";

export type SvgaBatchPngMappingRuleId =
  | "resource_key_exact"
  | "display_name_exact"
  | "resource_key_normalized_unique"
  | "display_name_normalized_unique"
  | "manual"
  | "none";

export type SvgaBatchPngMappingStatus =
  | "exact_match"
  | "unique_normalized_match"
  | "unmatched"
  | "ambiguous"
  | "duplicate_target"
  | "excluded"
  | "invalid"
  | "manually_resolved";

export type SvgaBatchPngConfidenceClass =
  | "exact"
  | "normalized_unique"
  | "manual"
  | "none"
  | "conflict";

export interface SvgaBatchPngImportLimits {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxPixels?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface SvgaBatchPngInput {
  fileLabel: string;
  pngBytes: Uint8Array;
  include?: boolean;
  manualResourceKey?: string;
}

export interface SvgaBatchPngIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface SvgaBatchPngMappingRecord {
  inputIndex: number;
  fileLabel: string;
  basename: string;
  sizeBytes: number;
  sha256: string;
  width?: number;
  height?: number;
  status: SvgaBatchPngMappingStatus;
  ruleId: SvgaBatchPngMappingRuleId;
  candidateResourceKeys: readonly string[];
  selectedResourceKey?: string;
  confidenceClass: SvgaBatchPngConfidenceClass;
  reason: string;
  include: boolean;
  issues: readonly SvgaBatchPngIssue[];
}

export interface SvgaBatchPngMappingReport {
  schemaVersion: 1;
  mappingPolicyVersion: "p5-batch-png-mapping-v1";
  fileCount: number;
  includedFileCount: number;
  resourceCount: number;
  limits: Required<SvgaBatchPngImportLimits>;
  records: readonly SvgaBatchPngMappingRecord[];
  issues: readonly SvgaBatchPngIssue[];
  readyToApply: boolean;
  applicableReplacements: readonly {
    fileLabel: string;
    resourceKey: string;
    sha256: string;
    width: number;
    height: number;
    sizeBytes: number;
    ruleId: SvgaBatchPngMappingRuleId;
    status: Exclude<SvgaBatchPngMappingStatus, "unmatched" | "ambiguous" | "duplicate_target" | "excluded" | "invalid">;
  }[];
}

const defaultLimits: Required<SvgaBatchPngImportLimits> = {
  maxFiles: 25,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxPixels: 4_000_000,
  maxWidth: 4_096,
  maxHeight: 4_096
};

const applyableStatuses = new Set<SvgaBatchPngMappingStatus>([
  "exact_match",
  "unique_normalized_match",
  "manually_resolved"
]);

export function createSvgaBatchPngMappingReport(
  resources: readonly SvgaEditableImageResource[],
  inputs: readonly SvgaBatchPngInput[],
  limits: SvgaBatchPngImportLimits = {}
): SvgaBatchPngMappingReport {
  const resolvedLimits = { ...defaultLimits, ...limits };
  const issues: SvgaBatchPngIssue[] = [];
  const totalBytes = inputs.reduce((sum, input) => sum + input.pngBytes.byteLength, 0);

  if (inputs.length > resolvedLimits.maxFiles) {
    issues.push(errorIssue("batch_file_count_exceeded", "Batch contains more PNG files than allowed.", {
      fileCount: inputs.length,
      maxFiles: resolvedLimits.maxFiles
    }));
  }
  if (totalBytes > resolvedLimits.maxTotalBytes) {
    issues.push(errorIssue("batch_total_size_exceeded", "Batch total PNG size is too large.", {
      totalBytes,
      maxTotalBytes: resolvedLimits.maxTotalBytes
    }));
  }

  const indexes = createResourceIndexes(resources);
  const records = inputs.map((input, inputIndex) => createInitialRecord(input, inputIndex, resources, indexes, resolvedLimits));
  const recordsWithDuplicateBytes = markDuplicateByteHashes(records);
  const recordsWithDuplicateTargets = markDuplicateTargets(recordsWithDuplicateBytes);
  const applicableReplacements = recordsWithDuplicateTargets
    .filter((record) => applyableStatuses.has(record.status))
    .filter((record) => record.include)
    .filter((record): record is SvgaBatchPngMappingRecord & {
      selectedResourceKey: string;
      width: number;
      height: number;
    } => Boolean(record.selectedResourceKey && record.width && record.height))
    .map((record) => ({
      fileLabel: record.fileLabel,
      resourceKey: record.selectedResourceKey,
      sha256: record.sha256,
      width: record.width,
      height: record.height,
      sizeBytes: record.sizeBytes,
      ruleId: record.ruleId,
      status: record.status as "exact_match" | "unique_normalized_match" | "manually_resolved"
    }));
  const blockingRecordCount = recordsWithDuplicateTargets.filter((record) => (
    record.include
    && !applyableStatuses.has(record.status)
  )).length;
  const readyToApply = issues.every((issue) => issue.severity !== "error")
    && applicableReplacements.length > 0
    && blockingRecordCount === 0;

  return {
    schemaVersion: 1,
    mappingPolicyVersion: "p5-batch-png-mapping-v1",
    fileCount: inputs.length,
    includedFileCount: recordsWithDuplicateTargets.filter((record) => record.include).length,
    resourceCount: resources.length,
    limits: resolvedLimits,
    records: recordsWithDuplicateTargets,
    issues,
    readyToApply,
    applicableReplacements
  };
}

export function createSvgaBatchReplacementInputs(
  report: SvgaBatchPngMappingReport,
  inputs: readonly SvgaBatchPngInput[]
): readonly SvgaImageReplacementInput[] {
  if (!report.readyToApply) {
    return [];
  }
  return report.applicableReplacements.map((replacement) => {
    const input = inputs.find((candidate) => (
      candidate.fileLabel === replacement.fileLabel
      && sha256(candidate.pngBytes) === replacement.sha256
    ));
    return {
      resourceKey: replacement.resourceKey,
      pngBytes: input?.pngBytes.slice() ?? new Uint8Array()
    };
  });
}

function createInitialRecord(
  input: SvgaBatchPngInput,
  inputIndex: number,
  resources: readonly SvgaEditableImageResource[],
  indexes: ResourceIndexes,
  limits: Required<SvgaBatchPngImportLimits>
): SvgaBatchPngMappingRecord {
  const fileLabel = sanitizeFileLabel(input.fileLabel);
  const basename = basenameWithoutPngExtension(fileLabel);
  const include = input.include !== false;
  const sha = sha256(input.pngBytes);
  const issues: SvgaBatchPngIssue[] = [];
  const metadata = readEmbeddedImageMetadata(input.pngBytes);
  let width: number | undefined;
  let height: number | undefined;

  if (input.pngBytes.byteLength > limits.maxFileBytes) {
    issues.push(errorIssue("png_file_too_large", "PNG file is larger than the per-file limit.", {
      sizeBytes: input.pngBytes.byteLength,
      maxFileBytes: limits.maxFileBytes
    }));
  }
  if (metadata.format !== "png" || !metadata.dimensions) {
    issues.push(errorIssue("not_png", "Input file is not a valid PNG."));
  } else {
    width = metadata.dimensions.width;
    height = metadata.dimensions.height;
    if (width <= 0 || height <= 0) {
      issues.push(errorIssue("invalid_png_dimensions", "PNG dimensions must be greater than zero.", { width, height }));
    }
    if (width > limits.maxWidth || height > limits.maxHeight || width * height > limits.maxPixels) {
      issues.push(errorIssue("png_dimensions_too_large", "PNG dimensions exceed batch limits.", {
        width,
        height,
        maxWidth: limits.maxWidth,
        maxHeight: limits.maxHeight,
        maxPixels: limits.maxPixels
      }));
    }
    if (issues.every((issue) => issue.code !== "png_dimensions_too_large" && issue.code !== "invalid_png_dimensions")) {
      try {
        decodeRgbaPng(Buffer.from(input.pngBytes.buffer, input.pngBytes.byteOffset, input.pngBytes.byteLength));
      } catch (error) {
        issues.push(errorIssue("png_decode_failed", "PNG could not be decoded.", {
          reason: error instanceof Error ? error.message : String(error)
        }));
      }
    }
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return record(inputIndex, fileLabel, basename, input.pngBytes.byteLength, sha, width, height, "invalid", "none", [], undefined, "none", "Invalid PNG input.", include, issues);
  }

  if (!include) {
    return record(inputIndex, fileLabel, basename, input.pngBytes.byteLength, sha, width, height, "excluded", "none", [], undefined, "none", "File excluded from batch apply.", false, issues);
  }

  if (input.manualResourceKey) {
    const target = resources.find((resource) => resource.resourceKey === input.manualResourceKey);
    if (!target) {
      return record(inputIndex, fileLabel, basename, input.pngBytes.byteLength, sha, width, height, "ambiguous", "manual", [], undefined, "conflict", "Manual target does not exist.", include, [
        ...issues,
        errorIssue("manual_target_not_found", "Manual target resource does not exist.", {
          manualResourceKey: input.manualResourceKey
        })
      ]);
    }
    return withDimensionWarning(record(inputIndex, fileLabel, basename, input.pngBytes.byteLength, sha, width, height, "manually_resolved", "manual", [target.resourceKey], target.resourceKey, "manual", "User-selected manual mapping.", include, issues), target);
  }

  const matched = matchBasename(basename, indexes);
  const baseRecord = record(
    inputIndex,
    fileLabel,
    basename,
    input.pngBytes.byteLength,
    sha,
    width,
    height,
    matched.status,
    matched.ruleId,
    matched.candidateResourceKeys,
    matched.selectedResourceKey,
    matched.confidenceClass,
    matched.reason,
    include,
    issues
  );
  const target = resources.find((resource) => resource.resourceKey === baseRecord.selectedResourceKey);
  return target ? withDimensionWarning(baseRecord, target) : baseRecord;
}

function matchBasename(basename: string, indexes: ResourceIndexes): Pick<
  SvgaBatchPngMappingRecord,
  "status" | "ruleId" | "candidateResourceKeys" | "selectedResourceKey" | "confidenceClass" | "reason"
> {
  const exactResource = indexes.resourceKeyExact.get(basename);
  if (exactResource) {
    return {
      status: "exact_match",
      ruleId: "resource_key_exact",
      candidateResourceKeys: [exactResource],
      selectedResourceKey: exactResource,
      confidenceClass: "exact",
      reason: "PNG basename exactly matches resourceKey."
    };
  }

  const exactDisplay = indexes.displayNameExact.get(basename) ?? [];
  if (exactDisplay.length === 1) {
    return {
      status: "exact_match",
      ruleId: "display_name_exact",
      candidateResourceKeys: exactDisplay,
      selectedResourceKey: exactDisplay[0],
      confidenceClass: "exact",
      reason: "PNG basename exactly matches unique displayName."
    };
  }
  if (exactDisplay.length > 1) {
    return ambiguous("display_name_exact", exactDisplay, "PNG basename matches multiple displayName values.");
  }

  const normalized = normalizeForMapping(basename);
  const normalizedResource = indexes.resourceKeyNormalized.get(normalized) ?? [];
  if (normalizedResource.length === 1) {
    return {
      status: "unique_normalized_match",
      ruleId: "resource_key_normalized_unique",
      candidateResourceKeys: normalizedResource,
      selectedResourceKey: normalizedResource[0],
      confidenceClass: "normalized_unique",
      reason: "NFC + case-fold basename matches one resourceKey."
    };
  }
  if (normalizedResource.length > 1) {
    return ambiguous("resource_key_normalized_unique", normalizedResource, "NFC + case-fold basename matches multiple resourceKey values.");
  }

  const normalizedDisplay = indexes.displayNameNormalized.get(normalized) ?? [];
  if (normalizedDisplay.length === 1) {
    return {
      status: "unique_normalized_match",
      ruleId: "display_name_normalized_unique",
      candidateResourceKeys: normalizedDisplay,
      selectedResourceKey: normalizedDisplay[0],
      confidenceClass: "normalized_unique",
      reason: "NFC + case-fold basename matches one displayName."
    };
  }
  if (normalizedDisplay.length > 1) {
    return ambiguous("display_name_normalized_unique", normalizedDisplay, "NFC + case-fold basename matches multiple displayName values.");
  }

  return {
    status: "unmatched",
    ruleId: "none",
    candidateResourceKeys: [],
    confidenceClass: "none",
    reason: "No exact or unique normalized mapping rule matched."
  };
}

function markDuplicateByteHashes(records: readonly SvgaBatchPngMappingRecord[]): readonly SvgaBatchPngMappingRecord[] {
  const hashCounts = new Map<string, number>();
  for (const record of records) {
    if (record.status !== "invalid") {
      hashCounts.set(record.sha256, (hashCounts.get(record.sha256) ?? 0) + 1);
    }
  }
  return records.map((record) => {
    if ((hashCounts.get(record.sha256) ?? 0) <= 1) return record;
    return {
      ...record,
      issues: [
        ...record.issues,
        warningIssue("duplicate_png_bytes", "Another selected PNG has identical bytes.", {
          sha256: record.sha256
        })
      ]
    };
  });
}

function markDuplicateTargets(records: readonly SvgaBatchPngMappingRecord[]): readonly SvgaBatchPngMappingRecord[] {
  const targetCounts = new Map<string, number>();
  for (const record of records) {
    if (!record.include || !record.selectedResourceKey || !applyableStatuses.has(record.status)) continue;
    targetCounts.set(record.selectedResourceKey, (targetCounts.get(record.selectedResourceKey) ?? 0) + 1);
  }
  return records.map((record) => {
    if (!record.selectedResourceKey || (targetCounts.get(record.selectedResourceKey) ?? 0) <= 1) {
      return record;
    }
    return {
      ...record,
      status: "duplicate_target",
      confidenceClass: "conflict",
      reason: "More than one included PNG maps to the same target resource.",
      issues: [
        ...record.issues,
        errorIssue("duplicate_target_resource", "Only one included PNG may replace a resource in one batch.", {
          resourceKey: record.selectedResourceKey
        })
      ]
    };
  });
}

function withDimensionWarning(
  mapping: SvgaBatchPngMappingRecord,
  resource: SvgaEditableImageResource
): SvgaBatchPngMappingRecord {
  if (
    mapping.width === undefined
    || mapping.height === undefined
    || resource.decodedWidth === undefined
    || resource.decodedHeight === undefined
    || (mapping.width === resource.decodedWidth && mapping.height === resource.decodedHeight)
  ) {
    return mapping;
  }
  return {
    ...mapping,
    issues: [
      ...mapping.issues,
      warningIssue("dimension_mismatch", "Replacement PNG dimensions differ from the target resource.", {
        resourceKey: resource.resourceKey,
        originalWidth: resource.decodedWidth,
        originalHeight: resource.decodedHeight,
        replacementWidth: mapping.width,
        replacementHeight: mapping.height
      })
    ]
  };
}

interface ResourceIndexes {
  resourceKeyExact: ReadonlyMap<string, string>;
  displayNameExact: ReadonlyMap<string, readonly string[]>;
  resourceKeyNormalized: ReadonlyMap<string, readonly string[]>;
  displayNameNormalized: ReadonlyMap<string, readonly string[]>;
}

function createResourceIndexes(resources: readonly SvgaEditableImageResource[]): ResourceIndexes {
  return {
    resourceKeyExact: new Map(resources.map((resource) => [resource.resourceKey, resource.resourceKey])),
    displayNameExact: groupBy(resources, (resource) => resource.displayName),
    resourceKeyNormalized: groupBy(resources, (resource) => normalizeForMapping(resource.resourceKey)),
    displayNameNormalized: groupBy(resources, (resource) => normalizeForMapping(resource.displayName))
  };
}

function groupBy(
  resources: readonly SvgaEditableImageResource[],
  keyFor: (resource: SvgaEditableImageResource) => string
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, string[]>();
  for (const resource of resources) {
    const key = keyFor(resource);
    groups.set(key, [...(groups.get(key) ?? []), resource.resourceKey]);
  }
  return new Map([...groups].map(([key, values]) => [key, values.sort()]));
}

function ambiguous(
  ruleId: SvgaBatchPngMappingRuleId,
  candidateResourceKeys: readonly string[],
  reason: string
): Pick<
  SvgaBatchPngMappingRecord,
  "status" | "ruleId" | "candidateResourceKeys" | "confidenceClass" | "reason"
> {
  return {
    status: "ambiguous",
    ruleId,
    candidateResourceKeys: [...candidateResourceKeys].sort(),
    confidenceClass: "conflict",
    reason
  };
}

function record(
  inputIndex: number,
  fileLabel: string,
  basename: string,
  sizeBytes: number,
  sha: string,
  width: number | undefined,
  height: number | undefined,
  status: SvgaBatchPngMappingStatus,
  ruleId: SvgaBatchPngMappingRuleId,
  candidateResourceKeys: readonly string[],
  selectedResourceKey: string | undefined,
  confidenceClass: SvgaBatchPngConfidenceClass,
  reason: string,
  include: boolean,
  issues: readonly SvgaBatchPngIssue[]
): SvgaBatchPngMappingRecord {
  return {
    inputIndex,
    fileLabel,
    basename,
    sizeBytes,
    sha256: sha,
    width,
    height,
    status,
    ruleId,
    candidateResourceKeys: [...candidateResourceKeys].sort(),
    selectedResourceKey,
    confidenceClass,
    reason,
    include,
    issues
  };
}

function sanitizeFileLabel(fileLabel: string): string {
  const normalized = fileLabel.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "untitled.png";
  return normalized.slice(0, 255);
}

function basenameWithoutPngExtension(fileLabel: string): string {
  return fileLabel.replace(/\.png$/i, "");
}

function normalizeForMapping(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("und");
}

function errorIssue(code: string, message: string, details?: Readonly<Record<string, unknown>>): SvgaBatchPngIssue {
  return { severity: "error", code, message, details };
}

function warningIssue(code: string, message: string, details?: Readonly<Record<string, unknown>>): SvgaBatchPngIssue {
  return { severity: "warning", code, message, details };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
