import {
  clearShortTermSaveBanner,
  showShortTermSaveBanner
} from "./short-term-macos-feedback-surface.mjs";

export function showShortTermOutputBanner({ nodes, title, message, tone }) {
  showShortTermSaveBanner({ nodes, title, message, tone });
}

export function setShortTermActiveOutput({
  nodes,
  state,
  output,
  onOutputStateChange
}) {
  const { kind, bytes, suggestedName, title, summary, details } = output;
  state.activeOutput = {
    kind,
    bytes: new Uint8Array(bytes),
    suggestedName,
    title,
    summary,
    details
  };
  state.cleanSaveAsVisible = false;
  state.saveStatus = "dirty";
  clearShortTermSaveBanner(nodes);
  onOutputStateChange?.();
}

export function clearShortTermTransientOutput({ nodes, state, onOutputStateChange }) {
  state.activeOutput = undefined;
  state.cleanSaveAsVisible = false;
  state.saveStatus = "idle";
  clearShortTermSaveBanner(nodes);
  onOutputStateChange?.();
}
