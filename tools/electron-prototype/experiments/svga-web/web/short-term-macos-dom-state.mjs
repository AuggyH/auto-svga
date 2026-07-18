export function applyViewState(app, view) {
  app.dataset.appState = view;
  document.querySelectorAll("[data-view]").forEach((node) => {
    const active = node.dataset.view === view;
    node.hidden = !active;
    node.classList.toggle("isActive", active);
  });
  const panelState = document.querySelector(".rightPanel")?.dataset.panelState ?? "overview";
  applySaveFeedbackPlacement(app, view, panelState);
}

export function applySaveFeedbackPlacement(app, view, panelState = "overview") {
  const banner = document.querySelector("#saveBanner");
  if (!banner || !app) return;
  const target = view === "compare"
    ? app
    : document.querySelector(panelState === "optimization"
      ? '[data-save-feedback-outlet="optimization"]'
      : '[data-save-feedback-outlet="overview"]');
  if (target && banner.parentElement !== target) target.append(banner);
}

export function applyModeButtons(mode, options = {}) {
  const previewEnabled = options.previewEnabled !== false;
  const editEnabled = options.editEnabled !== false;
  document.querySelectorAll("[data-action='mode-preview'], [data-action='mode-edit']").forEach((button) => {
    const enabled = button.dataset.action === "mode-edit" ? editEnabled : previewEnabled;
    const selected = button.dataset.action === `mode-${mode}`;
    button.classList.toggle("isSelected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
    button.disabled = !enabled;
    button.title = enabled ? "" : button.dataset.action === "mode-edit"
      ? options.editReason || "当前文件不支持编辑"
      : options.previewReason || "请先打开文件";
  });
}

export function applyTabState(tab, options = {}) {
  const activePanel = tab === "optimization" ? "optimization" : "overview";
  const surfaceState = tab === "replaceable" ? "replaceable" : activePanel;
  const rightPanel = document.querySelector(".rightPanel");
  if (rightPanel) rightPanel.dataset.panelState = surfaceState;
  const rightSurfaceHeader = document.querySelector(".rightSurfaceHeader");
  if (rightSurfaceHeader) rightSurfaceHeader.hidden = surfaceState === "optimization";
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
  const app = document.querySelector(".macApp");
  if (app) applySaveFeedbackPlacement(app, app.dataset.appState, surfaceState);
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
  const headerSaveCluster = document.querySelector(".rightSurfaceHeader .toolbarClusterSave");
  const headerSaveAs = document.querySelector(".rightSurfaceHeader [data-action='save-as']");
  const headerSaveOverwrite = document.querySelector(".rightSurfaceHeader [data-action='save-overwrite']");
  if (headerSaveOverwrite) headerSaveOverwrite.hidden = true;
  if (headerSaveAs) headerSaveAs.hidden = !commandState.headerSaveAsVisible;
  if (headerSaveCluster) headerSaveCluster.hidden = !commandState.headerSaveAsVisible;
  document.querySelectorAll("[data-action='play-pause']").forEach((playPauseButton) => {
    const playing = commandState.playPauseCopy === "暂停";
    playPauseButton.dataset.playbackState = playing ? "playing" : "paused";
    playPauseButton.setAttribute("aria-label", commandState.playPauseCopy);
    if (!playPauseButton.disabled) playPauseButton.title = commandState.playPauseCopy;
  });
  document.querySelectorAll("[data-action='replay']").forEach((replayButton) => {
    replayButton.setAttribute("aria-label", "重播");
    if (!replayButton.disabled) replayButton.title = "重播";
  });
  document.querySelectorAll("[data-action='loop-toggle']").forEach((loopButton) => {
    loopButton.classList.toggle("isSelected", commandState.loopEnabled === true);
    loopButton.setAttribute("aria-pressed", commandState.loopEnabled === true ? "true" : "false");
    loopButton.setAttribute("aria-label", "循环播放");
    if (!loopButton.disabled) loopButton.title = "循环播放";
  });
}
