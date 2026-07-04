import {
  applyTabState,
  tabButtons
} from "./short-term-macos-dom-state.mjs";
import {
  consumeKeyboardEvent,
  nextTabIndexForKey
} from "./short-term-macos-interaction-model.mjs";

export function setShortTermTab({ state, tab, options = {} }) {
  state.tab = tab;
  applyTabState(tab, options);
}

export function handleShortTermTabListKeydown({ event, setTab }) {
  const tabs = tabButtons();
  const current = event.target.closest("[data-tab]");
  if (!current || tabs.length === 0) return;
  const currentIndex = Math.max(0, tabs.indexOf(current));
  const nextIndex = nextTabIndexForKey(event.key, currentIndex, tabs.length);
  if (nextIndex === undefined) return;
  consumeKeyboardEvent(event);
  setTab(tabs[nextIndex].dataset.tab, { focus: true });
}

export function openShortTermTab({ state, tab, setMode, setTab }) {
  if (state.sourceBytes && state.view !== "preview") setMode("preview");
  setTab(tab);
}
