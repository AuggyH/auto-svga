import type {
  MotionAssetInfo,
  MotionAssetSource,
  MotionDimensions,
  MotionLayerInfo,
  MotionResourceInfo,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import { MOTION_FORMAT_PROBE_MAX_BYTES } from "./motion-format-registry.js";

export const LOTTIE_JSON_INSPECTION_WP2A_GATE = "0.2-multiformat-preview-wp2a" as const;

export type LottieJsonInspectionIssueCode =
  | "unsupported"
  | "parse_precondition"
  | "asset_reference_precondition"
  | "unsupported_feature";

export interface LottieJsonInspectionIssue extends WorkbenchIssue {
  code: LottieJsonInspectionIssueCode;
}

export interface LottieJsonInspectionSource extends MotionAssetSource {
  readRange?(offset: number, length: number): Promise<Uint8Array>;
}

export interface LottieJsonInspectionOptions {
  gate: string;
  context?: WorkbenchOperationContext;
}

interface SourceFeedback {
  sourceName: string;
  issuePath?: string;
  sensitivePaths: readonly string[];
}

interface BoundedSample {
  bytes?: Uint8Array;
  truncated: boolean;
  issueReason?: "bounded_read_required" | "read_failed";
  issueCause?: string;
}

interface LottieDocument {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  layers: readonly LottieLayer[];
  assets?: readonly LottieAsset[];
  fonts?: { list?: readonly LottieFont[] };
}

interface LottieAsset {
  id?: unknown;
  w?: unknown;
  h?: unknown;
  u?: unknown;
  p?: unknown;
  e?: unknown;
  layers?: readonly LottieLayer[];
}

interface LottieFont {
  fName?: unknown;
  fFamily?: unknown;
  fStyle?: unknown;
}

interface LottieLayer {
  ind?: unknown;
  ty?: unknown;
  nm?: unknown;
  refId?: unknown;
  hd?: unknown;
  ddd?: unknown;
  hasMask?: unknown;
  masksProperties?: unknown;
  ef?: unknown;
  tm?: unknown;
  xp?: unknown;
  t?: unknown;
}

interface NormalizedAssets {
  resources: MotionResourceInfo[];
  assetIds: Set<string>;
  imageAssetCount: number;
  precompAssetCount: number;
}

interface UnsupportedFeature {
  feature: string;
  path: string;
}

interface InternalResult<T> {
  value?: T;
  issues: LottieJsonInspectionIssue[];
}

export class LottieJsonInspectionService {
  async inspect(
    source: LottieJsonInspectionSource,
    options: LottieJsonInspectionOptions
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    const feedback = sourceFeedback(source);
    if (options.gate !== LOTTIE_JSON_INSPECTION_WP2A_GATE) {
      return {
        issues: [issue(
          feedback,
          "unsupported",
          "Lottie JSON inspection is unavailable outside the authorized 0.2-WP2A gate.",
          { reason: "gate_required" }
        )]
      };
    }

    options.context?.cancellation?.throwIfCancelled();
    const sample = await readBoundedSample(source, feedback, options.context);
    options.context?.cancellation?.throwIfCancelled();
    if (!sample.bytes) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          `A bounded Lottie JSON sample could not inspect ${feedback.sourceName}.`,
          sampleIssueDetails(sample)
        )]
      };
    }
    if (sample.truncated) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "Complete bounded JSON is required for Lottie inspection.",
          { reason: "complete_bounded_json_required" }
        )]
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeUtf8(sample.bytes));
    } catch (error) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "Lottie JSON must be valid JSON.",
          {
            reason: "valid_json_required",
            cause: redactLocalPathsFromError(error, "JSON parse failed.", feedback.sensitivePaths)
          }
        )]
      };
    }

    if (!isLottieDocument(parsed)) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "Lottie JSON is missing required version, timing, dimension, or layer fields.",
          { reason: "lottie_json_shape_required" }
        )]
      };
    }

    const assetResult = normalizeAssets(parsed.assets ?? [], feedback);
    const assetErrors = assetResult.issues.filter(({ severity }) => severity === "error");
    if (assetErrors.length > 0) {
      return { issues: assetResult.issues };
    }

    const unsupportedFeatures = collectUnsupportedFeatures(parsed);
    const unsupportedIssues = unsupportedFeatures.map((feature) =>
      issue(
        feedback,
        "unsupported_feature",
        `Lottie feature "${feature.feature}" is not supported by WP2A inspection.`,
        { feature: feature.feature, path: feature.path }
      )
    );
    const fontResources = normalizeFonts(parsed.fonts);
    const normalizedAssets = assetResult.value;
    if (!normalizedAssets) {
      return { issues: assetResult.issues };
    }
    const layers = normalizeLayers(parsed.layers, normalizedAssets.assetIds, feedback);
    const layerErrors = layers.issues.filter(({ severity }) => severity === "error");
    if (layerErrors.length > 0) {
      return { issues: [...assetResult.issues, ...layers.issues, ...unsupportedIssues] };
    }
    const normalizedLayers = layers.value ?? [];

    const durationFrames = parsed.op - parsed.ip;
    const asset: MotionAssetInfo = {
      format: "lottie",
      name: safeSourceName(source.name) || safeSourceName(source.id) || "lottie.json",
      sizeBytes: source.sizeBytes,
      dimensions: { width: parsed.w, height: parsed.h },
      timing: {
        fps: parsed.fr,
        frameCount: durationFrames,
        durationMs: Math.round((durationFrames / parsed.fr) * 1000)
      },
      layers: normalizedLayers,
      resources: [...normalizedAssets.resources, ...fontResources],
      metadata: {
        lottie: {
          version: parsed.v,
          frameRate: parsed.fr,
          inPoint: parsed.ip,
          outPoint: parsed.op,
          durationFrames,
          layerCount: parsed.layers.length,
          assetCount: (parsed.assets ?? []).length,
          imageAssetCount: normalizedAssets.imageAssetCount,
          precompAssetCount: normalizedAssets.precompAssetCount,
          textCandidateCount: normalizedLayers.filter(({ kind }) => kind === "text").length,
          fontCount: fontResources.length,
          unsupportedFeatures
        }
      }
    };

    return {
      value: asset,
      issues: [...assetResult.issues, ...layers.issues, ...unsupportedIssues]
    };
  }
}

async function readBoundedSample(
  source: LottieJsonInspectionSource,
  feedback: SourceFeedback,
  context?: WorkbenchOperationContext
): Promise<BoundedSample> {
  try {
    context?.onProgress?.({ phase: "lottie_json_read", completed: 0, total: 1 });
    if (!Number.isFinite(source.sizeBytes) || source.sizeBytes < 0) {
      return { truncated: true, issueReason: "bounded_read_required" };
    }
    const bytes = source.readRange
      ? await source.readRange(0, MOTION_FORMAT_PROBE_MAX_BYTES)
      : source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
        ? undefined
        : await source.read();
    if (!bytes) {
      return { truncated: true, issueReason: "bounded_read_required" };
    }
    context?.onProgress?.({ phase: "lottie_json_read", completed: 1, total: 1 });
    return {
      bytes: bytes.slice(0, MOTION_FORMAT_PROBE_MAX_BYTES),
      truncated: source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
        || bytes.byteLength > MOTION_FORMAT_PROBE_MAX_BYTES
    };
  } catch (error) {
    return {
      truncated: false,
      issueReason: "read_failed",
      issueCause: redactLocalPathsFromError(error, "The source could not be read.", feedback.sensitivePaths)
    };
  }
}

function normalizeAssets(
  assets: readonly LottieAsset[],
  feedback: SourceFeedback
): InternalResult<NormalizedAssets> {
  const resources: MotionResourceInfo[] = [];
  const issues: LottieJsonInspectionIssue[] = [];
  const assetIds = new Set<string>();
  let imageAssetCount = 0;
  let precompAssetCount = 0;

  assets.forEach((asset, index) => {
    const id = typeof asset.id === "string" && asset.id.trim() ? asset.id.trim() : `asset_${index}`;
    if (assetIds.has(id)) {
      issues.push(issue(
        feedback,
        "asset_reference_precondition",
        "Lottie asset ids must be unique for deterministic inspection.",
        { reason: "ambiguous_asset_id", assetId: id, path: `assets.${index}.id` }
      ));
      return;
    }
    assetIds.add(id);

    if (Array.isArray(asset.layers)) {
      precompAssetCount += 1;
      resources.push({
        id,
        name: id,
        kind: "vector",
        metadata: {
          lottieAssetType: "precomp",
          layerCount: asset.layers.length
        }
      });
      return;
    }

    if (asset.p !== undefined || asset.u !== undefined || asset.e === 1) {
      imageAssetCount += 1;
      if (asset.e === 1) {
        issues.push(issue(
          feedback,
          "unsupported_feature",
          "Embedded Lottie image payloads are metadata-only and not supported in WP2A.",
          { feature: "embedded_image_asset", path: `assets.${index}.e` }
        ));
        resources.push({
          id,
          name: id,
          kind: "image",
          dimensions: dimensionsFrom(asset),
          replaceable: false,
          metadata: {
            lottieAssetType: "image",
            embedded: true,
            unsupported: true
          }
        });
        return;
      }
      const reference = normalizeImageReference(asset, index, feedback);
      issues.push(...reference.issues);
      if (reference.value) {
        resources.push({
          id,
          name: reference.value.basename,
          kind: "image",
          dimensions: dimensionsFrom(asset),
          replaceable: true,
          metadata: {
            lottieAssetType: "image",
            referencePath: reference.value.path,
            embedded: false
          }
        });
      }
    }
  });

  return {
    value: { resources, assetIds, imageAssetCount, precompAssetCount },
    issues
  };
}

function normalizeImageReference(
  asset: LottieAsset,
  index: number,
  feedback: SourceFeedback
): InternalResult<{ path: string; basename: string }> {
  const rawPath = typeof asset.p === "string" ? asset.p.trim() : "";
  const rawDirectory = typeof asset.u === "string" ? asset.u.trim() : "";
  if (!rawPath) {
    return {
      issues: [issue(
        feedback,
        "asset_reference_precondition",
        "Lottie image assets require a deterministic relative path.",
        { reason: "missing_image_reference", path: `assets.${index}.p` }
      )]
    };
  }
  const candidate = rawDirectory ? `${rawDirectory.replace(/[\\/]+$/u, "")}/${rawPath}` : rawPath;
  if (!isDeterministicRelativePath(candidate)) {
    return {
      issues: [issue(
        feedback,
        "asset_reference_precondition",
        "Lottie image asset references must be deterministic relative paths.",
        { reason: "unsafe_image_reference", path: `assets.${index}.p`, reference: candidate }
      )]
    };
  }
  const normalized = normalizeRelativePath(candidate);
  return {
    value: {
      path: normalized,
      basename: normalized.split("/").at(-1) ?? normalized
    },
    issues: []
  };
}

function normalizeFonts(fonts: LottieDocument["fonts"]): MotionResourceInfo[] {
  const list = Array.isArray(fonts?.list) ? fonts.list : [];
  const seen = new Set<string>();
  const resources: MotionResourceInfo[] = [];
  list.forEach((font, index) => {
    const family = stringValue(font.fFamily) || stringValue(font.fName) || `font_${index}`;
    const id = stringValue(font.fName) || family;
    if (seen.has(id)) return;
    seen.add(id);
    resources.push({
      id,
      name: family,
      kind: "font",
      metadata: {
        lottieFontName: stringValue(font.fName),
        family,
        style: stringValue(font.fStyle)
      }
    });
  });
  return resources;
}

function normalizeLayers(
  layers: readonly LottieLayer[],
  assetIds: Set<string>,
  feedback: SourceFeedback
): InternalResult<readonly MotionLayerInfo[]> {
  const issues: LottieJsonInspectionIssue[] = [];
  const normalized = layers.map((layer, index) => {
    const id = stringValue(layer.ind) || `layer_${index}`;
    const refId = stringValue(layer.refId);
    const kind = layerKind(layer);
    if ((kind === "image" || kind === "precomp") && !refId) {
      issues.push(issue(
        feedback,
        "asset_reference_precondition",
        "Lottie image and precomp layers require a deterministic asset reference.",
        { reason: "missing_layer_refId", path: `layers.${index}.refId` }
      ));
    } else if (refId && !assetIds.has(refId)) {
      issues.push(issue(
        feedback,
        "asset_reference_precondition",
        "Lottie layer references an asset id that is not present.",
        { reason: "missing_layer_asset", refId, path: `layers.${index}.refId` }
      ));
    }

    return {
      id,
      name: stringValue(layer.nm) || id,
      kind,
      resourceIds: refId ? [refId] : [],
      visible: layer.hd === true ? false : undefined,
      replaceable: kind === "image" || kind === "text",
      metadata: {
        lottieLayerIndex: index,
        lottieType: layer.ty,
        ...(kind === "text" ? { text: textDocumentValue(layer) } : {})
      }
    };
  });

  return { value: normalized, issues };
}

function collectUnsupportedFeatures(document: LottieDocument): UnsupportedFeature[] {
  const features: UnsupportedFeature[] = [];
  collectLayerUnsupportedFeatures(document.layers, "layers", features);
  (document.assets ?? []).forEach((asset, index) => {
    if (Array.isArray(asset.layers)) {
      collectLayerUnsupportedFeatures(asset.layers, `assets.${index}.layers`, features);
    }
  });
  return features;
}

function collectLayerUnsupportedFeatures(
  layers: readonly LottieLayer[],
  pathPrefix: string,
  features: UnsupportedFeature[]
): void {
  layers.forEach((layer, index) => {
    const path = `${pathPrefix}.${index}`;
    if (layer.ddd === 1) features.push({ feature: "3d_layer", path: `${path}.ddd` });
    if (layer.hasMask === true || Array.isArray(layer.masksProperties)) {
      features.push({ feature: "mask", path: `${path}.masksProperties` });
    }
    if (Array.isArray(layer.ef) && layer.ef.length > 0) {
      features.push({ feature: "effect", path: `${path}.ef` });
    }
    if (layer.tm !== undefined) features.push({ feature: "time_remap", path: `${path}.tm` });
    if (layer.xp !== undefined) features.push({ feature: "expression", path: `${path}.xp` });
    if (layer.ty === 1) features.push({ feature: "solid_layer", path: `${path}.ty` });
    if (layer.ty === 13) features.push({ feature: "camera_layer", path: `${path}.ty` });
  });
}

function isLottieDocument(value: unknown): value is LottieDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.v === "string" && record.v.trim().length > 0
    && positiveNumber(record.fr)
    && finiteNumber(record.ip)
    && finiteNumber(record.op) && record.op > record.ip
    && positiveNumber(record.w)
    && positiveNumber(record.h)
    && Array.isArray(record.layers);
}

function layerKind(layer: LottieLayer): string {
  switch (layer.ty) {
    case 0: return "precomp";
    case 2: return "image";
    case 3: return "null";
    case 4: return "shape";
    case 5: return "text";
    default: return "unknown";
  }
}

function dimensionsFrom(asset: LottieAsset): MotionDimensions | undefined {
  return positiveNumber(asset.w) && positiveNumber(asset.h)
    ? { width: asset.w, height: asset.h }
    : undefined;
}

function textDocumentValue(layer: LottieLayer): string | undefined {
  const text = (layer.t as { d?: { k?: unknown } } | undefined)?.d?.k;
  if (Array.isArray(text)) {
    for (const item of text) {
      const value = (item as { s?: { t?: unknown } } | undefined)?.s?.t;
      if (typeof value === "string") return value;
    }
  }
  return undefined;
}

function issue(
  feedback: SourceFeedback,
  code: LottieJsonInspectionIssueCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): LottieJsonInspectionIssue {
  return {
    severity: code === "unsupported_feature" ? "warning" : "error",
    code,
    message,
    path: feedback.issuePath,
    details: redactLocalPathsInValue({
      sourceName: feedback.sourceName,
      ...details
    }, feedback.sensitivePaths)
  };
}

function sampleIssueDetails(sample: BoundedSample): Readonly<Record<string, unknown>> {
  return {
    reason: sample.issueReason,
    ...(sample.issueCause ? { cause: sample.issueCause } : {})
  };
}

function sourceFeedback(source: MotionAssetSource): SourceFeedback {
  const sensitivePaths = [source.id, source.name].filter((value) => isPathLike(value));
  const sourceName = safeSourceName(source.name) || safeSourceName(source.id) || "lottie.json";
  return {
    sourceName,
    issuePath: sensitivePaths.length > 0 ? "[local path]" : undefined,
    sensitivePaths
  };
}

function isDeterministicRelativePath(value: string): boolean {
  if (!value || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) || /^[\\/]/u.test(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    return false;
  }
  const parts = value.split(/[\\/]+/u);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function normalizeRelativePath(value: string): string {
  return value.split(/[\\/]+/u).join("/");
}

function safeSourceName(value: string): string {
  const parts = value.trim().split(/[\\/]+/u).filter(Boolean);
  return (parts.at(-1) ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isPathLike(value: string): boolean {
  return /[\\/]/u.test(value) || /^[A-Za-z]:/u.test(value);
}

function stringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
