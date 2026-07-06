# UI/UX Review: Edit Reserved Mode Polish

Date: 2026-07-06
Owner lane: UI/UX
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the short-term Edit reserved state so it no longer reuses the Preview
asset-row styling as an engineering shell. Edit mode now has a dedicated
`LayerRow` visual contract, tokenized layer-panel spacing, and a zero-gap
left/canvas/right composition that better matches the Owner-confirmed
canvas-first direction.

This review covers UI/UX implementation only. It does not change product scope,
PM-owned PRD content, SVGA parsing, playback, optimization, save behavior, or
replacement logic. It also does not add short-term editing features.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-edit-reserved-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: aligned to `docs/product/PRODUCT_ROADMAP.md` short-term
  Edit reserved state. The right operation area remains empty.
- Visual direction: keeps the canvas dominant and uses boundary-light hierarchy
  instead of adding labels, helper copy, or placeholder text.
- Design system: introduced layer-row and edit-view component tokens, then used
  token aliases in component/module/page-state CSS.
- macOS foreground fit: layer list now respects the traffic-light/titlebar safe
  area in the real desktop window.
- Scope boundary: no product docs, menu behavior, save behavior, or renderer
  feature logic were changed.

## Verification

- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

All checks passed.

## Foreground Evidence

Foreground evidence was captured from the real desktop client with native
window chrome, on the secondary display, using the real recent production SVGA
material `战狼头像框.svga`.

Evidence folder:
`review/uiux-high-fidelity-packages/foreground-hf23-edit-reserved-polish-20260706/`

Key screenshots:

- `00-full-display-edit-dark-real-material-active.png`
- `01-edit-dark-real-material.png`
- `02-edit-light-real-material.png`

Observed foreground checks:

- Edit mode shows 32 `LayerRow` entries from the real file.
- Edit mode does not render `.assetRow` inside `.editView`.
- Right reserved panel stays empty.
- First layer row starts below the macOS traffic-light/titlebar safe area.

## Risks / Notes

- This is a visual-system slice, not a full Edit-mode product implementation.
  The right operation area intentionally remains empty for the short-term
  version.
- The current dev app menu title can still appear as `Electron`; packaged build
  naming should continue to be validated separately.

## Next Step

Continue the high-fidelity line with the next small Owner-visible polish slice,
while preserving the rule that product scope and visible copy only come from
the PRD or approved UI/UX documents.
