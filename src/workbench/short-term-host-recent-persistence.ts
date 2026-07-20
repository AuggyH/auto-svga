import {
  createShortTermHostActionState,
  type ShortTermHostActionState
} from "./short-term-host-actions.js";
import {
  type ShortTermRecentFilesState
} from "./short-term-recent-files.js";

export interface ShortTermRecentFilesStore {
  load(): Promise<ShortTermRecentFilesState>;
  save(state: ShortTermRecentFilesState): Promise<void>;
  clear(): Promise<ShortTermRecentFilesState>;
}

export async function createShortTermHostActionStateFromRecentStore(
  store: ShortTermRecentFilesStore
): Promise<ShortTermHostActionState> {
  try {
    const recentState = await store.load();
    const recentFiles = isRecord(recentState) && Array.isArray(recentState.records)
      ? recentState.records
      : [];
    return createShortTermHostActionState({ recentFiles });
  } catch {
    return createShortTermHostActionState();
  }
}

export async function persistShortTermHostRecentFiles(
  state: ShortTermHostActionState,
  store: ShortTermRecentFilesStore
): Promise<void> {
  await store.save(state.facade.recentState);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
