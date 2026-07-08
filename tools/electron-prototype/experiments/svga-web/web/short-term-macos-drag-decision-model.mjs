export function dragFileFromEvent(event) {
  return event.dataTransfer?.files?.[0];
}

export function isSupportedShortTermDropFile(file) {
  if (!file) return true;
  return /\.svga$/i.test(file.name || "");
}

export const SHORT_TERM_DRAG_DECISION_OPEN_RATIO = 0.75;
export const SHORT_TERM_DRAG_DECISION_COMPARE_RATIO = 1 - SHORT_TERM_DRAG_DECISION_OPEN_RATIO;

export function dragDecisionZoneForEvent(target, event) {
  const rect = target.getBoundingClientRect();
  const compareBoundary = rect.top + rect.height * SHORT_TERM_DRAG_DECISION_OPEN_RATIO;
  return event.clientY < compareBoundary ? "open" : "compare";
}
