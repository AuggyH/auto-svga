import type {
  MotionAssetInfo,
  MotionAssetSource,
  MotionLayerInfo,
  MotionResourceInfo,
  PlaybackSession,
  PlaybackState,
  WorkbenchIssue,
  WorkbenchResult
} from "./contracts.js";
import {
  LOTTIE_JSON_INSPECTION_WP2A_GATE,
  LottieJsonInspectionService,
  type LottieJsonInspectionSource
} from "./lottie-json-inspection.js";
import {
  LOTTIE_SVG_PLAYBACK_WP2B_GATE,
  LottieSvgPlaybackAdapter,
  type LottieSvgPlaybackTarget,
  type LottieSvgRendererLoader
} from "./lottie-svg-playback-adapter.js";
import {
  MOTION_FORMAT_PROBE_MAX_BYTES,
  MULTIFORMAT_PREVIEW_WP1_GATE,
  MotionFormatProbeService,
  createMultiFormatPreviewWp1Registry,
  type MotionFormatDetectionResult,
  type MotionFormatProbeSource
} from "./motion-format-registry.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";

export const HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE = "0.2-hidden-lottie-preview-vertical" as const;
export const HIDDEN_LOTTIE_PREVIEW_SCHEMA_VERSION = 1 as const;
export const LOTTIE_ADJACENT_RESOURCE_MAX_BYTES = 1_048_576;

export type HiddenLottiePreviewOpenSource = "fileButton" | "dragDrop" | "menuOpen";
export type HiddenLottiePreviewStatus =
  | "idle"
  | "loading"
  | "inspectionReady"
  | "ready"
  | "playing"
  | "paused"
  | "playbackBlocked"
  | "playbackFailed"
  | "failed"
  | "disposed";

export type HiddenLottiePreviewIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface HiddenLottiePreviewIssue extends WorkbenchIssue {
  code: HiddenLottiePreviewIssueCode;
}

export interface HiddenLottiePreviewHostFileStat {
  sizeBytes: number;
  displayName?: string;
  mediaType?: string;
}

export interface HiddenLottiePreviewHostResourceRead {
  bytes: Uint8Array;
  sizeBytes?: number;
  mediaType?: string;
}

export interface HiddenLottiePreviewHost {
  statLocalFile(localPath: string): Promise<HiddenLottiePreviewHostFileStat>;
  readLocalFileRange(localPath: string, offset: number, length: number): Promise<Uint8Array>;
  readAdjacentResource(input: {
    sourceLocalPath: string;
    relativePath: string;
    maxBytes: number;
  }): Promise<HiddenLottiePreviewHostResourceRead>;
}

export interface HiddenLottiePreviewOpenInput {
  gate: string;
  requestId: string;
  source: HiddenLottiePreviewOpenSource;
  localPath: string;
  displayName?: string;
}

export interface HiddenLottiePreviewOverview {
  format: "lottie";
  displayName: string;
  version?: string;
  dimensions?: string;
  fps?: number;
  durationMs?: number;
  layerCount: number;
  assetCount: number;
  imageAssetCount: number;
  textCandidateCount: number;
  unsupportedFeatureCount: number;
}

export interface HiddenLottiePreviewLayerRow {
  id: string;
  name: string;
  kind: string;
  resourceIds: readonly string[];
  visible?: boolean;
  replaceable: boolean;
}

export interface HiddenLottiePreviewAssetRow {
  id: string;
  name: string;
  kind: MotionResourceInfo["kind"];
  dimensions: string;
  replaceable: boolean;
  referencePath?: string;
  resolutionStatus: "not_required" | "resolved" | "missing" | "unsupported";
  sizeBytes?: number;
  mediaType?: string;
  pathRedacted: true;
}

export interface HiddenLottiePreviewTextCandidate {
  id: string;
  layerId: string;
  name: string;
  initialText?: string;
  replaceable: boolean;
}

export interface HiddenLottiePreviewReplaceableModel {
  images: readonly HiddenLottiePreviewAssetRow[];
  texts: readonly HiddenLottiePreviewTextCandidate[];
}

export interface HiddenLottiePreviewUnsupportedMarker {
  feature: string;
  path: string;
}

export interface HiddenLottiePreviewModel {
  schemaVersion: typeof HIDDEN_LOTTIE_PREVIEW_SCHEMA_VERSION;
  source: "hidden-0.2-lottie-preview-vertical";
  status: HiddenLottiePreviewStatus;
  requestId?: string;
  openedFrom?: HiddenLottiePreviewOpenSource;
  displayName?: string;
  pathRedacted: true;
  rendererHasFullPath: false;
  overview?: HiddenLottiePreviewOverview;
  layers: readonly HiddenLottiePreviewLayerRow[];
  assets: readonly HiddenLottiePreviewAssetRow[];
  replaceable: HiddenLottiePreviewReplaceableModel;
  unsupportedFeatures: readonly HiddenLottiePreviewUnsupportedMarker[];
  issues: readonly HiddenLottiePreviewIssue[];
  playback: PlaybackState;
}

interface PreparedPlayback {
  source: MotionAssetSource;
  inspection: WorkbenchResult<MotionAssetInfo>;
  allowResolvedImageResources: boolean;
}

interface ImageResolution {
  rows: HiddenLottiePreviewAssetRow[];
  dataUris: Map<string, string>;
  issues: HiddenLottiePreviewIssue[];
}

interface HiddenLottieResult<T> {
  value?: T;
  issues: readonly HiddenLottiePreviewIssue[];
}

export interface CreateHiddenLottiePreviewVerticalSessionOptions {
  host: HiddenLottiePreviewHost;
  target: LottieSvgPlaybackTarget;
  rendererLoader?: LottieSvgRendererLoader;
}

export function createHiddenLottiePreviewVerticalSession(
  options: CreateHiddenLottiePreviewVerticalSessionOptions
): HiddenLottiePreviewVerticalSession {
  return new HiddenLottiePreviewVerticalSession(options);
}

export class HiddenLottiePreviewVerticalSession {
  private readonly host: HiddenLottiePreviewHost;
  private readonly target: LottieSvgPlaybackTarget;
  private readonly rendererLoader: LottieSvgRendererLoader | undefined;
  private readonly probeService = new MotionFormatProbeService(createMultiFormatPreviewWp1Registry());
  private readonly inspectionService = new LottieJsonInspectionService();
  private playbackSession?: PlaybackSession;
  private prepared?: PreparedPlayback;
  private model: HiddenLottiePreviewModel = idleModel();

  constructor(options: CreateHiddenLottiePreviewVerticalSessionOptions) {
    this.host = options.host;
    this.target = options.target;
    this.rendererLoader = options.rendererLoader;
  }

  getModel(): HiddenLottiePreviewModel {
    return cloneModel(this.model);
  }

  async openLocalCandidate(input: HiddenLottiePreviewOpenInput): Promise<HiddenLottiePreviewModel> {
    this.disposePlaybackSession();
    this.prepared = undefined;

    const validationIssue = validateOpenInput(input);
    if (validationIssue) {
      this.model = failedModel([validationIssue]);
      return this.getModel();
    }

    const displayName = safeSourceName(input.displayName ?? input.localPath) || "lottie.json";
    this.model = {
      ...idleModel(),
      status: "loading",
      requestId: input.requestId,
      openedFrom: input.source,
      displayName,
      playback: playbackState("loading")
    };

    const sourceResult = await this.createBoundedSource(input.localPath, displayName);
    if (!sourceResult.value) {
      this.model = {
        ...this.model,
        status: "failed",
        issues: sourceResult.issues,
        playback: playbackState("error")
      };
      return this.getModel();
    }
    const source = sourceResult.value;

    const detection = await this.probeService.probe(source, {
      gate: MULTIFORMAT_PREVIEW_WP1_GATE
    });
    if (detection.status !== "detected" || detection.format !== "lottie") {
      this.model = {
        ...this.model,
        status: detection.status === "ambiguous" ? "failed" : "playbackBlocked",
        issues: detectionIssues(detection, source),
        playback: playbackState("error")
      };
      return this.getModel();
    }

    const inspection = await this.inspectionService.inspect(source, {
      gate: LOTTIE_JSON_INSPECTION_WP2A_GATE
    });
    if (!inspection.value) {
      this.model = {
        ...this.model,
        status: "failed",
        issues: mapIssues(inspection.issues, source, "parse_precondition"),
        playback: playbackState("error")
      };
      return this.getModel();
    }

    const surface = surfaceFromAsset(inspection.value, inspection.issues, displayName);
    this.model = {
      ...this.model,
      ...surface,
      status: "inspectionReady",
      issues: [...surface.issues],
      playback: playbackState("idle", inspection.value.timing.durationMs)
    };

    const blockingIssues = playbackBlockingIssues(inspection.value, inspection.issues, source);
    if (blockingIssues.length > 0) {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        issues: [...this.model.issues, ...blockingIssues],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    const imageResolution = await resolveImageResources(this.host, source, inspection.value);
    const assetRows = mergeResolvedAssetRows(this.model.assets, imageResolution.rows);
    if (imageResolution.issues.length > 0) {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        assets: assetRows,
        replaceable: {
          ...this.model.replaceable,
          images: assetRows.filter(({ kind, replaceable }) => kind === "image" && replaceable)
        },
        issues: [...this.model.issues, ...imageResolution.issues],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    const animationData = await inlineResolvedImageData(source, imageResolution.dataUris);
    if (!animationData.value) {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        assets: assetRows,
        issues: [...this.model.issues, ...animationData.issues],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    this.model = {
      ...this.model,
      assets: assetRows,
      replaceable: {
        ...this.model.replaceable,
        images: assetRows.filter(({ kind, replaceable }) => kind === "image" && replaceable)
      }
    };
    this.prepared = {
      source: animationData.value,
      inspection,
      allowResolvedImageResources: imageResolution.dataUris.size > 0
    };
    await this.loadPreparedPlayback();
    return this.getModel();
  }

  async play(): Promise<HiddenLottiePreviewModel> {
    if (!this.playbackSession) return this.playbackOperationFailed("play", "playback_session_missing");
    try {
      await this.playbackSession.play();
      this.model = { ...this.model, status: "playing", playback: this.playbackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "play", "playback_play_failed");
    }
    return this.getModel();
  }

  pause(): HiddenLottiePreviewModel {
    if (!this.playbackSession) return this.playbackOperationFailed("pause", "playback_session_missing");
    try {
      this.playbackSession.pause();
      this.model = { ...this.model, status: "paused", playback: this.playbackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "pause", "playback_pause_failed");
    }
    return this.getModel();
  }

  seek(timeMs: number): HiddenLottiePreviewModel {
    if (!this.playbackSession) return this.playbackOperationFailed("seek", "playback_session_missing");
    try {
      this.playbackSession.seek(timeMs);
      this.model = { ...this.model, status: "paused", playback: this.playbackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "seek", "playback_seek_failed");
    }
    return this.getModel();
  }

  setLoop(loop: boolean): HiddenLottiePreviewModel {
    if (!this.playbackSession) return this.playbackOperationFailed("loop", "playback_session_missing");
    try {
      this.playbackSession.setLoop(loop);
      this.model = { ...this.model, playback: this.playbackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "loop", "playback_loop_failed");
    }
    return this.getModel();
  }

  async recoverPlayback(): Promise<HiddenLottiePreviewModel> {
    if (!this.prepared) return this.playbackOperationFailed("recover", "playback_recovery_unavailable");
    this.disposePlaybackSession();
    await this.loadPreparedPlayback();
    return this.getModel();
  }

  dispose(): HiddenLottiePreviewModel {
    this.disposePlaybackSession();
    this.prepared = undefined;
    this.model = {
      ...this.model,
      status: "disposed",
      playback: playbackState("disposed", this.model.playback.durationMs)
    };
    return this.getModel();
  }

  private async createBoundedSource(
    localPath: string,
    requestedDisplayName: string
  ): Promise<HiddenLottieResult<MotionFormatProbeSource & LottieJsonInspectionSource>> {
    try {
      const stat = await this.host.statLocalFile(localPath);
      const displayName = safeSourceName(requestedDisplayName || stat.displayName || localPath) || "lottie.json";
      const sizeBytes = stat.sizeBytes;
      const host = this.host;
      const source: MotionFormatProbeSource & LottieJsonInspectionSource = {
        id: localPath,
        name: displayName,
        sizeBytes,
        mediaType: stat.mediaType ?? mediaTypeFromPath(displayName),
        async read() {
          if (!Number.isFinite(sizeBytes) || sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES) {
            throw new Error("A bounded range read is required for this local motion source.");
          }
          return host.readLocalFileRange(localPath, 0, MOTION_FORMAT_PROBE_MAX_BYTES);
        },
        async readRange(offset, length) {
          return host.readLocalFileRange(localPath, offset, Math.min(length, MOTION_FORMAT_PROBE_MAX_BYTES));
        }
      };
      return { value: source, issues: [] };
    } catch (error) {
      return {
        issues: [issue(
          "parse_precondition",
          "The hidden Lottie preview host could not read local file metadata.",
          "error",
          { reason: "local_file_stat_failed", cause: redactLocalPathsFromError(error, "local file metadata read failed", [localPath]) },
          localPath
        )]
      };
    }
  }

  private async loadPreparedPlayback(): Promise<void> {
    if (!this.prepared) return;
    const inspection = this.prepared.inspection;
    const adapter = new LottieSvgPlaybackAdapter({
      gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
      ...(this.rendererLoader ? { rendererLoader: this.rendererLoader } : {}),
      inspectionService: {
        inspect: async () => inspection
      } as LottieJsonInspectionService,
      allowResolvedImageResources: this.prepared.allowResolvedImageResources
    });
    this.playbackSession = adapter.createSession(this.target);
    const loaded = await this.playbackSession.load(this.prepared.source);
    if (!loaded.value) {
      this.model = {
        ...this.model,
        status: "playbackFailed",
        issues: [...this.model.issues, ...mapIssues(loaded.issues, this.prepared.source, "playback_failure")],
        playback: this.playbackSession.getState()
      };
      this.disposePlaybackSession();
      return;
    }
    this.model = {
      ...this.model,
      status: "ready",
      issues: [...this.model.issues, ...mapIssues(loaded.issues, this.prepared.source, "playback_failure")],
      playback: this.playbackSession.getState()
    };
  }

  private disposePlaybackSession(): void {
    this.playbackSession?.dispose();
    this.playbackSession = undefined;
  }

  private playbackOperationFailed(action: string, reason: string): HiddenLottiePreviewModel {
    this.model = {
      ...this.model,
      status: "playbackFailed",
      issues: [
        ...this.model.issues,
        issue(
          "playback_failure",
          "Hidden Lottie playback operation could not run.",
          "error",
          { action, reason }
        )
      ],
      playback: playbackState("error", this.model.playback.durationMs)
    };
    return this.getModel();
  }

  private failPlaybackOperation(error: unknown, action: string, reason: string): void {
    this.disposePlaybackSession();
    this.model = {
      ...this.model,
      status: "playbackFailed",
      issues: [
        ...this.model.issues,
        issue(
          "playback_failure",
          "Hidden Lottie playback operation failed.",
          "error",
          { action, reason, cause: redactLocalPathsFromError(error, "playback operation failed") }
        )
      ],
      playback: playbackState("error", this.model.playback.durationMs)
    };
  }
}

function validateOpenInput(input: HiddenLottiePreviewOpenInput): HiddenLottiePreviewIssue | undefined {
  if (input.gate !== HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE) {
    return issue("unsupported", "Hidden Lottie preview vertical is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId) || !isOpenSource(input.source) || !isNonEmptyString(input.localPath)) {
    return issue("parse_precondition", "Hidden Lottie preview open input is incomplete.", "error", {
      reason: "open_input_invalid"
    }, input.localPath);
  }
  return undefined;
}

function detectionIssues(
  detection: MotionFormatDetectionResult,
  source: MotionAssetSource
): HiddenLottiePreviewIssue[] {
  if (detection.issues.length > 0) {
    return mapIssues(detection.issues, source, detection.status === "ambiguous" ? "ambiguous" : "unsupported");
  }
  return [issue(
    detection.status === "ambiguous" ? "ambiguous" : "unsupported",
    "The hidden 0.2 Lottie preview can only continue from a detected Lottie JSON candidate.",
    "error",
    {
      reason: "lottie_detection_required",
      detectedFormat: detection.format,
      status: detection.status
    },
    source.id
  )];
}

function surfaceFromAsset(
  asset: MotionAssetInfo,
  sourceIssues: readonly WorkbenchIssue[],
  displayName: string
): Pick<HiddenLottiePreviewModel, "overview" | "layers" | "assets" | "replaceable" | "unsupportedFeatures" | "issues"> {
  const unsupportedFeatures = lottieUnsupportedFeatures(asset);
  const layers = asset.layers.map(layerRow);
  const assets = asset.resources.map(assetRow);
  return {
    overview: {
      format: "lottie",
      displayName,
      version: stringMetadata(asset, "version"),
      dimensions: formatDimensions(asset.dimensions),
      fps: asset.timing.fps,
      durationMs: asset.timing.durationMs,
      layerCount: numberMetadata(asset, "layerCount") ?? asset.layers.length,
      assetCount: numberMetadata(asset, "assetCount") ?? asset.resources.length,
      imageAssetCount: numberMetadata(asset, "imageAssetCount") ?? asset.resources.filter(({ kind }) => kind === "image").length,
      textCandidateCount: numberMetadata(asset, "textCandidateCount") ?? asset.layers.filter(({ kind }) => kind === "text").length,
      unsupportedFeatureCount: unsupportedFeatures.length
    },
    layers,
    assets,
    replaceable: {
      images: assets.filter(({ kind, replaceable }) => kind === "image" && replaceable),
      texts: asset.layers.filter(({ kind }) => kind === "text").map(textCandidateRow)
    },
    unsupportedFeatures,
    issues: mapIssues(sourceIssues, undefined, "unsupported_feature")
  };
}

function playbackBlockingIssues(
  asset: MotionAssetInfo,
  sourceIssues: readonly WorkbenchIssue[],
  source: MotionAssetSource
): HiddenLottiePreviewIssue[] {
  const issues: HiddenLottiePreviewIssue[] = [];
  for (const sourceIssue of sourceIssues) {
    if (sourceIssue.code === "unsupported_feature") {
      issues.push(issue(
        "unsupported_feature",
        "Unsupported Lottie features block hidden playback instead of being silently played.",
        "error",
        {
          reason: "unsupported_feature_precondition",
          inspectionDetails: sourceIssue.details
        },
        source.id
      ));
    }
  }
  const fontResources = asset.resources.filter(({ kind }) => kind === "font");
  if (fontResources.length > 0) {
    issues.push(issue(
      "capability",
      "External Lottie font resources are metadata-only in this hidden vertical.",
      "error",
      {
        reason: "font_resources_deferred",
        resourceIds: fontResources.map(({ id }) => id)
      },
      source.id
    ));
  }
  return issues;
}

async function resolveImageResources(
  host: HiddenLottiePreviewHost,
  source: MotionAssetSource,
  asset: MotionAssetInfo
): Promise<ImageResolution> {
  const rows: HiddenLottiePreviewAssetRow[] = [];
  const dataUris = new Map<string, string>();
  const issues: HiddenLottiePreviewIssue[] = [];
  for (const resource of asset.resources.filter(({ kind }) => kind === "image")) {
    const referencePath = stringFromMetadata(resource, "referencePath");
    if (!referencePath || !isDeterministicRelativePath(referencePath)) {
      rows.push({ ...assetRow(resource), resolutionStatus: "unsupported" });
      issues.push(issue(
        "missing_resource",
        "Lottie image resources require deterministic relative references before playback.",
        "error",
        { reason: "image_reference_unavailable", resourceId: resource.id },
        source.id
      ));
      continue;
    }

    try {
      const read = await host.readAdjacentResource({
        sourceLocalPath: source.id,
        relativePath: referencePath,
        maxBytes: LOTTIE_ADJACENT_RESOURCE_MAX_BYTES
      });
      const sizeBytes = read.sizeBytes ?? read.bytes.byteLength;
      if (sizeBytes > LOTTIE_ADJACENT_RESOURCE_MAX_BYTES || read.bytes.byteLength > LOTTIE_ADJACENT_RESOURCE_MAX_BYTES) {
        rows.push({ ...assetRow(resource), resolutionStatus: "unsupported", referencePath });
        issues.push(issue(
          "capability",
          "Adjacent Lottie image resource exceeds the hidden preview bound.",
          "error",
          {
            reason: "adjacent_resource_too_large",
            resourceId: resource.id,
            maxBytes: LOTTIE_ADJACENT_RESOURCE_MAX_BYTES
          },
          source.id
        ));
        continue;
      }
      const mediaType = imageMediaType(referencePath, read.mediaType);
      if (!mediaType) {
        rows.push({ ...assetRow(resource), resolutionStatus: "unsupported", referencePath, sizeBytes });
        issues.push(issue(
          "capability",
          "Adjacent Lottie image resource media type is not supported by the hidden preview spike.",
          "error",
          { reason: "unsupported_adjacent_image_type", resourceId: resource.id },
          source.id
        ));
        continue;
      }
      dataUris.set(resource.id, `data:${mediaType};base64,${base64(read.bytes)}`);
      rows.push({
        ...assetRow(resource),
        resolutionStatus: "resolved",
        referencePath,
        sizeBytes,
        mediaType
      });
    } catch (error) {
      rows.push({ ...assetRow(resource), resolutionStatus: "missing", referencePath });
      issues.push(issue(
        "missing_resource",
        "Adjacent Lottie image resource could not be resolved.",
        "error",
        {
          reason: "adjacent_resource_missing",
          resourceId: resource.id,
          referencePath,
          cause: redactLocalPathsFromError(error, "adjacent resource read failed", [source.id])
        },
        source.id
      ));
    }
  }
  return { rows, dataUris, issues };
}

async function inlineResolvedImageData(
  source: MotionAssetSource,
  dataUris: ReadonlyMap<string, string>
): Promise<HiddenLottieResult<MotionAssetSource>> {
  try {
    const rangeSource = source as MotionAssetSource & {
      readRange?: (offset: number, length: number) => Promise<Uint8Array>;
    };
    const bytes = rangeSource.readRange
      ? await rangeSource.readRange(0, MOTION_FORMAT_PROBE_MAX_BYTES)
      : source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
        ? undefined
        : await source.read();
    if (!bytes || source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES || bytes.byteLength > MOTION_FORMAT_PROBE_MAX_BYTES) {
      return {
        issues: [issue("parse_precondition", "Complete bounded JSON is required for hidden Lottie playback.", "error", {
          reason: "complete_bounded_animation_data_required"
        }, source.id)]
      };
    }
    const animationData = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const transformed = dataUris.size > 0
      ? inlineImageAssetDataUris(animationData, dataUris)
      : animationData;
    const transformedBytes = new TextEncoder().encode(JSON.stringify(transformed));
    if (transformedBytes.byteLength > MOTION_FORMAT_PROBE_MAX_BYTES) {
      return {
        issues: [issue("capability", "Resolved Lottie animationData exceeds the hidden playback bound.", "error", {
          reason: "resolved_animation_data_too_large",
          maxBytes: MOTION_FORMAT_PROBE_MAX_BYTES
        }, source.id)]
      };
    }
    return {
      value: {
        id: source.id,
        name: source.name,
        sizeBytes: transformedBytes.byteLength,
        mediaType: "application/json",
        async read() {
          return new Uint8Array(transformedBytes);
        },
        async readRange(offset: number, length: number) {
          return transformedBytes.slice(offset, offset + length);
        }
      } as MotionAssetSource & { readRange(offset: number, length: number): Promise<Uint8Array> },
      issues: []
    };
  } catch (error) {
    return {
      issues: [issue(
        "parse_precondition",
        "Hidden Lottie playback requires valid bounded JSON animationData.",
        "error",
        { reason: "valid_animation_data_required", cause: redactLocalPathsFromError(error, "animationData parse failed", [source.id]) },
        source.id
      )]
    };
  }
}

function inlineImageAssetDataUris(animationData: unknown, dataUris: ReadonlyMap<string, string>): unknown {
  if (!isRecord(animationData)) return animationData;
  const cloned = structuredClone(animationData) as Record<string, unknown>;
  if (!Array.isArray(cloned.assets)) return cloned;
  cloned.assets = cloned.assets.map((entry) => {
    if (!isRecord(entry)) return entry;
    const id = typeof entry.id === "string" ? entry.id : "";
    const dataUri = dataUris.get(id);
    if (!dataUri) return entry;
    return {
      ...entry,
      u: "",
      p: dataUri,
      e: 0
    };
  });
  return cloned;
}

function mergeResolvedAssetRows(
  original: readonly HiddenLottiePreviewAssetRow[],
  resolved: readonly HiddenLottiePreviewAssetRow[]
): HiddenLottiePreviewAssetRow[] {
  const resolvedById = new Map(resolved.map((row) => [row.id, row]));
  return original.map((row) => resolvedById.get(row.id) ?? row);
}

function mapIssues(
  issues: readonly WorkbenchIssue[],
  source: MotionAssetSource | undefined,
  fallbackCode: HiddenLottiePreviewIssueCode
): HiddenLottiePreviewIssue[] {
  return issues.map((entry) => {
    const code = hiddenCode(entry.code, fallbackCode);
    return issue(
      code,
      entry.message,
      entry.severity,
      {
        originalCode: entry.code,
        ...(entry.details ? { details: entry.details } : {})
      },
      source?.id ?? entry.path
    );
  });
}

function hiddenCode(code: string, fallbackCode: HiddenLottiePreviewIssueCode): HiddenLottiePreviewIssueCode {
  if (
    code === "unsupported"
      || code === "missing_dependency"
      || code === "parse_precondition"
      || code === "ambiguous"
      || code === "unsupported_feature"
  ) {
    return code;
  }
  if (code === "asset_reference_precondition") return "parse_precondition";
  if (code === "renderer_failure") return "playback_failure";
  return fallbackCode;
}

function issue(
  code: HiddenLottiePreviewIssueCode,
  message: string,
  severity: HiddenLottiePreviewIssue["severity"] = "error",
  details: Readonly<Record<string, unknown>> = {},
  sensitivePath?: string
): HiddenLottiePreviewIssue {
  const sensitivePaths = sensitivePath ? [sensitivePath] : [];
  return {
    severity,
    code,
    message: redactLocalPathsFromError(message, message, sensitivePaths),
    ...(sensitivePath ? { path: "[local path]" } : {}),
    details: redactLocalPathsInValue(details, sensitivePaths)
  };
}

function assetRow(resource: MotionResourceInfo): HiddenLottiePreviewAssetRow {
  return {
    id: resource.id,
    name: resource.name,
    kind: resource.kind,
    dimensions: formatDimensions(resource.dimensions),
    replaceable: resource.replaceable === true,
    referencePath: stringFromMetadata(resource, "referencePath"),
    resolutionStatus: resource.kind === "image" ? "missing" : "not_required",
    pathRedacted: true
  };
}

function layerRow(layer: MotionLayerInfo): HiddenLottiePreviewLayerRow {
  return {
    id: layer.id,
    name: layer.name,
    kind: layer.kind,
    resourceIds: [...layer.resourceIds],
    ...(layer.visible !== undefined ? { visible: layer.visible } : {}),
    replaceable: layer.replaceable === true
  };
}

function textCandidateRow(layer: MotionLayerInfo): HiddenLottiePreviewTextCandidate {
  return {
    id: `text:${layer.id}`,
    layerId: layer.id,
    name: layer.name,
    initialText: typeof layer.metadata?.text === "string" ? layer.metadata.text : undefined,
    replaceable: layer.replaceable === true
  };
}

function lottieUnsupportedFeatures(asset: MotionAssetInfo): HiddenLottiePreviewUnsupportedMarker[] {
  const features = lottieMetadata(asset).unsupportedFeatures;
  if (!Array.isArray(features)) return [];
  return features.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.feature !== "string" || typeof entry.path !== "string") return [];
    return [{ feature: entry.feature, path: entry.path }];
  });
}

function lottieMetadata(asset: MotionAssetInfo): Record<string, unknown> {
  const metadata = asset.metadata?.lottie;
  return isRecord(metadata) ? metadata : {};
}

function stringMetadata(asset: MotionAssetInfo, key: string): string | undefined {
  const value = lottieMetadata(asset)[key];
  return typeof value === "string" ? value : undefined;
}

function numberMetadata(asset: MotionAssetInfo, key: string): number | undefined {
  const value = lottieMetadata(asset)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringFromMetadata(resource: MotionResourceInfo, key: string): string | undefined {
  const value = resource.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function formatDimensions(dimensions: MotionResourceInfo["dimensions"]): string {
  return dimensions ? `${dimensions.width} x ${dimensions.height}` : "unknown";
}

function mediaTypeFromPath(value: string): string | undefined {
  const lower = value.toLocaleLowerCase("en-US");
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return undefined;
}

function imageMediaType(referencePath: string, mediaType: string | undefined): string | undefined {
  const normalized = mediaType?.split(";", 1)[0].trim().toLocaleLowerCase("en-US");
  if (normalized && ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(normalized)) {
    return normalized;
  }
  return mediaTypeFromPath(referencePath)?.startsWith("image/")
    ? mediaTypeFromPath(referencePath)
    : undefined;
}

function idleModel(): HiddenLottiePreviewModel {
  return {
    schemaVersion: HIDDEN_LOTTIE_PREVIEW_SCHEMA_VERSION,
    source: "hidden-0.2-lottie-preview-vertical",
    status: "idle",
    pathRedacted: true,
    rendererHasFullPath: false,
    layers: [],
    assets: [],
    replaceable: { images: [], texts: [] },
    unsupportedFeatures: [],
    issues: [],
    playback: playbackState("idle")
  };
}

function failedModel(issues: readonly HiddenLottiePreviewIssue[]): HiddenLottiePreviewModel {
  return {
    ...idleModel(),
    status: "failed",
    issues,
    playback: playbackState("error")
  };
}

function playbackState(status: PlaybackState["status"], durationMs?: number): PlaybackState {
  return {
    status,
    currentTimeMs: 0,
    ...(durationMs !== undefined ? { durationMs } : {}),
    loop: false
  };
}

function cloneModel(model: HiddenLottiePreviewModel): HiddenLottiePreviewModel {
  return structuredClone(model) as HiddenLottiePreviewModel;
}

function isOpenSource(value: unknown): value is HiddenLottiePreviewOpenSource {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isDeterministicRelativePath(value: string): boolean {
  if (!value || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) || /^[\\/]/u.test(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    return false;
  }
  const parts = value.split(/[\\/]+/u);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function safeSourceName(value: string): string {
  const parts = value.trim().split(/[\\/]+/u).filter(Boolean);
  return (parts.at(-1) ?? "")
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function base64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let index = 0;
  for (; index + 2 < bytes.byteLength; index += 3) {
    const triplet = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    output += alphabet[(triplet >> 18) & 63]
      + alphabet[(triplet >> 12) & 63]
      + alphabet[(triplet >> 6) & 63]
      + alphabet[triplet & 63];
  }
  if (index < bytes.byteLength) {
    const first = bytes[index];
    const second = index + 1 < bytes.byteLength ? bytes[index + 1] : 0;
    const triplet = (first << 16) | (second << 8);
    output += alphabet[(triplet >> 18) & 63] + alphabet[(triplet >> 12) & 63];
    output += index + 1 < bytes.byteLength ? alphabet[(triplet >> 6) & 63] : "=";
    output += "=";
  }
  return output;
}
