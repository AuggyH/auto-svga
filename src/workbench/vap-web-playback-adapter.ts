import type {
  MotionAssetInfo,
  MotionAssetSource,
  PlaybackAdapter,
  PlaybackSession,
  PlaybackState,
  WorkbenchIssue,
  WorkbenchOperationContext,
  WorkbenchResult
} from "./contracts.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import {
  VAP_OFFICIAL_WEB_ENTRYPOINT,
  VAP_OFFICIAL_WEB_PACKAGE,
  VAP_OFFICIAL_WEB_VERSION,
  VAP_PLAYBACK_PREPARATION_WP3B_GATE,
  VapPlaybackPreparationService,
  type VapPlaybackHostReadiness
} from "./vap-playback-preparation.js";

export const VAP_WEB_PLAYBACK_WP3C_GATE = "0.2-wp3c-vap-web-playback-runtime" as const;
export const VAP_WEB_APPROVED_DEPENDENCY = `${VAP_OFFICIAL_WEB_PACKAGE}@${VAP_OFFICIAL_WEB_VERSION}` as const;

export type VapWebPlaybackIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "missing_resource"
  | "parse_precondition"
  | "ambiguous"
  | "capability"
  | "unsupported_feature"
  | "playback_failure";

export interface VapWebPlaybackIssue extends WorkbenchIssue {
  code: VapWebPlaybackIssueCode;
}

export interface VapWebPlaybackTarget {
  container: unknown;
  hostReadiness?: VapPlaybackHostReadiness;
}

export interface VapRuntimeConfig {
  container: unknown;
  src: string;
  config: string | Record<string, unknown>;
  fps?: number;
  width?: number;
  height?: number;
  loop: boolean;
  mute?: boolean;
  precache?: boolean;
  accurate: boolean;
  onLoadError?: (error: unknown) => void;
  onDestory?: () => void;
  [key: string]: unknown;
}

export interface VapRuntimePlayer {
  on?(eventName: string, callback: (...args: unknown[]) => void): VapRuntimePlayer;
  destroy(): void;
  pause(): void;
  play(options?: VapRuntimeConfig): VapRuntimePlayer;
  setTime(seconds: number): void;
}

export type VapRuntimeConstructor = (options?: VapRuntimeConfig) => VapRuntimePlayer;
export type VapRuntimeLoader = () => Promise<VapRuntimeConstructor>;

export interface VapWebPlaybackSource extends MotionAssetSource {
  objectUrl: string;
  vapConfig: Record<string, unknown>;
  inspection: WorkbenchResult<MotionAssetInfo>;
  fusionParams?: Readonly<Record<string, unknown>>;
  releaseObjectUrl?(): void | Promise<void>;
}

export interface VapWebPlaybackAdapterOptions {
  gate: string;
  runtimeLoader?: VapRuntimeLoader;
  preparationService?: VapPlaybackPreparationService;
}

interface SourceFeedback {
  sourceName: string;
  issuePath?: string;
  sensitivePaths: readonly string[];
}

interface ActiveRuntime {
  generation: number;
  player?: VapRuntimePlayer;
  source?: VapWebPlaybackSource;
}

export class VapWebPlaybackAdapter implements PlaybackAdapter<VapWebPlaybackTarget> {
  readonly format = "vap" as const;

  private readonly gate: string;
  private readonly runtimeLoader: VapRuntimeLoader;
  private readonly preparationService: VapPlaybackPreparationService;

  constructor(options: VapWebPlaybackAdapterOptions) {
    this.gate = options.gate;
    this.runtimeLoader = options.runtimeLoader ?? loadDefaultVapRuntime;
    this.preparationService = options.preparationService ?? new VapPlaybackPreparationService();
  }

  createSession(target: VapWebPlaybackTarget): PlaybackSession {
    return new VapWebPlaybackSession(target, this.gate, this.runtimeLoader, this.preparationService);
  }
}

export async function loadDefaultVapRuntime(): Promise<VapRuntimeConstructor> {
  try {
    const loaded = await import("video-animation-player");
    const loadedValue: unknown = loaded;
    const defaultExport = hasDefaultExport(loadedValue) ? loadedValue.default : undefined;
    const nestedDefault = hasDefaultExport(defaultExport) ? defaultExport.default : undefined;
    const candidates = [
      loadedValue,
      defaultExport,
      nestedDefault
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "function") return candidate as VapRuntimeConstructor;
    }
  } catch (error) {
    throw new Error(redactLocalPathsFromError(
      error,
      `The approved VAP Web runtime dependency could not be loaded from ${VAP_OFFICIAL_WEB_ENTRYPOINT}.`
    ));
  }
  throw new Error(`The approved VAP Web runtime entry point did not expose a constructor.`);
}

class VapWebPlaybackSession implements PlaybackSession {
  private readonly target: VapWebPlaybackTarget;
  private readonly gate: string;
  private readonly runtimeLoader: VapRuntimeLoader;
  private readonly preparationService: VapPlaybackPreparationService;
  private active?: ActiveRuntime;
  private generation = 0;
  private state: PlaybackState = {
    status: "idle",
    currentTimeMs: 0,
    loop: false
  };

  constructor(
    target: VapWebPlaybackTarget,
    gate: string,
    runtimeLoader: VapRuntimeLoader,
    preparationService: VapPlaybackPreparationService
  ) {
    this.target = target;
    this.gate = gate;
    this.runtimeLoader = runtimeLoader;
    this.preparationService = preparationService;
  }

  async load(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    const feedback = sourceFeedback(source);
    if (this.state.status === "disposed") {
      return { issues: [issue(
        feedback,
        "unsupported",
        "Disposed VAP playback sessions cannot be loaded.",
        { reason: "session_disposed" }
      )] };
    }
    const generation = this.nextGeneration();
    this.disposeActive();
    this.state = { ...this.state, status: "loading", currentTimeMs: 0 };

    if (this.gate !== VAP_WEB_PLAYBACK_WP3C_GATE) {
      return this.failAndRelease(source, feedback, issue(
        feedback,
        "unsupported",
        "VAP Web playback is unavailable outside the authorized 0.2-WP3C gate.",
        { reason: "gate_required" }
      ));
    }
    if (!isUsableTarget(this.target)) {
      return this.failAndRelease(source, feedback, issue(
        feedback,
        "parse_precondition",
        "VAP Web playback requires a renderer target container.",
        { reason: "target_container_required" }
      ));
    }
    if (!isVapPlaybackSource(source)) {
      return this.fail(feedback, issue(
        feedback,
        "parse_precondition",
        "VAP Web playback requires a prepared local object URL source.",
        { reason: "prepared_vap_playback_source_required" }
      ));
    }
    if (!isLocalObjectUrl(source.objectUrl)) {
      return this.failAndRelease(source, feedback, issue(
        feedback,
        "parse_precondition",
        "VAP Web playback only accepts host-created local object URLs.",
        { reason: "local_object_url_required" }
      ));
    }
    if (!source.inspection.value) {
      return this.failAndRelease(source, feedback, issue(
        feedback,
        "parse_precondition",
        "VAP Web playback requires a successful VAP inspection result.",
        { reason: "inspection_value_required" }
      ));
    }

    await throwIfCancelledAndRelease(context, source);
    const preparation = this.preparationService.prepare(source.inspection.value, {
      gate: VAP_PLAYBACK_PREPARATION_WP3B_GATE,
      dependencyApproval: "approved",
      hostReadiness: this.target.hostReadiness,
      providedFusionTags: Object.keys(source.fusionParams ?? {}),
      context
    });
    const blockingIssues = playbackBlockingIssues(preparation, feedback);
    if (blockingIssues.length > 0 || !preparation.value || preparation.value.status !== "prepared") {
      return this.failAndRelease(source, feedback, ...blockingIssues.length > 0
        ? blockingIssues
        : [issue(
          feedback,
          "parse_precondition",
          "VAP Web playback requires a prepared runtime model.",
          { reason: "vap_preparation_required" }
        )]);
    }

    let runtime: VapRuntimeConstructor;
    try {
      runtime = await this.runtimeLoader();
    } catch (error) {
      return this.failAndRelease(source, feedback, issue(
        feedback,
        "missing_dependency",
        "The approved VAP Web runtime dependency is unavailable.",
        {
          reason: "vap_web_runtime_missing",
          dependency: VAP_WEB_APPROVED_DEPENDENCY,
          entryPoint: VAP_OFFICIAL_WEB_ENTRYPOINT,
          cause: redactLocalPathsFromError(error, "runtime dependency load failed", feedback.sensitivePaths)
        }
      ));
    }
    await throwIfCancelledAndRelease(context, source);

    if (!this.isActiveGeneration(generation)) {
      await releasePreparedSource(source);
      return { issues: [] };
    }

    const config: VapRuntimeConfig = {
      container: this.target.container,
      src: source.objectUrl,
      config: source.vapConfig,
      fps: source.inspection.value.timing.fps,
      width: source.inspection.value.dimensions?.width,
      height: source.inspection.value.dimensions?.height,
      loop: this.state.loop,
      mute: true,
      precache: false,
      accurate: true,
      ...source.fusionParams,
      onLoadError: (error) => {
        this.handleRuntimeError(generation, source, error);
      },
      onDestory: () => {
        if (this.isActiveGeneration(generation)) {
          this.state = { ...this.state, status: "disposed" };
        }
      }
    };

    try {
      await throwIfCancelledAndRelease(context, source);
      const player = runtime(config);
      if (!isVapRuntimePlayer(player)) {
        throw new Error("VAP runtime constructor did not return a usable player.");
      }
      this.active = { generation, player, source };
      this.bindRuntimeErrors(generation, player, source);
      this.state = {
        status: "ready",
        currentTimeMs: 0,
        durationMs: source.inspection.value.timing.durationMs,
        loop: this.state.loop
      };
      return { value: source.inspection.value, issues: [...source.inspection.issues] };
    } catch (error) {
      await releasePreparedSource(source);
      return this.fail(feedback, issue(
        feedback,
        "playback_failure",
        "The VAP Web runtime could not load the prepared local source.",
        {
          reason: "runtime_constructor_failed",
          cause: redactLocalPathsFromError(error, "runtime constructor failed", feedback.sensitivePaths)
        }
      ));
    }
  }

  async play(): Promise<void> {
    this.assertActivePlayer("play");
    this.active?.player?.play();
    this.state = { ...this.state, status: "playing" };
  }

  pause(): void {
    if (this.state.status === "disposed") return;
    this.active?.player?.pause();
    if (this.active?.player) this.state = { ...this.state, status: "paused" };
  }

  seek(timeMs: number): void {
    this.assertActivePlayer("seek");
    const safeTimeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
    this.active?.player?.setTime(safeTimeMs / 1000);
    this.state = { ...this.state, currentTimeMs: safeTimeMs, status: "paused" };
  }

  async replay(): Promise<void> {
    this.seek(0);
    await this.play();
  }

  setLoop(loop: boolean): void {
    if (this.state.status === "disposed") return;
    this.state = { ...this.state, loop };
    const active = this.active;
    if (active?.player && active.source) {
      active.player.play({
        container: this.target.container,
        src: active.source.objectUrl,
        config: active.source.vapConfig,
        fps: active.source.inspection.value?.timing.fps,
        width: active.source.inspection.value?.dimensions?.width,
        height: active.source.inspection.value?.dimensions?.height,
        loop,
        mute: true,
        precache: false,
        accurate: true,
        ...active.source.fusionParams
      });
    }
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  dispose(): void {
    this.generation += 1;
    this.disposeActive();
    this.state = {
      status: "disposed",
      currentTimeMs: 0,
      durationMs: this.state.durationMs,
      loop: this.state.loop
    };
  }

  private nextGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  private isActiveGeneration(generation: number): boolean {
    return this.generation === generation && this.state.status !== "disposed";
  }

  private bindRuntimeErrors(generation: number, player: VapRuntimePlayer, source: VapWebPlaybackSource): void {
    player.on?.("error", (error) => this.handleRuntimeError(generation, source, error));
  }

  private handleRuntimeError(generation: number, source: VapWebPlaybackSource, error: unknown): void {
    if (!this.isActiveGeneration(generation) || this.active?.source !== source) return;
    this.disposeActive();
    this.state = { ...this.state, status: "error" };
    void error;
  }

  private disposeActive(): void {
    const active = this.active;
    this.active = undefined;
    try {
      active?.player?.pause();
    } catch {}
    try {
      active?.player?.destroy();
    } catch {}
    if (active?.source) void releasePreparedSource(active.source);
  }

  private fail(feedback: SourceFeedback, ...issues: VapWebPlaybackIssue[]): WorkbenchResult<MotionAssetInfo> {
    this.state = { ...this.state, status: "error" };
    return { issues: issues.length > 0 ? issues : [issue(
      feedback,
      "playback_failure",
      "VAP Web playback failed.",
      { reason: "playback_failed" }
    )] };
  }

  private failAndRelease(
    source: MotionAssetSource,
    feedback: SourceFeedback,
    ...issues: VapWebPlaybackIssue[]
  ): WorkbenchResult<MotionAssetInfo> {
    if (isVapPlaybackSource(source)) void releasePreparedSource(source);
    return this.fail(feedback, ...issues);
  }

  private assertActivePlayer(action: string): void {
    if (this.state.status === "disposed") {
      throw new Error(`Cannot ${action} a disposed VAP playback session.`);
    }
    if (!this.active?.player) {
      throw new Error(`Cannot ${action} before a VAP animation is loaded.`);
    }
  }
}

function playbackBlockingIssues(
  preparation: WorkbenchResult<{ status: string; issues: readonly WorkbenchIssue[] }>,
  feedback: SourceFeedback
): VapWebPlaybackIssue[] {
  const issues = [...preparation.issues, ...(preparation.value?.issues ?? [])];
  return issues
    .filter(({ severity, code }) => severity === "error" || code !== "missing_dependency")
    .map((entry) => issue(
      feedback,
      mapIssueCode(entry.code),
      "VAP Web playback requires all preparation preconditions to pass.",
      {
        reason: "preparation_precondition_failed",
        preparationCode: entry.code,
        preparationDetails: entry.details
      }
    ));
}

function mapIssueCode(code: string): VapWebPlaybackIssueCode {
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
    return code as VapWebPlaybackIssueCode;
  }
  return "playback_failure";
}

function isVapPlaybackSource(source: MotionAssetSource): source is VapWebPlaybackSource {
  const candidate = source as Partial<VapWebPlaybackSource>;
  return typeof candidate.objectUrl === "string"
    && isRecord(candidate.vapConfig)
    && !!candidate.inspection
    && typeof candidate.inspection === "object";
}

function isLocalObjectUrl(value: string): boolean {
  return /^blob:/u.test(value);
}

function isUsableTarget(target: VapWebPlaybackTarget): boolean {
  return !!target && !!target.container;
}

function isVapRuntimePlayer(value: unknown): value is VapRuntimePlayer {
  if (!value || typeof value !== "object") return false;
  const player = value as Partial<VapRuntimePlayer>;
  return typeof player.destroy === "function"
    && typeof player.pause === "function"
    && typeof player.play === "function"
    && typeof player.setTime === "function";
}

function hasDefaultExport(value: unknown): value is { default: unknown } {
  return !!value && typeof value === "object" && "default" in value;
}

async function releasePreparedSource(source: VapWebPlaybackSource): Promise<void> {
  try {
    await source.releaseObjectUrl?.();
  } catch {}
}

async function throwIfCancelledAndRelease(
  context: WorkbenchOperationContext | undefined,
  source: VapWebPlaybackSource
): Promise<void> {
  try {
    context?.cancellation?.throwIfCancelled();
  } catch (error) {
    await releasePreparedSource(source);
    throw error;
  }
}

function issue(
  feedback: SourceFeedback,
  code: VapWebPlaybackIssueCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): VapWebPlaybackIssue {
  return {
    severity: "error",
    code,
    message,
    path: feedback.issuePath,
    details: redactLocalPathsInValue({
      sourceName: feedback.sourceName,
      ...details
    }, feedback.sensitivePaths)
  };
}

function sourceFeedback(source: MotionAssetSource): SourceFeedback {
  const sensitivePaths = [source.id, source.name].filter((value) => isPathLike(value));
  const sourceName = safeSourceName(source.name) || safeSourceName(source.id) || "effect.mp4";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
