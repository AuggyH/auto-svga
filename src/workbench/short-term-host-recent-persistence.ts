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
  const recentState = await store.load();
  return createShortTermHostActionState({
    recentFiles: recentState.records
  });
}

export async function persistShortTermHostRecentFiles(
  state: ShortTermHostActionState,
  store: ShortTermRecentFilesStore
): Promise<void> {
  await store.save(state.facade.recentState);
}
