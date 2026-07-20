import { applyTabState } from "./short-term-macos-dom-state.mjs";

export function setShortTermTab({ state, tab, options = {} }) {
  state.tab = tab;
  applyTabState(tab, options);
}

export function handleShortTermTabListKeydown({ event, setTab }) {
  void event;
  void setTab;
}

export function openShortTermTab({ state, tab, setMode, setTab }) {
  if (state.sourceBytes && state.view !== "preview") setMode("preview");
  setTab(tab, { focus: true, scroll: true });
}
