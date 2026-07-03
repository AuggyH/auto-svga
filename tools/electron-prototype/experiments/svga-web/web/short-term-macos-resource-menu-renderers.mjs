export function showResourceContextMenu(menu, view) {
  menu.hidden = false;
  menu.style.left = view.left;
  menu.style.top = view.top;
  menu.querySelector("[data-action='context-reset']").disabled = view.resetDisabled;
  menu.querySelector("button:not(:disabled)")?.focus();
}

export function hideResourceContextMenu(menu) {
  menu.hidden = true;
}
