import type {
  CancellationToken,
  MotionAssetInfo,
  MotionDimensions,
  MotionLayerInfo,
  MotionResourceInfo,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import {
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import { VAP_COMPATIBILITY_MAX_DIMENSION } from "./vap-inspection.js";

export const VAP_PLAYBACK_PREPARATION_WP3B_GATE = "0.2-wp3b-vap-playback-preparation" as const;
export const VAP_OFFICIAL_WEB_PACKAGE = "video-animation-player" as const;
export const VAP_OFFICIAL_WEB_VERSION = "1.0.5" as const;
export const VAP_OFFICIAL_WEB_ENTRYPOINT = "video-animation-player" as const;
export const VAP_OFFICIAL_WEB_SOURCE_COMMIT = "5d7c9f6789ccc5f384356001b71ef90c876cd95e" as const;

export type VapPlaybackPreparationIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface VapPlaybackPreparationIssue extends WorkbenchIssue {
  code: VapPlaybackPreparationIssueCode;
}

export type VapPlaybackPreparationStatus =
  | "dependency_pending"
  | "prepared"
  | "blocked"
  | "failed";

export interface VapPlaybackHostReadiness {
  webglAvailable?: boolean;
  h264Mp4DecodeAvailable?: boolean;
  localObjectUrlAvailable?: boolean;
  cspAllowsBlobMedia?: boolean;
  gpuCompositingAvailable?: boolean;
}

export interface VapPlaybackPreparationOptions {
  gate: string;
  dependencyApproval?: "pending" | "approved" | "rejected";
  hostReadiness?: VapPlaybackHostReadiness;
  providedFusionTags?: readonly string[];
  context?: WorkbenchOperationContext;
}

export interface VapPreparedRuntimeDecision {
  packageName: typeof VAP_OFFICIAL_WEB_PACKAGE;
  version: typeof VAP_OFFICIAL_WEB_VERSION;
  entryPoint: typeof VAP_OFFICIAL_WEB_ENTRYPOINT;
  sourceCommit: typeof VAP_OFFICIAL_WEB_SOURCE_COMMIT;
  approvalState: "pending" | "approved" | "rejected";
  dynamicImportOnly: true;
  networkAllowed: false;
  supportClaim: false;
}

export interface VapPreparedContainerFacts {
  displayDimensions?: MotionDimensions;
  videoDimensions?: MotionDimensions;
  frameCount?: number;
  fps?: number;
  durationMs?: number;
  videoCodec?: string;
  audioPresent: boolean;
  videoPresent: boolean;
  boundedSampleTruncated?: boolean;
  overCompatibilityLimit: boolean;
}

export interface VapPreparedFusionElement {
  id: string;
  resourceId: string;
  layerId?: string;
  kind: "image" | "text" | "unknown";
  srcId?: string;
  srcTag?: string;
  runtimeBindingKey?: string;
  replaceable: boolean;
  replacementProvided: boolean;
  replacementRequired: boolean;
  dimensions?: MotionDimensions;
  fitType?: unknown;
  color?: unknown;
  style?: unknown;
  placementCount: number;
  zValues: readonly number[];
  placementSamples: readonly unknown[];
}

export interface VapPlaybackLifecycleContract {
  loadSteps: readonly string[];
  disposalSteps: readonly string[];
  cancellationBoundaries: readonly string[];
  staleWorkPolicy: "generation_bound_before_object_url_runtime_and_container_mutation";
}

export interface VapPreparedPlaybackModel {
  source: "hidden-0.2-vap-playback-preparation";
  status: VapPlaybackPreparationStatus;
  format: "vap";
  displayName: string;
  pathRedacted: true;
  rendererHasFullPath: false;
  runtime: VapPreparedRuntimeDecision;
  host: VapPlaybackHostReadiness;
  container: VapPreparedContainerFacts;
  fusionElements: readonly VapPreparedFusionElement[];
  lifecycle: VapPlaybackLifecycleContract;
  issues: readonly VapPlaybackPreparationIssue[];
}

interface SourceFeedback {
  sourceName: string;
  issuePath?: string;
  sensitivePaths: readonly string[];
}

interface VapMetadata {
  displayDimensions?: MotionDimensions;
  videoDimensions?: MotionDimensions;
  frameCount?: number;
  fps?: number;
  durationMs?: number;
  container?: Record<string, unknown>;
}

export class VapPlaybackPreparationService {
  prepare(
    asset: MotionAssetInfo,
    options: VapPlaybackPreparationOptions
  ): WorkbenchResult<VapPreparedPlaybackModel> {
    const feedback = sourceFeedback(asset);
    options.context?.cancellation?.throwIfCancelled();
    if (options.gate !== VAP_PLAYBACK_PREPARATION_WP3B_GATE) {
      return {
        issues: [issue(
          feedback,
          "unsupported",
          "VAP playback preparation is unavailable outside the authorized hidden 0.2-WP3B gate.",
          "error",
          { reason: "gate_required" }
        )]
      };
    }

    if (asset.format !== "vap") {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "VAP playback preparation requires a VAP inspection asset.",
          "error",
          { reason: "vap_asset_required", format: asset.format }
        )]
      };
    }

    const vap = readVapMetadata(asset);
    if (!vap) {
      return {
        issues: [issue(
          feedback,
          "parse_precondition",
          "VAP playback preparation requires normalized VAP inspection metadata.",
          "error",
          { reason: "vap_metadata_required" }
        )]
      };
    }

    const hostReadiness = options.hostReadiness ?? {};
    const providedTags = new Set((options.providedFusionTags ?? []).map((tag) => tag.trim()).filter(Boolean));
    const fusion = mapFusionElements(asset.resources, asset.layers, providedTags, feedback);
    options.context?.cancellation?.throwIfCancelled();

    const runtime = runtimeDecision(options.dependencyApproval ?? "pending");
    const container = containerFacts(asset, vap);
    const issues = [
      ...runtimeIssues(runtime, feedback),
      ...hostReadinessIssues(hostReadiness, feedback),
      ...containerIssues(container, feedback),
      ...fusion.issues
    ];
    const status = statusFromIssues(runtime, issues);
    const model: VapPreparedPlaybackModel = {
      source: "hidden-0.2-vap-playback-preparation",
      status,
      format: "vap",
      displayName: feedback.sourceName,
      pathRedacted: true,
      rendererHasFullPath: false,
      runtime,
      host: { ...hostReadiness },
      container,
      fusionElements: fusion.elements,
      lifecycle: lifecycleContract(),
      issues
    };

    return { value: model, issues };
  }
}

function runtimeDecision(approvalState: "pending" | "approved" | "rejected"): VapPreparedRuntimeDecision {
  return {
    packageName: VAP_OFFICIAL_WEB_PACKAGE,
    version: VAP_OFFICIAL_WEB_VERSION,
    entryPoint: VAP_OFFICIAL_WEB_ENTRYPOINT,
    sourceCommit: VAP_OFFICIAL_WEB_SOURCE_COMMIT,
    approvalState,
    dynamicImportOnly: true,
    networkAllowed: false,
    supportClaim: false
  };
}

function runtimeIssues(
  runtime: VapPreparedRuntimeDecision,
  feedback: SourceFeedback
): VapPlaybackPreparationIssue[] {
  if (runtime.approvalState === "approved") return [];
  return [issue(
    feedback,
    "missing_dependency",
    runtime.approvalState === "rejected"
      ? "The VAP playback runtime dependency has not been approved for adoption."
      : "The VAP playback runtime dependency is pending Product Owner approval.",
    "error",
    {
      reason: runtime.approvalState === "rejected" ? "runtime_dependency_rejected" : "runtime_dependency_pending",
      dependency: `${runtime.packageName}@${runtime.version}`,
      entryPoint: runtime.entryPoint
    }
  )];
}

function hostReadinessIssues(
  host: VapPlaybackHostReadiness,
  feedback: SourceFeedback
): VapPlaybackPreparationIssue[] {
  const issues: VapPlaybackPreparationIssue[] = [];
  for (const [key, reason] of [
    ["webglAvailable", "webgl_required"],
    ["h264Mp4DecodeAvailable", "h264_mp4_decode_required"],
    ["localObjectUrlAvailable", "local_object_url_required"],
    ["cspAllowsBlobMedia", "blob_media_csp_required"],
    ["gpuCompositingAvailable", "gpu_compositing_required"]
  ] as const) {
    if (host[key] === false) {
      issues.push(issue(
        feedback,
        "capability",
        "VAP playback preparation requires a host runtime capability that is unavailable.",
        "error",
        { reason, capability: key }
      ));
    }
  }
  return issues;
}

function containerFacts(asset: MotionAssetInfo, vap: VapMetadata): VapPreparedContainerFacts {
  const container = vap.container ?? {};
  const videoDimensions = vap.videoDimensions;
  const displayDimensions = vap.displayDimensions ?? asset.dimensions;
  return {
    displayDimensions,
    videoDimensions,
    frameCount: vap.frameCount ?? asset.timing.frameCount,
    fps: vap.fps ?? asset.timing.fps,
    durationMs: vap.durationMs ?? asset.timing.durationMs,
    videoCodec: stringValue(container.videoCodec),
    audioPresent: container.audioPresent === true,
    videoPresent: container.videoPresent === true,
    boundedSampleTruncated: container.boundedSampleTruncated === true,
    overCompatibilityLimit: [displayDimensions, videoDimensions].some((dimensions) =>
      !!dimensions && (dimensions.width > VAP_COMPATIBILITY_MAX_DIMENSION || dimensions.height > VAP_COMPATIBILITY_MAX_DIMENSION)
    )
  };
}

function containerIssues(
  container: VapPreparedContainerFacts,
  feedback: SourceFeedback
): VapPlaybackPreparationIssue[] {
  const issues: VapPlaybackPreparationIssue[] = [];
  if (!container.videoPresent) {
    issues.push(issue(
      feedback,
      "parse_precondition",
      "VAP playback preparation requires video track evidence.",
      "error",
      { reason: "video_track_required" }
    ));
  }
  if (container.videoCodec && !["avc1", "avc3"].includes(container.videoCodec)) {
    issues.push(issue(
      feedback,
      "unsupported_feature",
      "The prepared VAP playback path is limited to H.264 MP4 video.",
      "error",
      { reason: "unsupported_video_codec", codec: container.videoCodec }
    ));
  }
  if (container.overCompatibilityLimit) {
    issues.push(issue(
      feedback,
      "capability",
      "VAP dimensions exceed the documented 1504 compatibility limit for the first playback path.",
      "error",
      { reason: "vap_dimensions_over_1504", limit: VAP_COMPATIBILITY_MAX_DIMENSION }
    ));
  }
  return issues;
}

function mapFusionElements(
  resources: readonly MotionResourceInfo[],
  layers: readonly MotionLayerInfo[],
  providedTags: Set<string>,
  feedback: SourceFeedback
): { elements: VapPreparedFusionElement[]; issues: VapPlaybackPreparationIssue[] } {
  const issues: VapPlaybackPreparationIssue[] = [];
  const elements: VapPreparedFusionElement[] = [];
  const layersByResourceId = new Map<string, MotionLayerInfo>();
  for (const layer of layers) {
    for (const resourceId of layer.resourceIds) {
      if (!layersByResourceId.has(resourceId)) layersByResourceId.set(resourceId, layer);
    }
  }
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  for (const layer of layers) {
    for (const resourceId of layer.resourceIds) {
      if (!resourcesById.has(resourceId)) {
        issues.push(issue(
          feedback,
          "missing_resource",
          "A VAP fusion layer references a missing resource.",
          "error",
          { reason: "fusion_layer_resource_missing", layerId: layer.id, resourceId }
        ));
      }
    }
  }

  const seenTags = new Map<string, string>();
  for (const resource of resources) {
    if (resource.metadata?.vapResourceType !== "fusion_source") continue;
    const layer = layersByResourceId.get(resource.id);
    const srcId = stringValue(resource.metadata.srcId);
    const srcTag = stringValue(resource.metadata.srcTag);
    const kind = fusionElementKind(resource, layer);
    const replacementProvided = srcTag ? providedTags.has(srcTag) || resource.metadata.replacementProvided === true : false;
    const replaceable = resource.replaceable === true && layer?.replaceable === true && kind !== "unknown";
    const placements = Array.isArray(layer?.metadata?.placements) ? layer.metadata.placements : [];
    const zValues = Array.isArray(layer?.metadata?.zValues)
      ? layer.metadata.zValues.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];

    if (!layer) {
      issues.push(issue(
        feedback,
        "missing_resource",
        "A VAP fusion resource has no normalized layer reference.",
        "error",
        { reason: "fusion_resource_layer_missing", resourceId: resource.id, srcId, srcTag }
      ));
    }
    if (kind === "unknown") {
      issues.push(issue(
        feedback,
        "unsupported_feature",
        "VAP fusion source type is not ready for playback preparation.",
        "error",
        { reason: "unknown_fusion_source_type", resourceId: resource.id, srcId, srcTag }
      ));
    }
    if (srcTag) {
      const previous = seenTags.get(srcTag);
      if (previous && previous !== resource.id) {
        issues.push(issue(
          feedback,
          "ambiguous",
          "VAP fusion source tags must be unique for deterministic runtime binding.",
          "error",
          { reason: "ambiguous_fusion_source_tag", srcTag, resourceIds: [previous, resource.id] }
        ));
      }
      seenTags.set(srcTag, resource.id);
    }
    if (replaceable && srcTag && !replacementProvided) {
      issues.push(issue(
        feedback,
        "missing_resource",
        "VAP fusion source tag has no runtime replacement value yet; base video preview can still load.",
        "warning",
        { reason: "fusion_replacement_required", srcId, srcTag, resourceId: resource.id }
      ));
    }

    elements.push({
      id: srcId || resource.id,
      resourceId: resource.id,
      layerId: layer?.id,
      kind,
      srcId: srcId || undefined,
      srcTag: srcTag || undefined,
      runtimeBindingKey: srcTag || srcId || resource.id,
      replaceable,
      replacementProvided,
      replacementRequired: replaceable && !!srcTag && !replacementProvided,
      dimensions: resource.dimensions,
      fitType: resource.metadata.fitType,
      color: resource.metadata.color,
      style: resource.metadata.style,
      placementCount: typeof layer?.metadata?.placementCount === "number" ? layer.metadata.placementCount : placements.length,
      zValues,
      placementSamples: placements.slice(0, 5)
    });
  }

  return { elements, issues };
}

function fusionElementKind(
  resource: MotionResourceInfo,
  layer: MotionLayerInfo | undefined
): VapPreparedFusionElement["kind"] {
  if (layer?.kind === "vap_fusion_image" || resource.kind === "image") return "image";
  if (layer?.kind === "vap_fusion_text") return "text";
  return "unknown";
}

function statusFromIssues(
  runtime: VapPreparedRuntimeDecision,
  issues: readonly VapPlaybackPreparationIssue[]
): VapPlaybackPreparationStatus {
  const errorIssues = issues.filter(({ severity }) => severity === "error");
  if (errorIssues.some(({ code }) => code === "parse_precondition" || code === "ambiguous")) return "failed";
  if (errorIssues.some(({ code, details }) =>
    code === "missing_resource"
    && (details?.reason === "fusion_layer_resource_missing" || details?.reason === "fusion_resource_layer_missing")
  )) {
    return "failed";
  }
  if (errorIssues.some(({ code }) => code !== "missing_dependency")) return "blocked";
  if (runtime.approvalState !== "approved") return "dependency_pending";
  return "prepared";
}

function lifecycleContract(): VapPlaybackLifecycleContract {
  return {
    loadSteps: [
      "inspect with bounded source reads",
      "create host-owned object URL for the local MP4 bytes",
      "pass extracted vapc JSON as config",
      "dynamically import the approved hidden runtime",
      "bind one playback instance to one target container"
    ],
    disposalSteps: [
      "pause active runtime",
      "destroy runtime instance",
      "remove event listeners",
      "clear target container",
      "revoke host object URL"
    ],
    cancellationBoundaries: [
      "before host range read",
      "after VAP inspection",
      "before object URL creation",
      "before dynamic runtime import",
      "immediately before runtime/container mutation"
    ],
    staleWorkPolicy: "generation_bound_before_object_url_runtime_and_container_mutation"
  };
}

function readVapMetadata(asset: MotionAssetInfo): VapMetadata | undefined {
  const metadata = asset.metadata?.vap;
  return isRecord(metadata) ? metadata as VapMetadata : undefined;
}

function issue(
  feedback: SourceFeedback,
  code: VapPlaybackPreparationIssueCode,
  message: string,
  severity: WorkbenchIssue["severity"],
  details: Readonly<Record<string, unknown>> = {}
): VapPlaybackPreparationIssue {
  return {
    severity,
    code,
    message,
    path: feedback.issuePath,
    details: redactLocalPathsInValue({
      sourceName: feedback.sourceName,
      ...details
    }, feedback.sensitivePaths)
  };
}

function sourceFeedback(asset: MotionAssetInfo): SourceFeedback {
  const sensitivePaths = [asset.name].filter((value) => isPathLike(value));
  const sourceName = safeSourceName(asset.name) || "effect.mp4";
  return {
    sourceName,
    issuePath: sensitivePaths.length > 0 ? "[local path]" : undefined,
    sensitivePaths
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createCancelledVapPreparationToken(): CancellationToken {
  return {
    cancelled: true,
    throwIfCancelled() {
      throw new Error("VAP playback preparation was cancelled.");
    }
  };
}
