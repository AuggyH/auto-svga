export function consumeKeyboardEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function isActivationKey(event) {
  return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
}

export function isContextMenuKey(event) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

export function nextTabIndexForKey(key, currentIndex, tabCount) {
  if (tabCount <= 0) return undefined;
  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  return undefined;
}
