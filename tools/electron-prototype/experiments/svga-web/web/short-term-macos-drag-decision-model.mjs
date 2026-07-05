export function dragFileFromEvent(event) {
  return event.dataTransfer?.files?.[0];
}

export function isSupportedShortTermDropFile(file) {
  if (!file) return true;
  return /\.svga$/i.test(file.name || "");
}

export function dragDecisionZoneForEvent(target, event) {
  const rect = target.getBoundingClientRect();
  const middle = rect.left + rect.width / 2;
  return event.clientX < middle ? "open" : "compare";
}

