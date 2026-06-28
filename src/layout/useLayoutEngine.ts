import { layoutEngine } from "./layoutEngine.js";
import type { LayoutState, LayoutUserPreferences } from "./layoutTypes.js";

export type LayoutStateListener = (state: LayoutState) => void;

export function createLayoutEngineController(
  readSize: () => { width: number; height: number },
  readPreferences: () => LayoutUserPreferences = () => ({})
) {
  const listeners = new Set<LayoutStateListener>();
  let currentState = layoutEngine.resolve(readSize().width, readSize().height, readPreferences());

  const notify = () => {
    const size = readSize();
    currentState = layoutEngine.resolve(size.width, size.height, readPreferences());
    for (const listener of listeners) listener(currentState);
    return currentState;
  };

  return Object.freeze({
    getState() {
      return currentState;
    },
    resolve: notify,
    subscribe(listener: LayoutStateListener) {
      listeners.add(listener);
      listener(currentState);
      return () => {
        listeners.delete(listener);
      };
    }
  });
}
