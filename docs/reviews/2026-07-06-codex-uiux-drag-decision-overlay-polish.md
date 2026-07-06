# UI/UX Review: Drag Decision Overlay Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the short-term client drag decision overlay so it follows the
Owner-confirmed canvas-first direction more closely. The overlay now uses a
stronger immersive backdrop, tokenized large labels, focused-zone opacity, and
zero-gap compare canvas alignment through design tokens instead of one-off CSS.

This review covers UI/UX implementation only. It does not change product scope,
PM-owned PRD content, SVGA parsing, optimization logic, save behavior, or
replacement logic.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` and
  subordinate UI/UX docs for drag decision behavior.
- Visual direction: keeps the canvas immersive and avoids adding extra visible
  explanatory copy.
- Design system: new visual values are tokenized under drag overlay and compare
  canvas component tokens, then consumed by module CSS aliases.
- Accessibility preference: drag overlay backdrop now participates in
  `prefers-reduced-transparency` handling.
- Scope boundary: no PRD, product, or core feature logic changes were made.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client, with native
window chrome and real production SVGA material. The complete-display capture
also includes the macOS menu bar with Electron active.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf22-drag-decision-20260706/`

Key screenshots:

- `00-full-display-preview-dark-real-material-active.png`
- `01-preview-dark-real-material.png`
- `02-drag-supported-compare-dark.png`
- `03-drag-unsupported-open-dark.png`
- `04-unsupported-drop-toast-dark.png`

## Risks / Notes

- The drag overlay foreground state was triggered through the renderer's same
  drag event path to avoid prolonged manual foreground file-drag interruption.
  Native drag/drop behavior remains covered by the smoke regression.
- The current app menu title in dev mode remains `Electron`; packaged builds
  should continue to be checked separately when validating final owner-facing
  naming.

## Next Step

Continue the visual high-fidelity line by choosing the next small surface polish
slice, preferably one with direct Owner-visible payoff and limited product
logic risk.
