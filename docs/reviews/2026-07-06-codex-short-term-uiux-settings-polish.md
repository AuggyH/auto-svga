# UI/UX Review: Settings Theme Control Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the Settings appearance selector by giving `SettingsThemeSegmented`
its own restrained token surface instead of inheriting the canvas
Preview/Edit mode switch tokens.

This keeps the Settings sheet aligned with the new boundary-light visual
language while preventing future canvas mode-switch tuning from accidentally
changing the Settings control.

This review covers UI/UX implementation only. It does not change theme
preferences, app state, product scope, menu behavior, or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` and the
  Owner-confirmed light/dark appearance requirement.
- Visual direction: preserves a quiet native-tool settings surface without
  adding new labels, helper text, or status UI.
- Design system: Settings choice group, hover, selected background, and selected
  shadow are tokenized and asserted separately from `CanvasModeSwitch`.
- Scope boundary: no product docs, renderer state model, theme persistence,
  menu behavior, or visible copy changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with native
window chrome, on the secondary display. Light and dark Settings states were
captured against the launch canvas with real recent records available.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf30-settings-polish-20260706/`

Key screenshots:

- `01-full-display-settings-light-active.png`
- `02-settings-light.png`
- `03-settings-dark.png`

Observed foreground checks:

- Settings uses a subtle control background independent from the transparent
  canvas mode switch shell.
- Light and dark modes keep the selected theme legible.
- Keyboard focus remains visible on the checked theme option.

## Risks / Notes

- This slice validates the Settings theme selector only. It does not claim full
  Settings sheet visual acceptance.
- Smoke regression still covers desktop launch, open, preview, compare,
  optimization, replacement, menu, and settings flows.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
validated through foreground screenshots and smoke regression before packaging.
