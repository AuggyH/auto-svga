# UI/UX Review: Launch Recent Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the launch-page recent file list so it reads as a low-priority text
list inside the canvas instead of a bounded list control. Recent rows now use
tokenized transparent borders and no inherited button shadows.

This review covers UI/UX implementation only. It does not change recent-file
storage, recent-file limits, menu behavior, open behavior, clear behavior,
product scope, or visible product copy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` S16.
- Visual direction: keeps the launch canvas as the only page surface and keeps
  recent files visually below the drop prompt and primary open action.
- Design system: recent-row borders, text colors, hover color, clear hover
  background, and recent button shadow are tokenized and asserted.
- Scope boundary: no product docs, renderer state model, recent-file model,
  IPC bridge, menu model, or visible copy changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with native
window chrome, on the secondary display.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf28-launch-recent-polish-20260706/`

Key screenshots:

- `00-full-display-launch-recent-light-active.png`
- `01-launch-recent-light.png`
- `02-launch-recent-dark.png`

Observed foreground checks:

- Launch recent list still shows five records.
- Recent rows and clear button render with no inherited button shadow.
- Recent rows have transparent borders in both light and dark modes.
- The primary `打开文件` button remains the dominant launch action.

## Risks / Notes

- This slice validates launch recent visual hierarchy only. It does not claim a
  new acceptance result for File > Recent menu behavior.
- Smoke regression still covers recent-file menu state and launch/open flows.

## Next Step

Continue the high-fidelity line with another small Owner-visible surface,
validated through foreground screenshots and smoke regression before packaging.
