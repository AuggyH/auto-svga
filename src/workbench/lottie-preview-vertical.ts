import type {
  MotionAssetInfo,
  MotionAssetSource,
  MotionLayerInfo,
  MotionResourceInfo,
  PlaybackSession,
  PlaybackState,
  CancellationToken,
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
  LOTTIE_JSON_MAX_BYTES,
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

export type HiddenLottiePreviewOpenSource = "fileButton" | "dragDrop" | "menuOpen" | "fileOpenEvent";
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
  readLocalFile?(input: { localPath: string; maxBytes: number }): Promise<Uint8Array>;
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
  replacements?: Readonly<Record<string, HiddenLottiePreviewReplacement>>;
}

export interface HiddenLottiePreviewReplacement {
  kind: "image" | "text";
  value: string;
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

interface ValidatedLottieReplacements {
  imageDataUris: Map<string, string>;
  textValues: Map<string, string>;
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
  private activeRequestGeneration = 0;

  constructor(options: CreateHiddenLottiePreviewVerticalSessionOptions) {
    this.host = options.host;
    this.target = options.target;
    this.rendererLoader = options.rendererLoader;
  }

  getModel(): HiddenLottiePreviewModel {
    return cloneModel(this.model);
  }

  async openLocalCandidate(input: HiddenLottiePreviewOpenInput): Promise<HiddenLottiePreviewModel> {
    const generation = this.beginOpenRequest();

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
    if (!this.isActiveRequest(generation)) return this.getModel();
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
    if (!this.isActiveRequest(generation)) return this.getModel();
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
    if (!this.isActiveRequest(generation)) return this.getModel();
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

    const replacementValidation = validateLottieReplacements(input.replacements, inspection.value, source);
    if (replacementValidation.issues.length > 0 || !replacementValidation.value) {
      this.model = {
        ...this.model,
        status: "failed",
        issues: [...this.model.issues, ...replacementValidation.issues],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    const imageResolution = await resolveImageResources(
      this.host,
      source,
      inspection.value,
      replacementValidation.value.imageDataUris
    );
    if (!this.isActiveRequest(generation)) return this.getModel();
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

    const animationData = await inlineResolvedImageData(
      source,
      imageResolution.dataUris,
      replacementValidation.value.textValues
    );
    if (!this.isActiveRequest(generation)) return this.getModel();
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
      allowResolvedImageResources: imageResolution.rows.some(({ kind, resolutionStatus }) =>
        kind === "image" && resolutionStatus === "resolved"
      )
    };
    await this.loadPreparedPlayback(generation);
    return this.getModel();
  }

  async play(): Promise<HiddenLottiePreviewModel> {
    if (this.isDisposed()) return this.getModel();
    const playbackSession = this.playbackSession;
    if (!playbackSession) return this.playbackOperationFailed("play", "playback_session_missing");
    const generation = this.activeRequestGeneration;
    try {
      await playbackSession.play();
      if (!this.isActivePlaybackSession(playbackSession, generation)) return this.getModel();
      this.model = { ...this.model, status: "playing", playback: playbackSession.getState() };
    } catch (error) {
      if (this.isActivePlaybackSession(playbackSession, generation)) {
        this.failPlaybackOperation(error, "play", "playback_play_failed");
      }
    }
    return this.getModel();
  }

  pause(): HiddenLottiePreviewModel {
    if (this.isDisposed()) return this.getModel();
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
    if (this.isDisposed()) return this.getModel();
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
    if (this.isDisposed()) return this.getModel();
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
    if (this.isDisposed()) return this.getModel();
    if (!this.prepared) return this.playbackOperationFailed("recover", "playback_recovery_unavailable");
    const generation = this.activeRequestGeneration;
    this.disposePlaybackSession();
    await this.loadPreparedPlayback(generation);
    return this.getModel();
  }

  dispose(): HiddenLottiePreviewModel {
    this.activeRequestGeneration += 1;
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
        boundedFullReadMaxBytes: host.readLocalFile ? LOTTIE_JSON_MAX_BYTES : undefined,
        async read() {
          if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > LOTTIE_JSON_MAX_BYTES) {
            throw new Error("A bounded full read is required for this local Lottie source.");
          }
          if (sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES) {
            if (!host.readLocalFile) throw new Error("A bounded full read is required for this local Lottie source.");
            return host.readLocalFile({ localPath, maxBytes: LOTTIE_JSON_MAX_BYTES });
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

  private async loadPreparedPlayback(generation: number): Promise<void> {
    if (!this.isActiveRequest(generation) || !this.prepared) return;
    const prepared = this.prepared;
    const inspection = prepared.inspection;
    const adapter = new LottieSvgPlaybackAdapter({
      gate: LOTTIE_SVG_PLAYBACK_WP2B_GATE,
      ...(this.rendererLoader ? { rendererLoader: this.rendererLoader } : {}),
      inspectionService: {
        inspect: async () => inspection
      } as LottieJsonInspectionService,
      allowResolvedImageResources: prepared.allowResolvedImageResources
    });
    const playbackSession = adapter.createSession(this.target);
    if (!this.isActiveRequest(generation) || this.prepared !== prepared) {
      playbackSession.dispose();
      return;
    }
    this.playbackSession = playbackSession;
    let loaded: WorkbenchResult<MotionAssetInfo>;
    try {
      loaded = await playbackSession.load(prepared.source, {
        cancellation: this.createRequestCancellationToken(generation)
      });
    } catch (error) {
      playbackSession.dispose();
      if (!this.isActivePlaybackSession(playbackSession, generation) || isSupersededRequestError(error)) return;
      this.model = {
        ...this.model,
        status: "playbackFailed",
        issues: [
          ...this.model.issues,
          issue(
            "playback_failure",
            "Hidden Lottie playback load failed.",
            "error",
            { reason: "playback_load_failed", cause: redactLocalPathsFromError(error, "playback load failed", [prepared.source.id]) },
            prepared.source.id
          )
        ],
        playback: playbackState("error", this.model.playback.durationMs)
      };
      this.disposePlaybackSession();
      return;
    }
    if (!this.isActivePlaybackSession(playbackSession, generation) || this.prepared !== prepared) {
      playbackSession.dispose();
      return;
    }
    if (!loaded.value) {
      this.model = {
        ...this.model,
        status: "playbackFailed",
        issues: [...this.model.issues, ...mapIssues(loaded.issues, prepared.source, "playback_failure")],
        playback: playbackSession.getState()
      };
      this.disposePlaybackSession();
      return;
    }
    this.model = {
      ...this.model,
      status: "ready",
      issues: [...this.model.issues, ...mapIssues(loaded.issues, prepared.source, "playback_failure")],
      playback: playbackSession.getState()
    };
  }

  private beginOpenRequest(): number {
    this.activeRequestGeneration += 1;
    this.disposePlaybackSession();
    this.prepared = undefined;
    return this.activeRequestGeneration;
  }

  private isActiveRequest(generation: number): boolean {
    return this.activeRequestGeneration === generation && !this.isDisposed();
  }

  private isActivePlaybackSession(playbackSession: PlaybackSession, generation: number): boolean {
    return this.playbackSession === playbackSession && this.isActiveRequest(generation);
  }

  private isDisposed(): boolean {
    return this.model.status === "disposed";
  }

  private createRequestCancellationToken(generation: number): CancellationToken {
    const session = this;
    return {
      get cancelled() {
        return !session.isActiveRequest(generation);
      },
      throwIfCancelled() {
        if (!session.isActiveRequest(generation)) {
          throw new SupersededHiddenLottiePreviewRequestError();
        }
      }
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

class SupersededHiddenLottiePreviewRequestError extends Error {
  constructor() {
    super("Hidden Lottie preview request was superseded.");
    this.name = "SupersededHiddenLottiePreviewRequestError";
  }
}

function isSupersededRequestError(error: unknown): boolean {
  return error instanceof SupersededHiddenLottiePreviewRequestError;
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
    if (sourceIssue.code === "unsupported_feature"
      && sourceIssue.details?.playbackDisposition !== "advisory") {
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
  asset: MotionAssetInfo,
  imageReplacementDataUris: ReadonlyMap<string, string> = new Map()
): Promise<ImageResolution> {
  const rows: HiddenLottiePreviewAssetRow[] = [];
  const dataUris = new Map<string, string>();
  const issues: HiddenLottiePreviewIssue[] = [];
  for (const resource of asset.resources.filter(({ kind }) => kind === "image")) {
    const replacementDataUri = imageReplacementDataUris.get(resource.id);
    if (replacementDataUri) {
      dataUris.set(resource.id, replacementDataUri);
      rows.push({
        ...assetRow(resource),
        resolutionStatus: "resolved",
        mediaType: mediaTypeFromDataImageUri(replacementDataUri)
      });
      continue;
    }

    if (resource.metadata?.embedded === true) {
      const mediaType = stringFromMetadata(resource, "mediaType");
      if (mediaType?.startsWith("image/")) {
        rows.push({
          ...assetRow(resource),
          resolutionStatus: "resolved",
          mediaType
        });
        continue;
      }
    }

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
  dataUris: ReadonlyMap<string, string>,
  textValues: ReadonlyMap<string, string> = new Map()
): Promise<HiddenLottieResult<MotionAssetSource>> {
  try {
    const rangeSource = source as MotionAssetSource & {
      readRange?: (offset: number, length: number) => Promise<Uint8Array>;
    };
    const bytes = source.sizeBytes > LOTTIE_JSON_MAX_BYTES
      ? undefined
      : source.sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES
        ? await source.read()
        : rangeSource.readRange
          ? await rangeSource.readRange(0, MOTION_FORMAT_PROBE_MAX_BYTES)
          : await source.read();
    if (!bytes || source.sizeBytes > LOTTIE_JSON_MAX_BYTES || bytes.byteLength > LOTTIE_JSON_MAX_BYTES) {
      return {
        issues: [issue("parse_precondition", "Complete bounded JSON is required for hidden Lottie playback.", "error", {
          reason: "complete_bounded_animation_data_required"
        }, source.id)]
      };
    }
    const animationData = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const transformedWithImages = dataUris.size > 0
      ? inlineImageAssetDataUris(animationData, dataUris)
      : animationData;
    const transformed = textValues.size > 0
      ? inlineTextLayerValues(transformedWithImages, textValues)
      : transformedWithImages;
    const transformedBytes = new TextEncoder().encode(JSON.stringify(transformed));
    if (transformedBytes.byteLength > LOTTIE_JSON_MAX_BYTES) {
      return {
        issues: [issue("capability", "Resolved Lottie animationData exceeds the hidden playback bound.", "error", {
          reason: "resolved_animation_data_too_large",
          maxBytes: LOTTIE_JSON_MAX_BYTES
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

function inlineTextLayerValues(animationData: unknown, textValues: ReadonlyMap<string, string>): unknown {
  if (!isRecord(animationData)) return animationData;
  const cloned = structuredClone(animationData) as Record<string, unknown>;
  if (!Array.isArray(cloned.layers)) return cloned;
  cloned.layers = cloned.layers.map((entry) => replaceTextLayerValue(entry, textValues));
  return cloned;
}

function replaceTextLayerValue(layer: unknown, textValues: ReadonlyMap<string, string>): unknown {
  if (!isRecord(layer)) return layer;
  const layerId = stringValue(layer.ind);
  const replacement = textValues.get(`text:${layerId}`) ?? textValues.get(layerId);
  if (replacement === undefined) return layer;
  const cloned = structuredClone(layer) as Record<string, unknown>;
  const textDocument = (cloned.t as { d?: { k?: unknown } } | undefined)?.d?.k;
  if (!Array.isArray(textDocument)) return cloned;
  cloned.t = {
    ...(isRecord(cloned.t) ? cloned.t : {}),
    d: {
      ...(isRecord((cloned.t as { d?: unknown }).d) ? (cloned.t as { d: Record<string, unknown> }).d : {}),
      k: textDocument.map((item) => {
        if (!isRecord(item)) return item;
        return {
          ...item,
          s: {
            ...(isRecord(item.s) ? item.s : {}),
            t: replacement
          }
        };
      })
    }
  };
  return cloned;
}

function validateLottieReplacements(
  replacements: HiddenLottiePreviewOpenInput["replacements"],
  asset: MotionAssetInfo,
  source: MotionAssetSource
): HiddenLottieResult<ValidatedLottieReplacements> {
  const imageDataUris = new Map<string, string>();
  const textValues = new Map<string, string>();
  const issues: HiddenLottiePreviewIssue[] = [];
  const replaceableImages = new Set(asset.resources
    .filter(({ kind, replaceable }) => kind === "image" && replaceable === true)
    .map(({ id }) => id));
  const replaceableTexts = new Set(asset.layers
    .filter(({ kind, replaceable }) => kind === "text" && replaceable === true)
    .flatMap(({ id }) => [id, `text:${id}`]));

  for (const [rawTargetId, replacement] of Object.entries(replacements ?? {})) {
    const targetId = rawTargetId.trim();
    if (!targetId || !isRecord(replacement) || (replacement.kind !== "image" && replacement.kind !== "text")) {
      issues.push(issue(
        "parse_precondition",
        "Lottie preview replacements must target a known image asset or text layer with an explicit kind.",
        "error",
        { reason: "lottie_replacement_input_invalid", targetId },
        source.id
      ));
      continue;
    }
    if (typeof replacement.value !== "string") {
      issues.push(issue(
        "parse_precondition",
        "Lottie preview replacement values must be strings.",
        "error",
        { reason: "lottie_replacement_value_required", targetId, kind: replacement.kind },
        source.id
      ));
      continue;
    }

    if (replacement.kind === "image") {
      if (!replaceableImages.has(targetId)) {
        issues.push(issue(
          "missing_resource",
          "Lottie image replacement target is not a supported replaceable asset.",
          "error",
          { reason: "lottie_image_replacement_target_unavailable", targetId },
          source.id
        ));
        continue;
      }
      const dataUri = replacement.value.trim();
      if (!isSafeDataImageUri(dataUri)) {
        issues.push(issue(
          "unsupported_feature",
          "Lottie image replacements must be inline data images for the hidden local preview candidate.",
          "error",
          { reason: "lottie_image_replacement_must_be_inline_data", targetId },
          source.id
        ));
        continue;
      }
      imageDataUris.set(targetId, dataUri);
      continue;
    }

    const textTargetId = targetId.startsWith("text:") ? targetId : `text:${targetId}`;
    if (!replaceableTexts.has(targetId) && !replaceableTexts.has(textTargetId)) {
      issues.push(issue(
        "missing_resource",
        "Lottie text replacement target is not a supported text candidate.",
        "error",
        { reason: "lottie_text_replacement_target_unavailable", targetId },
        source.id
      ));
      continue;
    }
    if (replacement.value.length > 4_096) {
      issues.push(issue(
        "capability",
        "Lottie text replacement is too large for the hidden local preview candidate.",
        "error",
        { reason: "lottie_text_replacement_too_large", targetId, maxCharacters: 4_096 },
        source.id
      ));
      continue;
    }
    textValues.set(textTargetId, replacement.value);
  }

  return {
    value: { imageDataUris, textValues },
    issues
  };
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

function mediaTypeFromDataImageUri(value: string): string | undefined {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,/iu.exec(value.trim());
  return match?.[1].toLocaleLowerCase("en-US");
}

function isSafeDataImageUri(value: string): boolean {
  const trimmed = value.trim();
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/iu.test(trimmed)
    && trimmed.length <= LOTTIE_ADJACENT_RESOURCE_MAX_BYTES;
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
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen" || value === "fileOpenEvent";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
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
