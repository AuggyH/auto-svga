import {
  consumeKeyboardEvent,
  enabledMenuItems,
  nextMenuItemIndexForKey
} from "./short-term-macos-interaction-model.mjs";
import {
  keyboardResourceMenuAnchor,
  resourceContextMenuView
} from "./short-term-macos-resource-menu-model.mjs";
import {
  hideResourceContextMenu,
  showResourceContextMenu
} from "./short-term-macos-resource-menu-renderers.mjs";

export function openShortTermKeyboardResourceMenu({ nodes, state, row, selectImageKey }) {
  const rect = row.getBoundingClientRect();
  openShortTermResourceMenu({
    nodes,
    state,
    event: keyboardResourceMenuAnchor(rect),
    imageKey: row.dataset.imageKey,
    returnFocus: row,
    selectImageKey
  });
}

export function openShortTermResourceMenu({
  nodes,
  state,
  event,
  imageKey,
  returnFocus = undefined,
  selectImageKey,
  viewport = window
}) {
  if (!imageKey) return;
  selectImageKey(imageKey);
  state.resourceMenuReturnFocus = returnFocus?.isConnected ? returnFocus : undefined;
  const menu = nodes.resourceContextMenu;
  const view = resourceContextMenuView({
    clientX: event.clientX,
    clientY: event.clientY,
    menuWidth: menu.offsetWidth,
    menuHeight: menu.offsetHeight,
    viewportWidth: viewport.innerWidth,
    viewportHeight: viewport.innerHeight,
    activeOutput: state.activeOutput
  });
  showResourceContextMenu(menu, view);
}

export function closeShortTermResourceMenu({ nodes, state, restoreFocus = false }) {
  const wasOpen = nodes.resourceContextMenu.hidden === false;
  const returnFocus = state.resourceMenuReturnFocus;
  hideResourceContextMenu(nodes.resourceContextMenu);
  state.resourceMenuReturnFocus = undefined;
  if (!restoreFocus || !wasOpen || !returnFocus?.isConnected) return;
  returnFocus.focus({ preventScroll: true });
}

export function handleShortTermResourceMenuKeydown({ nodes, event }) {
  const items = enabledMenuItems(nodes.resourceContextMenu);
  const current = event.target.closest("[role='menuitem']");
  const currentIndex = items.indexOf(current);
  const nextIndex = nextMenuItemIndexForKey(event.key, currentIndex, items.length);
  if (nextIndex === undefined) return;
  consumeKeyboardEvent(event);
  items[nextIndex]?.focus();
}
