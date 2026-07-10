import type {
  CancellationToken,
  MotionAssetInfo,
  PlaybackSession,
  PlaybackState,
  WorkbenchIssue,
  WorkbenchResult
} from "./contracts.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import {
  MOTION_FORMAT_PROBE_MAX_BYTES,
  MULTIFORMAT_PREVIEW_WP1_GATE,
  MotionFormatProbeService,
  createMultiFormatPreviewWp1Registry,
  type MotionFormatProbeSource
} from "./motion-format-registry.js";
import {
  VAP_INSPECTION_READINESS_GATE,
  VapInspectionService,
  type VapInspectionSource
} from "./vap-inspection.js";
import {
  VAP_PLAYBACK_PREPARATION_WP3B_GATE,
  VapPlaybackPreparationService,
  type VapPlaybackHostReadiness,
  type VapPreparedFusionElement
} from "./vap-playback-preparation.js";
import {
  VAP_WEB_PLAYBACK_WP3C_GATE,
  VapWebPlaybackAdapter,
  type VapRuntimeLoader,
  type VapWebPlaybackSource
} from "./vap-web-playback-adapter.js";

export const HIDDEN_VAP_PREVIEW_VERTICAL_GATE = "0.2-hidden-vap-preview-runtime-vertical" as const;
export const HIDDEN_VAP_PREVIEW_SCHEMA_VERSION = 1 as const;

export type HiddenVapPreviewOpenSource = "fileButton" | "dragDrop" | "menuOpen";
export type HiddenVapPreviewStatus =
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

export type HiddenVapPreviewIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface HiddenVapPreviewIssue extends WorkbenchIssue {
  code: HiddenVapPreviewIssueCode;
}

export interface HiddenVapPreviewHostFileStat {
  sizeBytes: number;
  displayName?: string;
  mediaType?: string;
}

export interface HiddenVapPreviewObjectUrl {
  objectUrl: string;
  revoke(): Promise<void> | void;
}

export interface HiddenVapPreviewHost {
  statLocalFile(localPath: string): Promise<HiddenVapPreviewHostFileStat>;
  readLocalFileRange(localPath: string, offset: number, length: number): Promise<Uint8Array>;
  createLocalObjectUrl(input: {
    localPath: string;
    mediaType: string;
  }): Promise<HiddenVapPreviewObjectUrl>;
}

export interface HiddenVapPreviewFusionReplacement {
  kind: "image" | "text";
  value: string;
}

export interface HiddenVapPreviewOpenInput {
  gate: string;
  requestId: string;
  source: HiddenVapPreviewOpenSource;
  localPath: string;
  displayName?: string;
  fusionReplacements?: Readonly<Record<string, HiddenVapPreviewFusionReplacement>>;
}

export interface HiddenVapPreviewOverview {
  format: "vap";
  displayName: string;
  dimensions?: string;
  videoDimensions?: string;
  fps?: number;
  frameCount?: number;
  durationMs?: number;
  videoCodec?: string;
  audioPresent: boolean;
  fusionElementCount: number;
  imageFusionCount: number;
  textFusionCount: number;
}

export interface HiddenVapPreviewModel {
  schemaVersion: typeof HIDDEN_VAP_PREVIEW_SCHEMA_VERSION;
  source: "hidden-0.2-vap-preview-runtime-vertical";
  status: HiddenVapPreviewStatus;
  requestId?: string;
  openedFrom?: HiddenVapPreviewOpenSource;
  displayName?: string;
  pathRedacted: true;
  rendererHasFullPath: false;
  overview?: HiddenVapPreviewOverview;
  fusionElements: readonly VapPreparedFusionElement[];
  issues: readonly HiddenVapPreviewIssue[];
  playback: PlaybackState;
}

export interface CreateHiddenVapPreviewVerticalSessionOptions {
  host: HiddenVapPreviewHost;
  target: unknown;
  hostReadiness?: VapPlaybackHostReadiness;
  runtimeLoader?: VapRuntimeLoader;
}

interface HiddenVapResult<T> {
  value?: T;
  issues: readonly HiddenVapPreviewIssue[];
}

interface PreparedPlayback {
  input: HiddenVapPreviewOpenInput;
  source: VapWebPlaybackSource;
  inspection: WorkbenchResult<MotionAssetInfo>;
}

export function createHiddenVapPreviewVerticalSession(
  options: CreateHiddenVapPreviewVerticalSessionOptions
): HiddenVapPreviewVerticalSession {
  return new HiddenVapPreviewVerticalSession(options);
}

export class HiddenVapPreviewVerticalSession {
  private readonly host: HiddenVapPreviewHost;
  private readonly target: unknown;
  private readonly hostReadiness: VapPlaybackHostReadiness | undefined;
  private readonly runtimeLoader: VapRuntimeLoader | undefined;
  private readonly probeService = new MotionFormatProbeService(createMultiFormatPreviewWp1Registry());
  private readonly inspectionService = new VapInspectionService();
  private readonly preparationService = new VapPlaybackPreparationService();
  private playbackSession?: PlaybackSession;
  private prepared?: PreparedPlayback;
  private lastInput?: HiddenVapPreviewOpenInput;
  private model: HiddenVapPreviewModel = idleModel();
  private activeRequestGeneration = 0;

  constructor(options: CreateHiddenVapPreviewVerticalSessionOptions) {
    this.host = options.host;
    this.target = options.target;
    this.hostReadiness = options.hostReadiness;
    this.runtimeLoader = options.runtimeLoader;
  }

  getModel(): HiddenVapPreviewModel {
    return cloneModel(this.model);
  }

  async openLocalCandidate(input: HiddenVapPreviewOpenInput): Promise<HiddenVapPreviewModel> {
    const generation = this.beginOpenRequest();
    const validationIssue = validateOpenInput(input);
    if (validationIssue) {
      this.model = failedModel([validationIssue]);
      return this.getModel();
    }

    const displayName = safeSourceName(input.displayName ?? input.localPath) || "effect.mp4";
    const replacementIssues = validateFusionReplacementInput(input.fusionReplacements, input.localPath);
    if (replacementIssues.length > 0) {
      this.model = failedModel(replacementIssues, input.requestId, input.source, displayName);
      return this.getModel();
    }
    this.lastInput = cloneInput(input);
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
      this.model = failedModel(sourceResult.issues, input.requestId, input.source, displayName);
      return this.getModel();
    }
    const source = sourceResult.value;

    const detection = await this.probeService.probe(source, {
      gate: MULTIFORMAT_PREVIEW_WP1_GATE
    });
    if (!this.isActiveRequest(generation)) return this.getModel();
    if (detection.status !== "detected" || detection.format !== "vap") {
      this.model = {
        ...this.model,
        status: detection.status === "ambiguous" ? "failed" : "playbackBlocked",
        issues: detectionIssues(detection, source),
        playback: playbackState("error")
      };
      return this.getModel();
    }

    const fusionParams = flattenFusionReplacements(input.fusionReplacements);
    const inspection = await this.inspectionService.inspect(source, {
      gate: VAP_INSPECTION_READINESS_GATE,
      providedFusionTags: Object.keys(fusionParams)
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

    const preparation = this.preparationService.prepare(inspection.value, {
      gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
      dependencyApproval: "approved",
      hostReadiness: this.hostReadiness,
      providedFusionTags: Object.keys(fusionParams)
    });
    if (!this.isActiveRequest(generation)) return this.getModel();
    const surface = surfaceFromPreparation(inspection.value, preparation, displayName);
    this.model = {
      ...this.model,
      ...surface,
      status: "inspectionReady",
      playback: playbackState("idle", inspection.value.timing.durationMs)
    };
    if (!preparation.value || preparation.value.status !== "prepared") {
      this.model = {
        ...this.model,
        status: preparation.value?.status === "failed" ? "failed" : "playbackBlocked",
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    const vapConfig = vapConfigFromAsset(inspection.value);
    if (!vapConfig) {
      this.model = {
        ...this.model,
        status: "failed",
        issues: [
          ...this.model.issues,
          issue(
            "parse_precondition",
            "Hidden VAP playback requires the extracted vapc config object.",
            "error",
            { reason: "vapc_config_required" },
            source.id
          )
        ],
        playback: playbackState("error", inspection.value.timing.durationMs)
      };
      return this.getModel();
    }

    const objectUrl = await this.host.createLocalObjectUrl({
      localPath: input.localPath,
      mediaType: source.mediaType ?? "video/mp4"
    });
    if (!this.isActiveRequest(generation)) {
      await objectUrl.revoke();
      return this.getModel();
    }

    const playbackSource = createPlaybackSource(source, objectUrl, vapConfig, inspection, fusionParams);
    this.prepared = { input: cloneInput(input), source: playbackSource, inspection };
    await this.loadPreparedPlayback(generation);
    return this.getModel();
  }

  async play(): Promise<HiddenVapPreviewModel> {
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

  pause(): HiddenVapPreviewModel {
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

  seek(timeMs: number): HiddenVapPreviewModel {
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

  setLoop(loop: boolean): HiddenVapPreviewModel {
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

  async recoverPlayback(): Promise<HiddenVapPreviewModel> {
    if (this.isDisposed()) return this.getModel();
    if (!this.lastInput) return this.playbackOperationFailed("recover", "playback_recovery_unavailable");
    return this.openLocalCandidate({
      ...this.lastInput,
      requestId: `${this.lastInput.requestId}:recover`
    });
  }

  dispose(): HiddenVapPreviewModel {
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
  ): Promise<HiddenVapResult<MotionFormatProbeSource & VapInspectionSource>> {
    try {
      const stat = await this.host.statLocalFile(localPath);
      const displayName = safeSourceName(requestedDisplayName || stat.displayName || localPath) || "effect.mp4";
      const sizeBytes = stat.sizeBytes;
      const host = this.host;
      const source: MotionFormatProbeSource & VapInspectionSource = {
        id: localPath,
        name: displayName,
        sizeBytes,
        mediaType: stat.mediaType ?? mediaTypeFromPath(displayName),
        async read() {
          if (!Number.isFinite(sizeBytes) || sizeBytes > MOTION_FORMAT_PROBE_MAX_BYTES) {
            throw new Error("A bounded range read is required for this local VAP source.");
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
          "The hidden VAP preview host could not read local file metadata.",
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
    const adapter = new VapWebPlaybackAdapter({
      gate: VAP_WEB_PLAYBACK_WP3C_GATE,
      ...(this.runtimeLoader ? { runtimeLoader: this.runtimeLoader } : {})
    });
    const playbackSession = adapter.createSession({
      container: this.target,
      hostReadiness: this.hostReadiness
    });
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
            "Hidden VAP playback load failed.",
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
          throw new SupersededHiddenVapPreviewRequestError();
        }
      }
    };
  }

  private disposePlaybackSession(): void {
    this.playbackSession?.dispose();
    this.playbackSession = undefined;
  }

  private playbackOperationFailed(action: string, reason: string): HiddenVapPreviewModel {
    this.model = {
      ...this.model,
      status: "playbackFailed",
      issues: [
        ...this.model.issues,
        issue(
          "playback_failure",
          "Hidden VAP playback operation could not run.",
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
          "Hidden VAP playback operation failed.",
          "error",
          { action, reason, cause: redactLocalPathsFromError(error, "playback operation failed") }
        )
      ],
      playback: playbackState("error", this.model.playback.durationMs)
    };
  }
}

class SupersededHiddenVapPreviewRequestError extends Error {
  constructor() {
    super("Hidden VAP preview request was superseded.");
    this.name = "SupersededHiddenVapPreviewRequestError";
  }
}

function isSupersededRequestError(error: unknown): boolean {
  return error instanceof SupersededHiddenVapPreviewRequestError;
}

function validateOpenInput(input: HiddenVapPreviewOpenInput): HiddenVapPreviewIssue | undefined {
  if (input.gate !== HIDDEN_VAP_PREVIEW_VERTICAL_GATE) {
    return issue("unsupported", "Hidden VAP preview vertical is unavailable outside the authorized 0.2 gate.", "error", {
      reason: "gate_required"
    });
  }
  if (!isNonEmptyString(input.requestId) || !isOpenSource(input.source) || !isNonEmptyString(input.localPath)) {
    return issue("parse_precondition", "Hidden VAP preview open input is incomplete.", "error", {
      reason: "open_input_invalid"
    }, input.localPath);
  }
  return undefined;
}

function validateFusionReplacementInput(
  replacements: HiddenVapPreviewOpenInput["fusionReplacements"],
  sensitivePath: string
): HiddenVapPreviewIssue[] {
  const issues: HiddenVapPreviewIssue[] = [];
  for (const [srcTag, replacement] of Object.entries(replacements ?? {})) {
    const tag = srcTag.trim();
    if (!tag) {
      issues.push(issue(
        "parse_precondition",
        "VAP fusion replacement tags must be non-empty.",
        "error",
        { reason: "fusion_replacement_tag_required" },
        sensitivePath
      ));
      continue;
    }
    if (!isRecord(replacement) || (replacement.kind !== "image" && replacement.kind !== "text")) {
      issues.push(issue(
        "parse_precondition",
        "VAP fusion replacement values must declare image or text kind.",
        "error",
        { reason: "fusion_replacement_kind_required", srcTag: tag },
        sensitivePath
      ));
      continue;
    }
    if (typeof replacement.value !== "string") {
      issues.push(issue(
        "parse_precondition",
        "VAP fusion replacement values must be strings.",
        "error",
        { reason: "fusion_replacement_value_required", srcTag: tag, kind: replacement.kind },
        sensitivePath
      ));
      continue;
    }
    if (replacement.kind === "image" && !isSafeFusionImageReplacement(replacement.value)) {
      issues.push(issue(
        "unsupported_feature",
        "VAP fusion image replacements must be local object URLs or inline data images.",
        "error",
        { reason: "fusion_image_replacement_must_be_local", srcTag: tag },
        sensitivePath
      ));
    }
  }
  return issues;
}

function createPlaybackSource(
  source: MotionFormatProbeSource & VapInspectionSource,
  objectUrl: HiddenVapPreviewObjectUrl,
  vapConfig: Record<string, unknown>,
  inspection: WorkbenchResult<MotionAssetInfo>,
  fusionParams: Readonly<Record<string, unknown>>
): VapWebPlaybackSource {
  let released = false;
  return {
    ...source,
    objectUrl: objectUrl.objectUrl,
    vapConfig,
    inspection,
    fusionParams,
    async releaseObjectUrl() {
      if (released) return;
      released = true;
      await objectUrl.revoke();
    }
  };
}

function vapConfigFromAsset(asset: MotionAssetInfo): Record<string, unknown> | undefined {
  const vap = asset.metadata?.vap;
  if (!isRecord(vap)) return undefined;
  return isRecord(vap.config) ? vap.config : undefined;
}

function flattenFusionReplacements(
  replacements: HiddenVapPreviewOpenInput["fusionReplacements"]
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const [tag, replacement] of Object.entries(replacements ?? {})) {
    if (!tag.trim()) continue;
    params[tag] = replacement.value;
  }
  return params;
}

function surfaceFromPreparation(
  asset: MotionAssetInfo,
  preparation: ReturnType<VapPlaybackPreparationService["prepare"]>,
  displayName: string
): Pick<HiddenVapPreviewModel, "overview" | "fusionElements" | "issues"> {
  const container = preparation.value?.container;
  const fusionElements = preparation.value?.fusionElements ?? [];
  return {
    overview: {
      format: "vap",
      displayName,
      dimensions: dimensionsLabel(asset.dimensions),
      videoDimensions: dimensionsLabel(container?.videoDimensions),
      fps: asset.timing.fps,
      frameCount: asset.timing.frameCount,
      durationMs: asset.timing.durationMs,
      videoCodec: container?.videoCodec,
      audioPresent: container?.audioPresent === true,
      fusionElementCount: fusionElements.length,
      imageFusionCount: fusionElements.filter(({ kind }) => kind === "image").length,
      textFusionCount: fusionElements.filter(({ kind }) => kind === "text").length
    },
    fusionElements,
    issues: mapIssues([
      ...preparation.issues,
      ...(preparation.value?.issues ?? [])
    ], { id: displayName, name: displayName }, "playback_failure")
  };
}

function detectionIssues(
  detection: Awaited<ReturnType<MotionFormatProbeService["probe"]>>,
  source: MotionFormatProbeSource
): HiddenVapPreviewIssue[] {
  const fallbackCode: HiddenVapPreviewIssueCode = detection.status === "ambiguous" ? "ambiguous" : "unsupported";
  if (detection.issues.length > 0) return mapIssues(detection.issues, source, fallbackCode);
  return [issue(
    fallbackCode,
    "Hidden VAP preview requires a detected VAP/MP4 source with embedded vapc metadata.",
    "error",
    { reason: "vap_detection_required", detectedFormat: detection.format, status: detection.status },
    source.id
  )];
}

function mapIssues(
  entries: readonly WorkbenchIssue[],
  source: { id: string; name: string },
  fallbackCode: HiddenVapPreviewIssueCode
): HiddenVapPreviewIssue[] {
  return entries.map((entry) => issue(
    mapIssueCode(entry.code, fallbackCode),
    entry.message,
    entry.severity,
    {
      ...(entry.details ?? {}),
      originalCode: entry.code
    },
    source.id || source.name
  ));
}

function mapIssueCode(code: string, fallbackCode: HiddenVapPreviewIssueCode): HiddenVapPreviewIssueCode {
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
    return code as HiddenVapPreviewIssueCode;
  }
  return fallbackCode;
}

function issue(
  code: HiddenVapPreviewIssueCode,
  message: string,
  severity: WorkbenchIssue["severity"],
  details: Readonly<Record<string, unknown>> = {},
  sensitivePath?: string
): HiddenVapPreviewIssue {
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
  issues: readonly HiddenVapPreviewIssue[],
  requestId?: string,
  openedFrom?: HiddenVapPreviewOpenSource,
  displayName?: string
): HiddenVapPreviewModel {
  return {
    ...idleModel(),
    status: "failed",
    requestId,
    openedFrom,
    displayName,
    issues,
    playback: playbackState("error")
  };
}

function idleModel(): HiddenVapPreviewModel {
  return {
    schemaVersion: HIDDEN_VAP_PREVIEW_SCHEMA_VERSION,
    source: "hidden-0.2-vap-preview-runtime-vertical",
    status: "idle",
    pathRedacted: true,
    rendererHasFullPath: false,
    fusionElements: [],
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

function dimensionsLabel(dimensions: { width: number; height: number } | undefined): string | undefined {
  return dimensions ? `${dimensions.width} x ${dimensions.height}` : undefined;
}

function cloneModel(model: HiddenVapPreviewModel): HiddenVapPreviewModel {
  return {
    ...model,
    overview: model.overview ? { ...model.overview } : undefined,
    fusionElements: model.fusionElements.map((entry) => ({
      ...entry,
      zValues: [...entry.zValues],
      placementSamples: [...entry.placementSamples]
    })),
    issues: model.issues.map((entry) => ({
      ...entry,
      details: entry.details ? { ...entry.details } : undefined
    })),
    playback: { ...model.playback }
  };
}

function cloneInput(input: HiddenVapPreviewOpenInput): HiddenVapPreviewOpenInput {
  return {
    ...input,
    fusionReplacements: input.fusionReplacements
      ? Object.fromEntries(Object.entries(input.fusionReplacements).map(([key, value]) => [key, { ...value }]))
      : undefined
  };
}

function mediaTypeFromPath(pathValue: string): string {
  return /\.(mp4|vap)$/iu.test(pathValue) ? "video/mp4" : "application/octet-stream";
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

function isOpenSource(value: string): value is HiddenVapPreviewOpenSource {
  return value === "fileButton" || value === "dragDrop" || value === "menuOpen";
}

function isSafeFusionImageReplacement(value: string): boolean {
  return /^blob:/iu.test(value) || /^data:image\//iu.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
