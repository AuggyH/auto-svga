const MENU_EDGE_INSET = 8;
const KEYBOARD_MENU_X_OFFSET = 4;
const KEYBOARD_MENU_Y_LIMIT = 28;

export function keyboardResourceMenuAnchor(rect) {
  return {
    clientX: rect.right - KEYBOARD_MENU_X_OFFSET,
    clientY: rect.top + Math.min(rect.height - KEYBOARD_MENU_X_OFFSET, KEYBOARD_MENU_Y_LIMIT)
  };
}

export function resourceContextMenuView(input) {
  return {
    left: `${Math.min(input.clientX, input.viewportWidth - input.menuWidth - MENU_EDGE_INSET)}px`,
    top: `${Math.min(input.clientY, input.viewportHeight - input.menuHeight - MENU_EDGE_INSET)}px`,
    resetDisabled: input.activeOutput?.kind !== "replacement"
  };
}
