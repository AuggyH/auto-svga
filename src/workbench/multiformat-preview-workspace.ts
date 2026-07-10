import type {
  FormatAdapter,
  MotionAssetInfo,
  MotionAssetSource,
  MotionFormat,
  MotionLayerInfo,
  MotionResourceInfo,
  PlaybackAdapter,
  PlaybackSession,
  PlaybackState,
  CancellationToken,
  WorkbenchIssue,
  WorkbenchResult
} from "./contracts.js";
import {
  HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
  createHiddenLottiePreviewVerticalSession,
  type HiddenLottiePreviewHost,
  type HiddenLottiePreviewModel,
  type HiddenLottiePreviewOpenSource,
  type HiddenLottiePreviewReplacement,
  type HiddenLottiePreviewStatus
} from "./lottie-preview-vertical.js";
import type {
  LottieSvgPlaybackTarget,
  LottieSvgRendererLoader
} from "./lottie-svg-playback-adapter.js";
import {
  HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
  createHiddenVapPreviewVerticalSession,
  type HiddenVapPreviewFusionReplacement,
  type HiddenVapPreviewHost,
  type HiddenVapPreviewModel,
  type HiddenVapPreviewOpenSource,
  type HiddenVapPreviewStatus
} from "./vap-preview-vertical.js";
import type {
  VapPlaybackHostReadiness,
  VapPreparedFusionElement
} from "./vap-playback-preparation.js";
import type { VapRuntimeLoader } from "./vap-web-playback-adapter.js";
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

export const HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE = "0.2-hidden-multiformat-preview-workspace" as const;
export const HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_SCHEMA_VERSION = 1 as const;

export type HiddenMultiFormatPreviewOpenSource = "fileButton" | "dragDrop" | "menuOpen";
export type HiddenMultiFormatPreviewStatus =
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

export type HiddenMultiFormatPreviewIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface HiddenMultiFormatPreviewIssue extends WorkbenchIssue {
  code: HiddenMultiFormatPreviewIssueCode;
}

export interface HiddenMultiFormatPreviewHost extends HiddenLottiePreviewHost, HiddenVapPreviewHost {}

export interface HiddenMultiFormatPreviewOpenInput {
  gate: string;
  requestId: string;
  source: HiddenMultiFormatPreviewOpenSource;
  localPath: string;
  displayName?: string;
  lottieReplacements?: Readonly<Record<string, HiddenLottiePreviewReplacement>>;
  vapFusionReplacements?: Readonly<Record<string, HiddenVapPreviewFusionReplacement>>;
}

export interface HiddenMultiFormatPreviewOverview {
  format: MotionFormat;
  displayName: string;
  dimensions?: string;
  fps?: number;
  frameCount?: number;
  durationMs?: number;
  resourceCount: number;
  layerCount: number;
  imageResourceCount: number;
  textCandidateCount: number;
  fusionElementCount: number;
  unsupportedFeatureCount: number;
  videoCodec?: string;
  audioPresent?: boolean;
  sourceMaturity: "current" | "hidden_0.2_spike" | "metadata_only" | "blocked";
}

export interface HiddenMultiFormatPreviewLayerRow {
  id: string;
  name: string;
  kind: string;
  resourceIds: readonly string[];
  visible?: boolean;
  replaceable: boolean;
}

export interface HiddenMultiFormatPreviewAssetRow {
  id: string;
  name: string;
  kind: MotionResourceInfo["kind"];
  role?: MotionResourceInfo["role"];
  dimensions?: string;
  sizeBytes?: number;
  replaceable: boolean;
  referencePath?: string;
  resolutionStatus?: "not_required" | "resolved" | "missing" | "unsupported";
  pathRedacted: true;
}

export interface HiddenMultiFormatPreviewTextCandidate {
  id: string;
  layerId: string;
  name: string;
  initialText?: string;
  replaceable: boolean;
}

export interface HiddenMultiFormatPreviewReplaceableModel {
  images: readonly HiddenMultiFormatPreviewAssetRow[];
  texts: readonly HiddenMultiFormatPreviewTextCandidate[];
  fusionImages: readonly VapPreparedFusionElement[];
  fusionTexts: readonly VapPreparedFusionElement[];
}

export interface HiddenMultiFormatPreviewUnsupportedMarker {
  feature: string;
  path: string;
}

export interface HiddenMultiFormatPreviewModel {
  schemaVersion: typeof HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_SCHEMA_VERSION;
  source: "hidden-0.2-multiformat-preview-workspace";
  status: HiddenMultiFormatPreviewStatus;
  requestId?: string;
  openedFrom?: HiddenMultiFormatPreviewOpenSource;
  displayName?: string;
  detectedFormat?: MotionFormat;
  pathRedacted: true;
  rendererHasFullPath: false;
  visibleIn01: false;
  supportClaim: false;
  overview?: HiddenMultiFormatPreviewOverview;
  layers: readonly HiddenMultiFormatPreviewLayerRow[];
  assets: readonly HiddenMultiFormatPreviewAssetRow[];
  fusionElements: readonly VapPreparedFusionElement[];
  replaceable: HiddenMultiFormatPreviewReplaceableModel;
  unsupportedFeatures: readonly HiddenMultiFormatPreviewUnsupportedMarker[];
  issues: readonly HiddenMultiFormatPreviewIssue[];
  playback: PlaybackState;
}

export interface CreateHiddenMultiFormatPreviewWorkspaceOptions {
  host: HiddenMultiFormatPreviewHost;
  lottieTarget?: LottieSvgPlaybackTarget;
  lottieRendererLoader?: LottieSvgRendererLoader;
  vapTarget?: unknown;
  vapHostReadiness?: VapPlaybackHostReadiness;
  vapRuntimeLoader?: VapRuntimeLoader;
  svgaAdapter?: FormatAdapter;
  svgaPlaybackAdapter?: PlaybackAdapter<unknown>;
  svgaPlaybackTarget?: unknown;
}

interface DelegatedSession {
  format: "lottie" | "vap";
  generation: number;
  session: ReturnType<typeof createHiddenLottiePreviewVerticalSession> | ReturnType<typeof createHiddenVapPreviewVerticalSession>;
}

interface SvgaPreparedPlayback {
  source: MotionFormatProbeSource;
  inspection: WorkbenchResult<MotionAssetInfo>;
}

interface HiddenMultiFormatResult<T> {
  value?: T;
  issues: readonly HiddenMultiFormatPreviewIssue[];
}

export function createHiddenMultiFormatPreviewWorkspace(
  options: CreateHiddenMultiFormatPreviewWorkspaceOptions
): HiddenMultiFormatPreviewWorkspaceSession {
  return new HiddenMultiFormatPreviewWorkspaceSession(options);
}

export class HiddenMultiFormatPreviewWorkspaceSession {
  private readonly host: HiddenMultiFormatPreviewHost;
  private readonly lottieTarget: LottieSvgPlaybackTarget | undefined;
  private readonly lottieRendererLoader: LottieSvgRendererLoader | undefined;
  private readonly vapTarget: unknown;
  private readonly vapHostReadiness: VapPlaybackHostReadiness | undefined;
  private readonly vapRuntimeLoader: VapRuntimeLoader | undefined;
  private readonly svgaAdapter: FormatAdapter | undefined;
  private readonly svgaPlaybackAdapter: PlaybackAdapter<unknown> | undefined;
  private readonly svgaPlaybackTarget: unknown;
  private readonly probeService = new MotionFormatProbeService(createMultiFormatPreviewWp1Registry());
  private activeRequestGeneration = 0;
  private activeDelegate?: DelegatedSession;
  private svgaPlaybackSession?: PlaybackSession;
  private svgaPrepared?: SvgaPreparedPlayback;
  private model: HiddenMultiFormatPreviewModel = idleModel();

  constructor(options: CreateHiddenMultiFormatPreviewWorkspaceOptions) {
    this.host = options.host;
    this.lottieTarget = options.lottieTarget;
    this.lottieRendererLoader = options.lottieRendererLoader;
    this.vapTarget = options.vapTarget;
    this.vapHostReadiness = options.vapHostReadiness;
    this.vapRuntimeLoader = options.vapRuntimeLoader;
    this.svgaAdapter = options.svgaAdapter;
    this.svgaPlaybackAdapter = options.svgaPlaybackAdapter;
    this.svgaPlaybackTarget = options.svgaPlaybackTarget;
  }

  getModel(): HiddenMultiFormatPreviewModel {
    return cloneModel(this.model);
  }

  async openLocalCandidate(input: HiddenMultiFormatPreviewOpenInput): Promise<HiddenMultiFormatPreviewModel> {
    const generation = this.beginOpenRequest();
    const validationIssue = validateOpenInput(input);
    if (validationIssue) {
      this.model = failedModel([validationIssue]);
      return this.getModel();
    }

    const displayName = safeSourceName(input.displayName ?? input.localPath) || "motion asset";
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
      gate: MULTIFORMAT_PREVIEW_WP1_GATE,
      context: { cancellation: this.createRequestCancellationToken(generation) }
    });
    if (!this.isActiveRequest(generation)) return this.getModel();
    if (detection.status !== "detected" || !detection.format) {
      this.model = {
        ...this.model,
        detectedFormat: detection.format,
        status: detection.status === "ambiguous" ? "failed" : "playbackBlocked",
        issues: detectionIssues(detection, source),
        playback: playbackState("error")
      };
      return this.getModel();
    }

    this.model = {
      ...this.model,
      detectedFormat: detection.format,
      issues: mapIssues(detection.issues, source, "unsupported")
    };

    if (detection.format === "lottie") {
      return this.openLottie(input, generation);
    }
    if (detection.format === "vap") {
      return this.openVap(input, generation);
    }
    if (detection.format === "svga") {
      await this.openSvga(source, generation);
      return this.getModel();
    }

    this.model = {
      ...this.model,
      status: "playbackBlocked",
      issues: [
        ...this.model.issues,
        issue(
          "unsupported",
          "This hidden 0.2 workspace currently routes only SVGA, Lottie JSON, and VAP candidates.",
          "error",
          { reason: "workspace_format_route_unavailable", detectedFormat: detection.format },
          source.id
        )
      ],
      playback: playbackState("error")
    };
    return this.getModel();
  }

  async play(): Promise<HiddenMultiFormatPreviewModel> {
    if (this.isDisposed()) return this.getModel();
    const delegate = this.activeDelegate;
    if (delegate?.format === "lottie") {
      const model = await delegate.session.play();
      if (this.isActiveDelegate(delegate)) this.model = mapLottieModel(model as HiddenLottiePreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (delegate?.format === "vap") {
      const model = await delegate.session.play();
      if (this.isActiveDelegate(delegate)) this.model = mapVapModel(model as HiddenVapPreviewModel, this.model.detectedFormat);
      return this.getModel();
    }

    const playbackSession = this.svgaPlaybackSession;
    if (!playbackSession) return this.playbackOperationFailed("play", "playback_session_missing");
    const generation = this.activeRequestGeneration;
    try {
      await playbackSession.play();
      if (!this.isActiveSvgaPlaybackSession(playbackSession, generation)) return this.getModel();
      this.model = { ...this.model, status: "playing", playback: playbackSession.getState() };
    } catch (error) {
      if (this.isActiveSvgaPlaybackSession(playbackSession, generation)) {
        this.failPlaybackOperation(error, "play", "playback_play_failed");
      }
    }
    return this.getModel();
  }

  pause(): HiddenMultiFormatPreviewModel {
    if (this.isDisposed()) return this.getModel();
    const delegate = this.activeDelegate;
    if (delegate?.format === "lottie") {
      const model = delegate.session.pause();
      if (this.isActiveDelegate(delegate)) this.model = mapLottieModel(model as HiddenLottiePreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (delegate?.format === "vap") {
      const model = delegate.session.pause();
      if (this.isActiveDelegate(delegate)) this.model = mapVapModel(model as HiddenVapPreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (!this.svgaPlaybackSession) return this.playbackOperationFailed("pause", "playback_session_missing");
    try {
      this.svgaPlaybackSession.pause();
      this.model = { ...this.model, status: "paused", playback: this.svgaPlaybackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "pause", "playback_pause_failed");
    }
    return this.getModel();
  }

  seek(timeMs: number): HiddenMultiFormatPreviewModel {
    if (this.isDisposed()) return this.getModel();
    const delegate = this.activeDelegate;
    if (delegate?.format === "lottie") {
      const model = delegate.session.seek(timeMs);
      if (this.isActiveDelegate(delegate)) this.model = mapLottieModel(model as HiddenLottiePreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (delegate?.format === "vap") {
      const model = delegate.session.seek(timeMs);
      if (this.isActiveDelegate(delegate)) this.model = mapVapModel(model as HiddenVapPreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (!this.svgaPlaybackSession) return this.playbackOperationFailed("seek", "playback_session_missing");
    try {
      this.svgaPlaybackSession.seek(timeMs);
      this.model = { ...this.model, status: "paused", playback: this.svgaPlaybackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "seek", "playback_seek_failed");
    }
    return this.getModel();
  }

  setLoop(loop: boolean): HiddenMultiFormatPreviewModel {
    if (this.isDisposed()) return this.getModel();
    const delegate = this.activeDelegate;
    if (delegate?.format === "lottie") {
      const model = delegate.session.setLoop(loop);
      if (this.isActiveDelegate(delegate)) this.model = mapLottieModel(model as HiddenLottiePreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (delegate?.format === "vap") {
      const model = delegate.session.setLoop(loop);
      if (this.isActiveDelegate(delegate)) this.model = mapVapModel(model as HiddenVapPreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (!this.svgaPlaybackSession) return this.playbackOperationFailed("loop", "playback_session_missing");
    try {
      this.svgaPlaybackSession.setLoop(loop);
      this.model = { ...this.model, playback: this.svgaPlaybackSession.getState() };
    } catch (error) {
      this.failPlaybackOperation(error, "loop", "playback_loop_failed");
    }
    return this.getModel();
  }

  async recoverPlayback(): Promise<HiddenMultiFormatPreviewModel> {
    if (this.isDisposed()) return this.getModel();
    const delegate = this.activeDelegate;
    if (delegate?.format === "lottie") {
      const model = await delegate.session.recoverPlayback();
      if (this.isActiveDelegate(delegate)) this.model = mapLottieModel(model as HiddenLottiePreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (delegate?.format === "vap") {
      const model = await delegate.session.recoverPlayback();
      if (this.isActiveDelegate(delegate)) this.model = mapVapModel(model as HiddenVapPreviewModel, this.model.detectedFormat);
      return this.getModel();
    }
    if (!this.svgaPrepared) return this.playbackOperationFailed("recover", "playback_recovery_unavailable");
    const generation = this.activeRequestGeneration;
    this.disposeSvgaPlaybackSession();
    await this.loadSvgaPlayback(generation, this.svgaPrepared);
    return this.getModel();
  }

  dispose(): HiddenMultiFormatPreviewModel {
    this.activeRequestGeneration += 1;
    this.disposeActiveDelegate();
    this.disposeSvgaPlaybackSession();
    this.svgaPrepared = undefined;
    this.model = {
      ...this.model,
      status: "disposed",
      playback: playbackState("disposed", this.model.playback.durationMs)
    };
    return this.getModel();
  }

  private async openLottie(
    input: HiddenMultiFormatPreviewOpenInput,
    generation: number
  ): Promise<HiddenMultiFormatPreviewModel> {
    if (!this.lottieTarget) {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        issues: [
          ...this.model.issues,
          issue("missing_dependency", "Hidden Lottie workspace playback target is not configured.", "error", {
            reason: "lottie_target_required"
          }, input.localPath)
        ],
        playback: playbackState("error")
      };
      return this.getModel();
    }
    const session = createHiddenLottiePreviewVerticalSession({
      host: this.host,
      target: this.lottieTarget,
      ...(this.lottieRendererLoader ? { rendererLoader: this.lottieRendererLoader } : {})
    });
    const delegate: DelegatedSession = { format: "lottie", generation, session };
    this.activeDelegate = delegate;
    const model = await session.openLocalCandidate({
      gate: HIDDEN_LOTTIE_PREVIEW_VERTICAL_GATE,
      requestId: input.requestId,
      source: input.source as HiddenLottiePreviewOpenSource,
      localPath: input.localPath,
      displayName: input.displayName,
      replacements: input.lottieReplacements
    });
    if (!this.isActiveDelegate(delegate)) return this.getModel();
    this.model = mapLottieModel(model, "lottie");
    return this.getModel();
  }

  private async openVap(
    input: HiddenMultiFormatPreviewOpenInput,
    generation: number
  ): Promise<HiddenMultiFormatPreviewModel> {
    const session = createHiddenVapPreviewVerticalSession({
      host: this.host,
      target: this.vapTarget,
      ...(this.vapHostReadiness ? { hostReadiness: this.vapHostReadiness } : {}),
      ...(this.vapRuntimeLoader ? { runtimeLoader: this.vapRuntimeLoader } : {})
    });
    const delegate: DelegatedSession = { format: "vap", generation, session };
    this.activeDelegate = delegate;
    const model = await session.openLocalCandidate({
      gate: HIDDEN_VAP_PREVIEW_VERTICAL_GATE,
      requestId: input.requestId,
      source: input.source as HiddenVapPreviewOpenSource,
      localPath: input.localPath,
      displayName: input.displayName,
      fusionReplacements: input.vapFusionReplacements
    });
    if (!this.isActiveDelegate(delegate)) return this.getModel();
    this.model = mapVapModel(model, "vap");
    return this.getModel();
  }

  private async openSvga(source: MotionFormatProbeSource, generation: number): Promise<void> {
    if (!this.svgaAdapter || this.svgaAdapter.format !== "svga") {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        issues: [
          ...this.model.issues,
          issue("missing_dependency", "Hidden multi-format workspace requires an SVGA inspection adapter.", "error", {
            reason: "svga_adapter_required"
          }, source.id)
        ],
        playback: playbackState("error")
      };
      return;
    }

    const inspection = await this.svgaAdapter.parse(source, {
      cancellation: this.createRequestCancellationToken(generation)
    });
    if (!this.isActiveRequest(generation)) return;
    if (!inspection.value) {
      this.model = {
        ...this.model,
        status: "failed",
        issues: [...this.model.issues, ...mapIssues(inspection.issues, source, "parse_precondition")],
        playback: playbackState("error")
      };
      return;
    }

    this.model = {
      ...this.model,
      ...surfaceFromSvgaAsset(inspection.value),
      status: "inspectionReady",
      issues: [...this.model.issues, ...mapIssues(inspection.issues, source, "unsupported")],
      playback: playbackState("idle", inspection.value.timing.durationMs)
    };

    this.svgaPrepared = { source, inspection };
    if (!this.svgaPlaybackAdapter) {
      this.model = {
        ...this.model,
        status: "playbackBlocked",
        issues: [
          ...this.model.issues,
          issue("capability", "SVGA playback remains bound to the formal 0.1 client path; no hidden 0.2 workspace adapter is configured.", "warning", {
            reason: "svga_workspace_playback_adapter_not_configured"
          }, source.id)
        ],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return;
    }
    await this.loadSvgaPlayback(generation, this.svgaPrepared);
  }

  private async createBoundedSource(
    localPath: string,
    requestedDisplayName: string
  ): Promise<HiddenMultiFormatResult<MotionFormatProbeSource>> {
    try {
      const stat = await this.host.statLocalFile(localPath);
      const displayName = safeSourceName(requestedDisplayName || stat.displayName || localPath) || "motion asset";
      const sizeBytes = stat.sizeBytes;
      const host = this.host;
      const source: MotionFormatProbeSource = {
        id: localPath,
        name: displayName,
        sizeBytes,
        mediaType: stat.mediaType ?? mediaTypeFromPath(displayName),
        async read() {
          if (!Number.isFinite(sizeBytes) || sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES) {
            throw new Error("A bounded range read is required for this local motion source.");
          }
          return host.readLocalFileRange(localPath, 0, Math.min(sizeBytes, MOTION_FORMAT_PROBE_MAX_BYTES));
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
          "The hidden multi-format workspace host could not read local file metadata.",
          "error",
          { reason: "local_file_stat_failed", cause: redactLocalPathsFromError(error, "local file metadata read failed", [localPath]) },
          localPath
        )]
      };
    }
  }

  private async loadSvgaPlayback(generation: number, prepared: SvgaPreparedPlayback): Promise<void> {
    if (!this.isActiveRequest(generation) || !this.svgaPlaybackAdapter) return;
    const playbackSession = this.svgaPlaybackAdapter.createSession(this.svgaPlaybackTarget);
    if (!this.isActiveRequest(generation) || this.svgaPrepared !== prepared) {
      playbackSession.dispose();
      return;
    }
    this.svgaPlaybackSession = playbackSession;
    let loaded: WorkbenchResult<MotionAssetInfo>;
    try {
      loaded = await playbackSession.load(prepared.source, {
        cancellation: this.createRequestCancellationToken(generation)
      });
    } catch (error) {
      playbackSession.dispose();
      if (!this.isActiveSvgaPlaybackSession(playbackSession, generation) || isSupersededRequestError(error)) return;
      this.model = {
        ...this.model,
        status: "playbackFailed",
        issues: [
          ...this.model.issues,
          issue(
            "playback_failure",
            "Hidden SVGA workspace playback load failed.",
            "error",
            { reason: "playback_load_failed", cause: redactLocalPathsFromError(error, "playback load failed", [prepared.source.id]) },
            prepared.source.id
          )
        ],
        playback: playbackState("error", this.model.playback.durationMs)
      };
      this.disposeSvgaPlaybackSession();
      return;
    }
    if (!this.isActiveSvgaPlaybackSession(playbackSession, generation) || this.svgaPrepared !== prepared) {
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
      this.disposeSvgaPlaybackSession();
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
    this.disposeActiveDelegate();
    this.disposeSvgaPlaybackSession();
    this.svgaPrepared = undefined;
    return this.activeRequestGeneration;
  }

  private isActiveRequest(generation: number): boolean {
    return this.activeRequestGeneration === generation && !this.isDisposed();
  }

  private isActiveDelegate(delegate: DelegatedSession): boolean {
    return this.activeDelegate === delegate && this.isActiveRequest(delegate.generation);
  }

  private isActiveSvgaPlaybackSession(playbackSession: PlaybackSession, generation: number): boolean {
    return this.svgaPlaybackSession === playbackSession && this.isActiveRequest(generation);
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
          throw new SupersededHiddenMultiFormatPreviewRequestError();
        }
      }
    };
  }

  private disposeActiveDelegate(): void {
    this.activeDelegate?.session.dispose();
    this.activeDelegate = undefined;
  }

  private disposeSvgaPlaybackSession(): void {
    this.svgaPlaybackSession?.dispose();
    this.svgaPlaybackSession = undefined;
  }

  private playbackOperationFailed(action: string, reason: string): HiddenMultiFormatPreviewModel {
    this.model = {
      ...this.model,
      status: "playbackFailed",
      issues: [
        ...this.model.issues,
        issue("playback_failure", "Hidden multi-format playback operation could not run.", "error", {
          action,
          reason
        })
      ],
      playback: playbackState("error", this.model.playback.durationMs)
    };
    return this.getModel();
  }

  private failPlaybackOperation(error: unknown, action: string, reason: string): void {
    this.disposeSvgaPlaybackSession();
    this.model = {
      ...this.model,
      status: "playbackFailed",
      issues: [
        ...this.model.issues,
        issue("playback_failure", "Hidden multi-format playback operation failed.", "error", {
          action,
          reason,
          cause: redactLocalPathsFromError(error, "playback operation failed")
        })
      ],
      playback: playbackState("error", this.model.playback.durationMs)
    };
  }
}

class SupersededHiddenMultiFormatPreviewRequestError extends Error {
  constructor() {
    super("Hidden multi-format workspace request was superseded.");
    this.name = "SupersededHiddenMultiFormatPreviewRequestError";
  }
}

function isSupersededRequestError(error: unknown): boolean {
  return error instanceof SupersededHiddenMultiFormatPreviewRequestError;
}

function validateOpenInput(input: HiddenMultiFormatPreviewOpenInput): HiddenMultiFormatPreviewIssue | undefined {
  if (input.gate !== HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_GATE) {
    return issue("unsupported", "Hidden multi-format workspace is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId) || !isOpenSource(input.source) || !isNonEmptyString(input.localPath)) {
    return issue("parse_precondition", "Hidden multi-format workspace open input is incomplete.", "error", {
      reason: "open_input_invalid"
    }, input.localPath);
  }
  return undefined;
}

function mapLottieModel(
  model: HiddenLottiePreviewModel,
  detectedFormat: MotionFormat | undefined
): HiddenMultiFormatPreviewModel {
  const assets = model.assets.map((asset): HiddenMultiFormatPreviewAssetRow => ({
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    dimensions: asset.dimensions,
    sizeBytes: asset.sizeBytes,
    replaceable: asset.replaceable,
    referencePath: asset.referencePath,
    resolutionStatus: asset.resolutionStatus,
    pathRedacted: true
  }));
  const texts = model.replaceable.texts.map((text): HiddenMultiFormatPreviewTextCandidate => ({
    id: text.id,
    layerId: text.layerId,
    name: text.name,
    initialText: text.initialText,
    replaceable: text.replaceable
  }));
  return {
    schemaVersion: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_SCHEMA_VERSION,
    source: "hidden-0.2-multiformat-preview-workspace",
    status: mapStatus(model.status),
    requestId: model.requestId,
    openedFrom: model.openedFrom,
    displayName: model.displayName,
    detectedFormat: detectedFormat ?? "lottie",
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    overview: model.overview ? {
      format: "lottie",
      displayName: model.overview.displayName,
      dimensions: model.overview.dimensions,
      fps: model.overview.fps,
      durationMs: model.overview.durationMs,
      resourceCount: model.overview.assetCount,
      layerCount: model.overview.layerCount,
      imageResourceCount: model.overview.imageAssetCount,
      textCandidateCount: model.overview.textCandidateCount,
      fusionElementCount: 0,
      unsupportedFeatureCount: model.overview.unsupportedFeatureCount,
      sourceMaturity: "hidden_0.2_spike"
    } : undefined,
    layers: model.layers.map((layer): HiddenMultiFormatPreviewLayerRow => ({
      id: layer.id,
      name: layer.name,
      kind: layer.kind,
      resourceIds: [...layer.resourceIds],
      visible: layer.visible,
      replaceable: layer.replaceable
    })),
    assets,
    fusionElements: [],
    replaceable: {
      images: assets.filter(({ kind, replaceable }) => kind === "image" && replaceable),
      texts,
      fusionImages: [],
      fusionTexts: []
    },
    unsupportedFeatures: model.unsupportedFeatures.map((entry) => ({ ...entry })),
    issues: mapIssues(model.issues, undefined, "unsupported"),
    playback: { ...model.playback }
  };
}

function mapVapModel(
  model: HiddenVapPreviewModel,
  detectedFormat: MotionFormat | undefined
): HiddenMultiFormatPreviewModel {
  const fusionElements = model.fusionElements.map(cloneFusionElement);
  return {
    schemaVersion: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_SCHEMA_VERSION,
    source: "hidden-0.2-multiformat-preview-workspace",
    status: mapStatus(model.status),
    requestId: model.requestId,
    openedFrom: model.openedFrom,
    displayName: model.displayName,
    detectedFormat: detectedFormat ?? "vap",
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    overview: model.overview ? {
      format: "vap",
      displayName: model.overview.displayName,
      dimensions: model.overview.dimensions,
      fps: model.overview.fps,
      frameCount: model.overview.frameCount,
      durationMs: model.overview.durationMs,
      resourceCount: model.overview.fusionElementCount,
      layerCount: model.overview.fusionElementCount,
      imageResourceCount: model.overview.imageFusionCount,
      textCandidateCount: model.overview.textFusionCount,
      fusionElementCount: model.overview.fusionElementCount,
      unsupportedFeatureCount: 0,
      videoCodec: model.overview.videoCodec,
      audioPresent: model.overview.audioPresent,
      sourceMaturity: "hidden_0.2_spike"
    } : undefined,
    layers: fusionElements.map((element): HiddenMultiFormatPreviewLayerRow => ({
      id: element.layerId ?? element.id,
      name: element.srcTag ?? element.id,
      kind: `vap_fusion_${element.kind}`,
      resourceIds: [element.resourceId],
      replaceable: element.replaceable
    })),
    assets: fusionElements.map((element): HiddenMultiFormatPreviewAssetRow => ({
      id: element.resourceId,
      name: element.srcTag ?? element.resourceId,
      kind: element.kind === "image" ? "image" : "unknown",
      dimensions: dimensionsLabel(element.dimensions),
      replaceable: element.replaceable,
      resolutionStatus: element.replacementRequired && !element.replacementProvided ? "missing" : "not_required",
      pathRedacted: true
    })),
    fusionElements,
    replaceable: {
      images: [],
      texts: [],
      fusionImages: fusionElements.filter(({ kind, replaceable }) => kind === "image" && replaceable),
      fusionTexts: fusionElements.filter(({ kind, replaceable }) => kind === "text" && replaceable)
    },
    unsupportedFeatures: [],
    issues: mapIssues(model.issues, undefined, "unsupported"),
    playback: { ...model.playback }
  };
}

function surfaceFromSvgaAsset(
  asset: MotionAssetInfo
): Pick<HiddenMultiFormatPreviewModel, "overview" | "layers" | "assets" | "replaceable" | "unsupportedFeatures" | "fusionElements"> {
  const assets = asset.resources.map(assetRow);
  const layers = asset.layers.map(layerRow);
  return {
    overview: {
      format: "svga",
      displayName: asset.name,
      dimensions: dimensionsLabel(asset.dimensions),
      fps: asset.timing.fps,
      frameCount: asset.timing.frameCount,
      durationMs: asset.timing.durationMs,
      resourceCount: asset.resources.length,
      layerCount: asset.layers.length,
      imageResourceCount: asset.resources.filter(({ kind }) => kind === "image").length,
      textCandidateCount: 0,
      fusionElementCount: 0,
      unsupportedFeatureCount: 0,
      sourceMaturity: "current"
    },
    layers,
    assets,
    replaceable: {
      images: assets.filter(({ kind, replaceable }) => kind === "image" && replaceable),
      texts: [],
      fusionImages: [],
      fusionTexts: []
    },
    unsupportedFeatures: [],
    fusionElements: []
  };
}

function assetRow(resource: MotionResourceInfo): HiddenMultiFormatPreviewAssetRow {
  return {
    id: resource.id,
    name: resource.name,
    kind: resource.kind,
    role: resource.role,
    dimensions: dimensionsLabel(resource.dimensions),
    sizeBytes: resource.sizeBytes,
    replaceable: resource.replaceable === true,
    resolutionStatus: "not_required",
    pathRedacted: true
  };
}

function layerRow(layer: MotionLayerInfo): HiddenMultiFormatPreviewLayerRow {
  return {
    id: layer.id,
    name: layer.name,
    kind: layer.kind,
    resourceIds: [...layer.resourceIds],
    visible: layer.visible,
    replaceable: layer.replaceable === true
  };
}

function detectionIssues(
  detection: MotionFormatDetectionResult,
  source: MotionAssetSource
): HiddenMultiFormatPreviewIssue[] {
  const fallbackCode: HiddenMultiFormatPreviewIssueCode = detection.status === "ambiguous" ? "ambiguous" : "unsupported";
  if (detection.issues.length > 0) return mapIssues(detection.issues, source, fallbackCode);
  return [issue(
    fallbackCode,
    "The hidden multi-format workspace can continue only from a detected SVGA, Lottie JSON, or VAP candidate.",
    "error",
    { reason: "workspace_detection_required", detectedFormat: detection.format, status: detection.status },
    source.id
  )];
}

function mapIssues(
  entries: readonly WorkbenchIssue[],
  source: MotionAssetSource | undefined,
  fallbackCode: HiddenMultiFormatPreviewIssueCode
): HiddenMultiFormatPreviewIssue[] {
  return entries.map((entry) => issue(
    mapIssueCode(entry.code, fallbackCode),
    entry.message,
    entry.severity,
    {
      ...(entry.details ?? {}),
      originalCode: entry.code
    },
    source?.id ?? entry.path
  ));
}

function mapIssueCode(code: string, fallbackCode: HiddenMultiFormatPreviewIssueCode): HiddenMultiFormatPreviewIssueCode {
  if ([
    "unsupported",
    "missing_dependency",
    "missing_resource",
    "parse_precondition",
    "ambiguous",
    "capability",
    "unsupported_feature",
    "playback_failure"
  ].includes(code)) {
    return code as HiddenMultiFormatPreviewIssueCode;
  }
  return fallbackCode;
}

function issue(
  code: HiddenMultiFormatPreviewIssueCode,
  message: string,
  severity: WorkbenchIssue["severity"],
  details: Readonly<Record<string, unknown>> = {},
  sensitivePath?: string
): HiddenMultiFormatPreviewIssue {
  const sensitivePaths = sensitivePath && isPathLike(sensitivePath) ? [sensitivePath] : [];
  return {
    severity,
    code,
    message,
    path: sensitivePaths.length > 0 ? "[local path]" : undefined,
    details: redactLocalPathsInValue(details, sensitivePaths)
  };
}

function failedModel(
  issues: readonly HiddenMultiFormatPreviewIssue[]
): HiddenMultiFormatPreviewModel {
  return {
    ...idleModel(),
    status: "failed",
    issues,
    playback: playbackState("error")
  };
}

function idleModel(): HiddenMultiFormatPreviewModel {
  return {
    schemaVersion: HIDDEN_MULTIFORMAT_PREVIEW_WORKSPACE_SCHEMA_VERSION,
    source: "hidden-0.2-multiformat-preview-workspace",
    status: "idle",
    pathRedacted: true,
    rendererHasFullPath: false,
    visibleIn01: false,
    supportClaim: false,
    layers: [],
    assets: [],
    fusionElements: [],
    replaceable: {
      images: [],
      texts: [],
      fusionImages: [],
      fusionTexts: []
    },
    unsupportedFeatures: [],
    issues: [],
    playback: playbackState("idle")
  };
}

function playbackState(status: PlaybackState["status"], durationMs?: number): PlaybackState {
  return {
    status,
    currentTimeMs: 0,
    durationMs,
    loop: false
  };
}

function cloneModel(model: HiddenMultiFormatPreviewModel): HiddenMultiFormatPreviewModel {
  return {
    ...model,
    overview: model.overview ? { ...model.overview } : undefined,
    layers: model.layers.map((layer) => ({
      ...layer,
      resourceIds: [...layer.resourceIds]
    })),
    assets: model.assets.map((asset) => ({ ...asset })),
    fusionElements: model.fusionElements.map(cloneFusionElement),
    replaceable: {
      images: model.replaceable.images.map((asset) => ({ ...asset })),
      texts: model.replaceable.texts.map((text) => ({ ...text })),
      fusionImages: model.replaceable.fusionImages.map(cloneFusionElement),
      fusionTexts: model.replaceable.fusionTexts.map(cloneFusionElement)
    },
    unsupportedFeatures: model.unsupportedFeatures.map((entry) => ({ ...entry })),
    issues: model.issues.map((entry) => ({
      ...entry,
      details: entry.details ? { ...entry.details } : undefined
    })),
    playback: { ...model.playback }
  };
}

function cloneFusionElement(element: VapPreparedFusionElement): VapPreparedFusionElement {
  return {
    ...element,
    zValues: [...element.zValues],
    placementSamples: [...element.placementSamples]
  };
}

function mapStatus(status: HiddenLottiePreviewStatus | HiddenVapPreviewStatus): HiddenMultiFormatPreviewStatus {
  return status;
}

function dimensionsLabel(dimensions: { width: number; height: number } | undefined): string | undefined {
  return dimensions ? `${dimensions.width} x ${dimensions.height}` : undefined;
}

function mediaTypeFromPath(pathValue: string): string {
  if (/\.json$/iu.test(pathValue)) return "application/json";
  if (/\.(mp4|vap)$/iu.test(pathValue)) return "video/mp4";
  if (/\.svga$/iu.test(pathValue)) return "application/octet-stream";
  return "application/octet-stream";
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOpenSource(value: string): value is HiddenMultiFormatPreviewOpenSource {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen";
}
