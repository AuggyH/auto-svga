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
  LOTTIE_JSON_INSPECTION_WP2A_GATE,
  LottieJsonInspectionService,
  type LottieJsonInspectionSource
} from "./lottie-json-inspection.js";
import {
  redactLocalPathsFromError,
  redactLocalPathsInValue
} from "./local-path-redaction.js";
import { MOTION_FORMAT_PROBE_MAX_BYTES } from "./motion-format-registry.js";

export const LOTTIE_SVG_PLAYBACK_WP2B_GATE = "0.2-multiformat-preview-wp2b" as const;
export const LOTTIE_WEB_SVG_ENTRYPOINT = "lottie-web/build/player/lottie_svg" as const;
export const LOTTIE_WEB_SVG_NODE_NEXT_ENTRYPOINT = `${LOTTIE_WEB_SVG_ENTRYPOINT}.js` as const;

export type LottieSvgPlaybackIssueCode =
  | "unsupported"
  | "missing_dependency"
  | "parse_precondition"
  | "unsupported_feature"
  | "renderer_failure";

export interface LottieSvgPlaybackIssue extends WorkbenchIssue {
  code: LottieSvgPlaybackIssueCode;
}

export interface LottieSvgPlaybackTarget {
  container: unknown;
}

export interface LottieSvgRendererModule {
  loadAnimation(options: LottieSvgLoadOptions): LottieSvgAnimationItem;
}

export interface LottieSvgLoadOptions {
  container: unknown;
  renderer: "svg";
  loop: boolean;
  autoplay: boolean;
  animationData: unknown;
}

export interface LottieSvgAnimationItem {
  play(): void;
  pause(): void;
  destroy(): void;
  goToAndStop(frameOrTime: number, isFrame?: boolean): void;
  addEventListener?(eventName: string, handler: () => void): void;
  removeEventListener?(eventName: string, handler: () => void): void;
  currentFrame?: number;
  frameRate?: number;
  loop?: boolean;
  setLoop?(loop: boolean): void;
}

export type LottieSvgRendererLoader = () => Promise<LottieSvgRendererModule>;

export interface LottieSvgPlaybackAdapterOptions {
  gate: string;
  rendererLoader?: LottieSvgRendererLoader;
  inspectionService?: LottieJsonInspectionService;
  allowResolvedImageResources?: boolean;
}

interface SourceFeedback {
  sourceName: string;
  issuePath?: string;
  sensitivePaths: readonly string[];
}

interface BoundedJsonResult {
  value?: unknown;
  issue?: LottieSvgPlaybackIssue;
}

export class LottieSvgPlaybackAdapter implements PlaybackAdapter<LottieSvgPlaybackTarget> {
  readonly format = "lottie" as const;

  private readonly gate: string;
  private readonly rendererLoader: LottieSvgRendererLoader;
  private readonly inspectionService: LottieJsonInspectionService;
  private readonly allowResolvedImageResources: boolean;

  constructor(options: LottieSvgPlaybackAdapterOptions) {
    this.gate = options.gate;
    this.rendererLoader = options.rendererLoader ?? loadDefaultLottieSvgRenderer;
    this.inspectionService = options.inspectionService ?? new LottieJsonInspectionService();
    this.allowResolvedImageResources = options.allowResolvedImageResources === true;
  }

  createSession(target: LottieSvgPlaybackTarget): PlaybackSession {
    return new LottieSvgPlaybackSession(
      target,
      this.gate,
      this.rendererLoader,
      this.inspectionService,
      this.allowResolvedImageResources
    );
  }
}

export async function loadDefaultLottieSvgRenderer(): Promise<LottieSvgRendererModule> {
  try {
    const loaded = await importLottieSvgRenderer();
    const candidates = [
      loaded,
      hasDefaultExport(loaded) ? loaded.default : undefined,
      (globalThis as { lottie?: unknown }).lottie
    ];
    for (const candidate of candidates) {
      if (isLottieSvgRendererModule(candidate)) return candidate;
    }
  } catch (error) {
    throw new Error(redactLocalPathsFromError(
      error,
      `The approved Lottie SVG renderer dependency could not be loaded from ${LOTTIE_WEB_SVG_ENTRYPOINT}.`
    ));
  }
  throw new Error(`The approved Lottie SVG renderer entry point did not expose loadAnimation.`);
}

async function importLottieSvgRenderer(): Promise<unknown> {
  try {
    return await import("lottie-web/build/player/lottie_svg");
  } catch (error) {
    if (isModuleResolutionError(error)) {
      return import(LOTTIE_WEB_SVG_NODE_NEXT_ENTRYPOINT);
    }
    throw error;
  }
}

class LottieSvgPlaybackSession implements PlaybackSession {
  private readonly target: LottieSvgPlaybackTarget;
  private readonly gate: string;
  private readonly rendererLoader: LottieSvgRendererLoader;
  private readonly inspectionService: LottieJsonInspectionService;
  private readonly allowResolvedImageResources: boolean;
  private animation?: LottieSvgAnimationItem;
  private rendererFailureBinding?: {
    animation: LottieSvgAnimationItem;
    handler: () => void;
  };
  private state: PlaybackState = {
    status: "idle",
    currentTimeMs: 0,
    loop: false
  };

  constructor(
    target: LottieSvgPlaybackTarget,
    gate: string,
    rendererLoader: LottieSvgRendererLoader,
    inspectionService: LottieJsonInspectionService,
    allowResolvedImageResources: boolean
  ) {
    this.target = target;
    this.gate = gate;
    this.rendererLoader = rendererLoader;
    this.inspectionService = inspectionService;
    this.allowResolvedImageResources = allowResolvedImageResources;
  }

  async load(
    source: MotionAssetSource,
    context?: WorkbenchOperationContext
  ): Promise<WorkbenchResult<MotionAssetInfo>> {
    const feedback = sourceFeedback(source);
    if (this.state.status === "disposed") {
      return this.fail(issue(
        feedback,
        "unsupported",
        "Disposed Lottie playback sessions cannot be loaded.",
        { reason: "session_disposed" }
      ));
    }
    if (this.gate !== LOTTIE_SVG_PLAYBACK_WP2B_GATE) {
      return this.fail(issue(
        feedback,
        "unsupported",
        "Lottie SVG playback is unavailable outside the authorized 0.2-WP2B gate.",
        { reason: "gate_required" }
      ));
    }
    if (!isUsableTarget(this.target)) {
      return this.fail(issue(
        feedback,
        "parse_precondition",
        "Lottie SVG playback requires a renderer target container.",
        { reason: "target_container_required" }
      ));
    }

    this.disposeAnimation();
    this.state = { ...this.state, status: "loading", currentTimeMs: 0 };
    context?.cancellation?.throwIfCancelled();
    const inspected = await this.inspectionService.inspect(
      source as LottieJsonInspectionSource,
      { gate: LOTTIE_JSON_INSPECTION_WP2A_GATE, context }
    );
    context?.cancellation?.throwIfCancelled();

    const preconditionIssues = playbackPreconditionIssues(inspected, feedback, {
      allowResolvedImageResources: this.allowResolvedImageResources
    });
    if (preconditionIssues.length > 0 || !inspected.value) {
      return this.fail(...preconditionIssues.length > 0
        ? preconditionIssues
        : [issue(
          feedback,
          "parse_precondition",
          "Lottie SVG playback requires a successful WP2A inspection result.",
          { reason: "inspection_value_required" }
        )]);
    }

    const animationData = await readBoundedAnimationData(source, feedback);
    if (!animationData.value) {
      return this.fail(animationData.issue ?? issue(
        feedback,
        "parse_precondition",
        "Lottie SVG playback requires bounded inline animationData.",
        { reason: "animation_data_required" }
      ));
    }

    let renderer: LottieSvgRendererModule;
    try {
      renderer = await this.rendererLoader();
    } catch (error) {
      return this.fail(issue(
        feedback,
        "missing_dependency",
        "The approved Lottie SVG renderer dependency is unavailable.",
        {
          reason: "lottie_svg_renderer_missing",
          dependency: "lottie-web@5.13.0",
          entryPoint: LOTTIE_WEB_SVG_ENTRYPOINT,
          cause: redactLocalPathsFromError(error, "renderer dependency load failed", feedback.sensitivePaths)
        }
      ));
    }

    try {
      const animation = renderer.loadAnimation({
        container: this.target.container,
        renderer: "svg",
        loop: this.state.loop,
        autoplay: false,
        animationData: animationData.value
      });
      this.animation = animation;
      this.bindRendererFailure(animation);
      this.state = {
        status: "ready",
        currentTimeMs: 0,
        durationMs: inspected.value.timing.durationMs,
        loop: this.state.loop
      };
      return { value: inspected.value, issues: inspected.issues };
    } catch (error) {
      this.disposeAnimation();
      return this.fail(issue(
        feedback,
        "renderer_failure",
        "The Lottie SVG renderer could not load the bounded animationData.",
        {
          reason: "renderer_load_failed",
          cause: redactLocalPathsFromError(error, "renderer load failed", feedback.sensitivePaths)
        }
      ));
    }
  }

  async play(): Promise<void> {
    this.assertActiveAnimation("play");
    this.animation?.play();
    this.state = { ...this.state, status: "playing" };
  }

  pause(): void {
    if (this.state.status === "disposed") return;
    this.animation?.pause();
    if (this.animation) this.state = { ...this.state, status: "paused" };
  }

  seek(timeMs: number): void {
    this.assertActiveAnimation("seek");
    const safeTimeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
    this.animation?.goToAndStop(safeTimeMs, false);
    this.state = { ...this.state, currentTimeMs: safeTimeMs, status: "paused" };
  }

  async replay(): Promise<void> {
    this.seek(0);
    await this.play();
  }

  setLoop(loop: boolean): void {
    this.state = { ...this.state, loop };
    if (this.animation?.setLoop) {
      this.animation.setLoop(loop);
    } else if (this.animation) {
      this.animation.loop = loop;
    }
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  dispose(): void {
    this.disposeAnimation();
    this.state = {
      status: "disposed",
      currentTimeMs: 0,
      durationMs: this.state.durationMs,
      loop: this.state.loop
    };
  }

  private fail(...issues: LottieSvgPlaybackIssue[]): WorkbenchResult<MotionAssetInfo> {
    this.state = { ...this.state, status: "error" };
    return { issues };
  }

  private assertActiveAnimation(action: string): void {
    if (this.state.status === "disposed") {
      throw new Error(`Cannot ${action} a disposed Lottie playback session.`);
    }
    if (!this.animation) {
      throw new Error(`Cannot ${action} before a Lottie animation is loaded.`);
    }
  }

  private bindRendererFailure(animation: LottieSvgAnimationItem): void {
    const handler = () => {
      if (this.animation !== animation || this.state.status === "disposed") return;
      this.disposeAnimation();
      this.state = { ...this.state, status: "error" };
    };
    animation.addEventListener?.("data_failed", handler);
    animation.addEventListener?.("error", handler);
    this.rendererFailureBinding = { animation, handler };
  }

  private disposeAnimation(): void {
    const animation = this.animation;
    this.animation = undefined;
    const binding = this.rendererFailureBinding;
    this.rendererFailureBinding = undefined;
    if (binding && binding.animation === animation) {
      animation?.removeEventListener?.("data_failed", binding.handler);
      animation?.removeEventListener?.("error", binding.handler);
    }
    animation?.destroy();
  }
}

function playbackPreconditionIssues(
  inspected: WorkbenchResult<MotionAssetInfo>,
  feedback: SourceFeedback,
  options: { allowResolvedImageResources: boolean }
): LottieSvgPlaybackIssue[] {
  const errors = inspected.issues.filter(({ severity }) => severity === "error");
  if (errors.length > 0) {
    return errors.map((entry) => issue(
      feedback,
      "parse_precondition",
      "Lottie SVG playback requires WP2A inspection preconditions to pass.",
      {
        reason: "inspection_precondition_failed",
        inspectionCode: entry.code,
        inspectionDetails: entry.details
      }
    ));
  }

  const unsupported = inspected.issues.filter(({ code }) => code === "unsupported_feature");
  if (unsupported.length > 0) {
    return unsupported.map((entry) => issue(
      feedback,
      "unsupported_feature",
      "Unsupported Lottie features must not be silently played in the WP2B spike.",
      {
        reason: "unsupported_feature_precondition",
        inspectionCode: entry.code,
        inspectionDetails: entry.details
      }
    ));
  }

  const resources = inspected.value?.resources ?? [];
  const deferredResources = resources.filter(({ kind }) =>
    kind === "font" || (kind === "image" && !options.allowResolvedImageResources)
  );
  if (deferredResources.length > 0) {
    return [issue(
      feedback,
      "parse_precondition",
      options.allowResolvedImageResources
        ? "External Lottie font resources are deferred from the hidden Lottie preview spike."
        : "External Lottie image and font resources are deferred from the animationData-only WP2B spike.",
      {
        reason: options.allowResolvedImageResources
          ? "external_font_resources_deferred"
          : "external_resources_deferred",
        resourceIds: deferredResources.map(({ id }) => id),
        resourceKinds: deferredResources.map(({ kind }) => kind)
      }
    )];
  }

  return [];
}

async function readBoundedAnimationData(
  source: MotionAssetSource,
  feedback: SourceFeedback
): Promise<BoundedJsonResult> {
  try {
    if (!Number.isFinite(source.sizeBytes) || source.sizeBytes < 0) {
      return {
        issue: issue(feedback, "parse_precondition", "Bounded animationData size is required.", {
          reason: "bounded_read_required"
        })
      };
    }
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
        issue: issue(feedback, "parse_precondition", "Complete bounded JSON is required for Lottie SVG playback.", {
          reason: "complete_bounded_animation_data_required"
        })
      };
    }
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch (error) {
    return {
      issue: issue(
        feedback,
        "parse_precondition",
        "Lottie SVG playback requires valid bounded JSON animationData.",
        {
          reason: "valid_animation_data_required",
          cause: redactLocalPathsFromError(error, "animationData parse failed", feedback.sensitivePaths)
        }
      )
    };
  }
}

function issue(
  feedback: SourceFeedback,
  code: LottieSvgPlaybackIssueCode,
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): LottieSvgPlaybackIssue {
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
  const sourceName = safeSourceName(source.name) || safeSourceName(source.id) || "lottie.json";
  return {
    sourceName,
    issuePath: sensitivePaths.length > 0 ? "[local path]" : undefined,
    sensitivePaths
  };
}

function isUsableTarget(target: LottieSvgPlaybackTarget): boolean {
  return !!target && !!target.container;
}

function isLottieSvgRendererModule(value: unknown): value is LottieSvgRendererModule {
  return !!value
    && typeof value === "object"
    && typeof (value as { loadAnimation?: unknown }).loadAnimation === "function";
}

function hasDefaultExport(value: unknown): value is { default: unknown } {
  return !!value && typeof value === "object" && "default" in value;
}

function isModuleResolutionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /Cannot find module|ERR_MODULE_NOT_FOUND|Did you mean to import/u.test(error.message);
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
