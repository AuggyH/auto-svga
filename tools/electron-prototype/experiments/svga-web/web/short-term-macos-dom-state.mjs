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

export function tabButtons() {
  return [...document.querySelectorAll("[data-tab]")];
}

export function applyTabState(tab, options = {}) {
  tabButtons().forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle("isSelected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    if (selected && options.focus === true) button.focus();
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.hidden = !active;
    panel.classList.toggle("isActive", active);
  });
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
  document.querySelector("[data-action='play-pause']").textContent = commandState.playPauseCopy;
}
