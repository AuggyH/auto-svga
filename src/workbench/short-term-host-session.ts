import {
  clearShortTermHostRecentFiles,
  closeShortTermHostFile,
  createShortTermHostActionState,
  dispatchShortTermHostMenuAction,
  openShortTermHostLocalFile,
  openShortTermHostRecentFile,
  applyShortTermHostTextPreview,
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
import { serializeShortTermRecentFilesState } from "./short-term-recent-files.js";

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
  state: ShortTermHostActionState;
  actionResult?: ShortTermHostActionResult;
  recentPersistence: ShortTermHostSessionRecentPersistenceResult;
}

export interface CreateShortTermHostSessionOptions {
  host: ShortTermHostEnvironment;
  recentStore?: ShortTermRecentFilesStore;
  initialState?: ShortTermHostActionState;
}

export interface ShortTermHostSession {
  getState(): ShortTermHostActionState;
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

class ShortTermHostSessionController implements ShortTermHostSession {
  private state: ShortTermHostActionState;
  private recentSnapshot: string;

  constructor(
    private readonly host: ShortTermHostEnvironment,
    initialState: ShortTermHostActionState,
    private readonly recentStore: ShortTermRecentFilesStore | undefined
  ) {
    this.state = initialState;
    this.recentSnapshot = recentSignature(initialState);
  }

  getState(): ShortTermHostActionState {
    return this.state;
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
    return this.persistRecentFilesIfChanged();
  }

  private async apply(
    action: (state: ShortTermHostActionState) => ShortTermHostActionState | Promise<ShortTermHostActionState>
  ): Promise<ShortTermHostSessionActionResult> {
    this.state = await action(this.state);
    return {
      schemaVersion: SHORT_TERM_HOST_SESSION_SCHEMA_VERSION,
      source: "short-term-host-session",
      state: this.state,
      actionResult: this.state.lastAction,
      recentPersistence: await this.persistRecentFilesIfChanged()
    };
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
  const message = error instanceof Error && error.message ? error.message : fallback;
  return message.replace(/\/[^\s，。；;:'")]+/gu, "[local path]");
}
