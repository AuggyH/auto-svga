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

export function isTextEditingTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function shouldHandleGlobalPlaybackShortcut(target) {
  if (!(target instanceof Element)) return true;
  return !target.closest([
    "button",
    "input",
    "textarea",
    "select",
    "[contenteditable='true']",
    "[role='button']",
    "[role='menu']",
    "[role='menuitem']",
    "[role='tab']",
    "[role='option']"
  ].join(", "));
}

export function enabledMenuItems(menu) {
  if (!(menu instanceof Element)) return [];
  return [...menu.querySelectorAll("[role='menuitem']")].filter((item) => item.disabled !== true);
}

export function nextMenuItemIndexForKey(key, currentIndex, itemCount) {
  if (itemCount <= 0) return undefined;
  if (key === "ArrowDown") return currentIndex >= 0 ? (currentIndex + 1) % itemCount : 0;
  if (key === "ArrowUp") return currentIndex > 0 ? currentIndex - 1 : itemCount - 1;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return undefined;
}

export function nextTabIndexForKey(key, currentIndex, tabCount) {
  if (tabCount <= 0) return undefined;
  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  return undefined;
}
