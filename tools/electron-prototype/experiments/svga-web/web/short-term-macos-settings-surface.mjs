import {
  appearanceColorScheme,
  normalizeAppearance,
  persistAppearance
} from "./short-term-macos-appearance-model.mjs";

export function syncShortTermSettingsControls(nodes, appearance) {
  nodes.appearanceChoices.forEach((input) => {
    input.checked = input.value === appearance;
  });
}

export function applyShortTermAppearance({
  documentRef = document,
  nodes,
  state,
  appearance,
  persist = false
}) {
  const nextAppearance = normalizeAppearance(appearance);
  state.appearance = nextAppearance;
  documentRef.documentElement.dataset.appearance = nextAppearance;
  documentRef.documentElement.style.colorScheme = appearanceColorScheme(nextAppearance);
  syncShortTermSettingsControls(nodes, nextAppearance);
  if (persist) persistAppearance(nextAppearance);
}

export function openShortTermSettings({
  nodes,
  state,
  renderCommandState
}) {
  syncShortTermSettingsControls(nodes, state.appearance);
  if (!nodes.settingsDialog.open) nodes.settingsDialog.showModal();
  nodes.settingsDialog.querySelector("[data-appearance-choice]:checked")?.focus({ preventScroll: true });
  renderCommandState();
}

export function closeShortTermSettings({
  nodes,
  renderCommandState
}) {
  if (nodes.settingsDialog.open) nodes.settingsDialog.close("close");
  renderCommandState();
}
