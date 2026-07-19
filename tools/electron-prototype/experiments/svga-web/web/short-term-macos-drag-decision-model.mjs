export function dragFileFromEvent(event) {
  return event.dataTransfer?.files?.[0];
}

export function isSupportedShortTermDropFile(file) {
  if (!file) return true;
  return /\.svga$/i.test(file.name || "");
}

export function unsupportedDropDisposition(state = {}) {
  return state.sourceBytes?.byteLength ? "preserve" : "recover";
}

export const SHORT_TERM_DRAG_DECISION_OPEN_RATIO = 0.75;
export const SHORT_TERM_DRAG_DECISION_COMPARE_RATIO = 1 - SHORT_TERM_DRAG_DECISION_OPEN_RATIO;
export const SHORT_TERM_COMPARE_DRAG_SLOT_RATIO = 0.5;

export function dragDecisionZoneForEvent(target, event) {
  const rect = target.getBoundingClientRect();
  const compareBoundary = rect.top + rect.height * SHORT_TERM_DRAG_DECISION_COMPARE_RATIO;
  return event.clientY < compareBoundary ? "compare" : "open";
}

export function compareDragDecisionZoneForEvent(target, event) {
  const rect = target.getBoundingClientRect();
  const compareBoundary = rect.top + rect.height * SHORT_TERM_DRAG_DECISION_COMPARE_RATIO;
  if (event.clientY >= compareBoundary) return "open";
  const slotBoundary = rect.left + rect.width * SHORT_TERM_COMPARE_DRAG_SLOT_RATIO;
  return event.clientX < slotBoundary ? "compare-a" : "compare-b";
}

export function dragActionForDecision(decision = {}) {
  if (decision.supported !== true) {
    return decision.fileSupported === true ? "reject-compare" : "reject-file";
  }
  if (decision.focusZone === "compare-a") return "replace-compare-a";
  if (decision.focusZone === "compare-b" || decision.focusZone === "compare") return "replace-compare-b";
  return "open";
}
