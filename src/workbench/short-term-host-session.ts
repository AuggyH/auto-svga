import {
  clearShortTermHostRecentFiles,
  closeShortTermHostFile,
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile,
  openShortTermHostRecentFile,
  applyShortTermHostTextPreview,
  cancelShortTermHostTransientWorkflow,
  prepareShortTermHostTextPreview,
  resetShortTermHostImageReplacement,
  runShortTermHostImageKeyRename,
  runShortTermHostImageReplacement,
  runShortTermHostOptimization,
  saveShortTermHostOutput,
  recoverShortTermHostPlayback,
  reportShortTermHostPlaybackFailure,
  resetShortTermHostTextPreview,
  type ShortTermHostActionResult,
  type ShortTermHostActionState,
  type ShortTermHostApplyTextPreviewInput,
  type ShortTermHostCloseInput,
  type ShortTermHostDirtyOperationInput,
  type ShortTermHostEnvironment,
  type ShortTermHostMenuActionInput,
  type ShortTermHostOpenLocalFileInput,
  type ShortTermHostOpenRecentFileInput,
  type ShortTermHostPlaybackFailureInput,
  type ShortTermHostPrepareTextPreviewInput,
  type ShortTermHostSaveInput
} from "./short-term-host-actions.js";
import {
  createShortTermHostActionStateFromRecentStore,
  persistShortTermHostRecentFiles,
  type ShortTermRecentFilesStore
} from "./short-term-host-recent-persistence.js";
import {
  evaluateShortTermHostLifecycleRequest,
  type ShortTermHostLifecycleDecision,
  type ShortTermHostLifecycleRequestInput
} from "./short-term-host-lifecycle.js";
import { redactShortTermLocalPathsFromError } from "./short-term-local-path-redaction.js";
import { serializeShortTermRecentFilesState } from "./short-term-recent-files.js";
import type { ShortTermWorkbenchFacadeModel } from "./short-term-workbench-facade.js";

export const SHORT_TERM_HOST_SESSION_SCHEMA_VERSION = 1 as const;

export type ShortTermHostSessionRecentPersistenceStatus =
  | "notConfigured"
  | "unchanged"
  | "saved"
  | "failed";

export interface ShortTermHostSessionRecentPersistenceResult {
  schemaVersion: typeof SHORT_TERM_HOST_SESSION_SCHEMA_VERSION;
  source: "short-term-host-session";
  prdIds: readonly ["S16"];
  status: ShortTermHostSessionRecentPersistenceStatus;
  message: string;
  pathRedacted: true;
  diagnostic?: {
    code: string;
    message: string;
  };
}

export interface ShortTermHostSessionActionResult {
  schemaVersion: typeof SHORT_TERM_HOST_SESSION_SCHEMA_VERSION;
  source: "short-term-host-session";
  model: ShortTermWorkbenchFacadeModel;
  state: ShortTermHostActionState;
  actionResult?: ShortTermHostActionResult;
  recentPersistence: ShortTermHostSessionRecentPersistenceResult;
}

export interface ShortTermHostSessionRendererActionResult {
  schemaVersion: typeof SHORT_TERM_HOST_SESSION_SCHEMA_VERSION;
  source: "short-term-host-session-renderer";
  model: ShortTermWorkbenchFacadeModel;
  actionResult?: ShortTermHostActionResult;
  recentPersistence: ShortTermHostSessionRecentPersistenceResult;
  pathRedacted: true;
  hostStateIncluded: false;
  outputBytesIncluded: false;
}

export interface CreateShortTermHostSessionOptions {
  host: ShortTermHostEnvironment;
  recentStore?: ShortTermRecentFilesStore;
  initialState?: ShortTermHostActionState;
}

export interface ShortTermHostSession {
  getState(): ShortTermHostActionState;
  getModel(): ShortTermWorkbenchFacadeModel;
  openLocalFile(input: ShortTermHostOpenLocalFileInput): Promise<ShortTermHostSessionActionResult>;
  openRecentFile(input: ShortTermHostOpenRecentFileInput): Promise<ShortTermHostSessionActionResult>;
  clearRecentFiles(): Promise<ShortTermHostSessionActionResult>;
  closeFile(input?: ShortTermHostCloseInput): Promise<ShortTermHostSessionActionResult>;
  runOptimization(input?: ShortTermHostDirtyOperationInput): Promise<ShortTermHostSessionActionResult>;
  renameImageKey(
    fromImageKey: string,
    toImageKey: string,
    input?: ShortTermHostDirtyOperationInput
  ): Promise<ShortTermHostSessionActionResult>;
  replaceImagePreview(
    imageKey: string,
    pngBytes: Uint8Array,
    input?: ShortTermHostDirtyOperationInput
  ): Promise<ShortTermHostSessionActionResult>;
  saveOutput(input: ShortTermHostSaveInput): Promise<ShortTermHostSessionActionResult>;
  dispatchMenuAction(input: ShortTermHostMenuActionInput): Promise<ShortTermHostSessionActionResult>;
  cancelTransientWorkflow(): Promise<ShortTermHostSessionActionResult>;
  resetImageReplacementPreview(): Promise<ShortTermHostSessionActionResult>;
  prepareTextPreview(input: ShortTermHostPrepareTextPreviewInput): Promise<ShortTermHostSessionActionResult>;
  applyTextPreview(input: ShortTermHostApplyTextPreviewInput): Promise<ShortTermHostSessionActionResult>;
  resetTextPreview(): Promise<ShortTermHostSessionActionResult>;
  reportPlaybackFailure(input: ShortTermHostPlaybackFailureInput): Promise<ShortTermHostSessionActionResult>;
  recoverPlayback(): Promise<ShortTermHostSessionActionResult>;
  evaluateLifecycleRequest(input: ShortTermHostLifecycleRequestInput): ShortTermHostLifecycleDecision;
  persistRecentFiles(): Promise<ShortTermHostSessionRecentPersistenceResult>;
}

export async function createShortTermHostSession(
  options: CreateShortTermHostSessionOptions
): Promise<ShortTermHostSession> {
  const initialState = options.initialState
    ?? (options.recentStore
      ? await createShortTermHostActionStateFromRecentStore(options.recentStore)
      : createShortTermHostActionState());
  return new ShortTermHostSessionController(options.host, initialState, options.recentStore);
}

export function toShortTermHostSessionRendererResult(
  result: ShortTermHostSessionActionResult
): ShortTermHostSessionRendererActionResult {
  return {
    schemaVersion: SHORT_TERM_HOST_SESSION_SCHEMA_VERSION,
    source: "short-term-host-session-renderer",
    model: cloneShortTermWorkbenchFacadeModel(result.model),
    ...(result.actionResult ? { actionResult: cloneShortTermHostActionResult(result.actionResult) } : {}),
    recentPersistence: cloneShortTermHostSessionRecentPersistenceResult(result.recentPersistence),
    pathRedacted: true,
    hostStateIncluded: false,
    outputBytesIncluded: false
  };
}

class ShortTermHostSessionController implements ShortTermHostSession {
  private state: ShortTermHostActionState;
  private recentSnapshot: string;
  private actionQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly host: ShortTermHostEnvironment,
    initialState: ShortTermHostActionState,
    private readonly recentStore: ShortTermRecentFilesStore | undefined
  ) {
    this.state = cloneShortTermHostActionState(initialState);
    this.recentSnapshot = recentSignature(this.state);
  }

  getState(): ShortTermHostActionState {
    return cloneShortTermHostActionState(this.state);
  }

  getModel(): ShortTermWorkbenchFacadeModel {
    return cloneShortTermWorkbenchFacadeModel(this.state.facade.model);
  }

  async openLocalFile(input: ShortTermHostOpenLocalFileInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => openShortTermHostLocalFile(state, this.host, input));
  }

  async openRecentFile(input: ShortTermHostOpenRecentFileInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => openShortTermHostRecentFile(state, this.host, input));
  }

  async clearRecentFiles(): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => clearShortTermHostRecentFiles(state));
  }

  async closeFile(input: ShortTermHostCloseInput = {}): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => closeShortTermHostFile(state, input));
  }

  async runOptimization(input: ShortTermHostDirtyOperationInput = {}): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => runShortTermHostOptimization(state, input));
  }

  async renameImageKey(
    fromImageKey: string,
    toImageKey: string,
    input: ShortTermHostDirtyOperationInput = {}
  ): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => runShortTermHostImageKeyRename(state, fromImageKey, toImageKey, input));
  }

  async replaceImagePreview(
    imageKey: string,
    pngBytes: Uint8Array,
    input: ShortTermHostDirtyOperationInput = {}
  ): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => runShortTermHostImageReplacement(state, imageKey, pngBytes, input));
  }

  async saveOutput(input: ShortTermHostSaveInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => saveShortTermHostOutput(state, this.host, input));
  }

  async dispatchMenuAction(input: ShortTermHostMenuActionInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => dispatchShortTermHostMenuAction(state, this.host, input));
  }

  async cancelTransientWorkflow(): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => cancelShortTermHostTransientWorkflow(state));
  }

  async resetImageReplacementPreview(): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => resetShortTermHostImageReplacement(state));
  }

  async prepareTextPreview(input: ShortTermHostPrepareTextPreviewInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => prepareShortTermHostTextPreview(state, input));
  }

  async applyTextPreview(input: ShortTermHostApplyTextPreviewInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => applyShortTermHostTextPreview(state, input));
  }

  async resetTextPreview(): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => resetShortTermHostTextPreview(state));
  }

  async reportPlaybackFailure(input: ShortTermHostPlaybackFailureInput): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => reportShortTermHostPlaybackFailure(state, input));
  }

  async recoverPlayback(): Promise<ShortTermHostSessionActionResult> {
    return this.apply((state) => recoverShortTermHostPlayback(state));
  }

  evaluateLifecycleRequest(input: ShortTermHostLifecycleRequestInput): ShortTermHostLifecycleDecision {
    return evaluateShortTermHostLifecycleRequest(this.state, input);
  }

  async persistRecentFiles(): Promise<ShortTermHostSessionRecentPersistenceResult> {
    return this.enqueue(() => this.persistRecentFilesIfChanged());
  }

  private async apply(
    action: (state: ShortTermHostActionState) => ShortTermHostActionState | Promise<ShortTermHostActionState>
  ): Promise<ShortTermHostSessionActionResult> {
    return this.enqueue(async () => {
      this.state = await action(this.state);
      const stateSnapshot = cloneShortTermHostActionState(this.state);
      return {
        schemaVersion: SHORT_TERM_HOST_SESSION_SCHEMA_VERSION,
        source: "short-term-host-session",
        model: cloneShortTermWorkbenchFacadeModel(stateSnapshot.facade.model),
        state: stateSnapshot,
        ...(stateSnapshot.lastAction ? { actionResult: cloneShortTermHostActionResult(stateSnapshot.lastAction) } : {}),
        recentPersistence: await this.persistRecentFilesIfChanged()
      };
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.actionQueue.then(operation, operation);
    this.actionQueue = queued.then(() => undefined, () => undefined);
    return queued;
  }

  private async persistRecentFilesIfChanged(): Promise<ShortTermHostSessionRecentPersistenceResult> {
    if (!this.recentStore) {
      return persistenceResult("notConfigured", "未配置最近文件持久化存储。");
    }

    const nextSnapshot = recentSignature(this.state);
    if (nextSnapshot === this.recentSnapshot) {
      return persistenceResult("unchanged", "最近文件记录没有变化。");
    }

    try {
      await persistShortTermHostRecentFiles(this.state, this.recentStore);
      this.recentSnapshot = nextSnapshot;
      return persistenceResult("saved", "最近文件记录已保存。");
    } catch (error) {
      return persistenceResult("failed", "最近文件记录保存失败。", {
        code: "recent_files_persist_failed",
        message: errorMessage(error, "Recent file persistence failed.")
      });
    }
  }
}

function recentSignature(state: ShortTermHostActionState): string {
  return serializeShortTermRecentFilesState(state.facade.recentState);
}

function cloneShortTermHostActionState(state: ShortTermHostActionState): ShortTermHostActionState {
  return structuredClone(state) as ShortTermHostActionState;
}

function cloneShortTermWorkbenchFacadeModel(model: ShortTermWorkbenchFacadeModel): ShortTermWorkbenchFacadeModel {
  return structuredClone(model) as ShortTermWorkbenchFacadeModel;
}

function cloneShortTermHostActionResult(result: ShortTermHostActionResult): ShortTermHostActionResult {
  return structuredClone(result) as ShortTermHostActionResult;
}

function cloneShortTermHostSessionRecentPersistenceResult(
  result: ShortTermHostSessionRecentPersistenceResult
): ShortTermHostSessionRecentPersistenceResult {
  return structuredClone(result) as ShortTermHostSessionRecentPersistenceResult;
}

function persistenceResult(
  status: ShortTermHostSessionRecentPersistenceStatus,
  message: string,
  diagnostic?: ShortTermHostSessionRecentPersistenceResult["diagnostic"]
): ShortTermHostSessionRecentPersistenceResult {
  return {
    schemaVersion: SHORT_TERM_HOST_SESSION_SCHEMA_VERSION,
    source: "short-term-host-session",
    prdIds: ["S16"],
    status,
    message,
    pathRedacted: true,
    ...(diagnostic ? { diagnostic } : {})
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return redactShortTermLocalPathsFromError(error, fallback);
}
