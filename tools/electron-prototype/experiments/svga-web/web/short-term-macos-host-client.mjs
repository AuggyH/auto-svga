export async function getRecentSvgaFiles(bridge) {
  if (!bridge?.getRecentSvgaFiles) return { available: false, value: undefined };
  return { available: true, value: await bridge.getRecentSvgaFiles() };
}

export async function clearRecentSvgaFiles(bridge) {
  if (bridge?.clearRecentSvgaFiles) await bridge.clearRecentSvgaFiles();
}

export function syncShortTermMenuState(bridge, snapshot, lastMenuStateSnapshot) {
  if (!bridge?.updateShortTermMenuState) return lastMenuStateSnapshot;
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastMenuStateSnapshot) return lastMenuStateSnapshot;
  bridge.updateShortTermMenuState(snapshot).catch(() => {});
  return serialized;
}

export function syncShortTermWindowMode(bridge, mode, lastWindowModeSnapshot) {
  if (!bridge?.setShortTermWindowMode) return lastWindowModeSnapshot;
  if (mode === lastWindowModeSnapshot) return lastWindowModeSnapshot;
  bridge.setShortTermWindowMode(mode).catch(() => {});
  return mode;
}
