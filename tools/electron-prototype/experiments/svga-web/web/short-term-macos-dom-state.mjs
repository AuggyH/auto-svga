export function applyViewState(app, view) {
  app.dataset.appState = view;
  document.querySelectorAll("[data-view]").forEach((node) => {
    const active = node.dataset.view === view;
    node.hidden = !active;
    node.classList.toggle("isActive", active);
  });
}

export function applyModeButtons(mode) {
  document.querySelectorAll("[data-action='mode-preview'], [data-action='mode-edit']").forEach((button) => {
    const selected = button.dataset.action === `mode-${mode}`;
    button.classList.toggle("isSelected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

export function applyTabState(tab, options = {}) {
  const activePanel = tab === "optimization" ? "optimization" : "overview";
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === activePanel;
    panel.hidden = !active;
    panel.classList.toggle("isActive", active);
  });
  const targetSelector = tab === "replaceable"
    ? ".replaceableSection"
    : `[data-panel="${activePanel}"]`;
  const target = document.querySelector(targetSelector);
  if (options.focus === true) target?.focus?.();
  if (options.scroll === true) target?.scrollIntoView?.({ block: "nearest" });
}

export function setActionEnabled(action, enabled, reason) {
  document.querySelectorAll(`[data-action='${action}']`).forEach((button) => {
    button.disabled = !enabled;
    button.title = enabled ? "" : reason;
  });
}

export function applyCommandState(commandState) {
  Object.entries(commandState.actionStates).forEach(([action, actionState]) => {
    setActionEnabled(action, actionState.enabled, actionState.reason);
  });
  const playPauseButton = document.querySelector("[data-action='play-pause']");
  if (playPauseButton) {
    const playing = commandState.playPauseCopy === "暂停";
    playPauseButton.dataset.playbackState = playing ? "playing" : "paused";
    playPauseButton.setAttribute("aria-label", commandState.playPauseCopy);
    if (!playPauseButton.disabled) playPauseButton.title = commandState.playPauseCopy;
  }
  const replayButton = document.querySelector("[data-action='replay']");
  if (replayButton) {
    replayButton.setAttribute("aria-label", "重播");
    if (!replayButton.disabled) replayButton.title = "重播";
  }
}
