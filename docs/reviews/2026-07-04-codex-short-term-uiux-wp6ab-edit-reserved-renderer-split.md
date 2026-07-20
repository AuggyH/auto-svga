# Short-term UI/UX WP6AB Edit Reserved Renderer Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving the
Edit reserved layer-list DOM replacement out of the app entry file and into the
short-term DOM renderer module.

This is an implementation-structure slice only. It does not change the reserved
Edit mode product boundary, labels, copy, layer filtering, ordering, or visible
interaction behavior.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows `DESIGN.md` and the short-term UI/UX redesign
  execution plan by moving another list-rendering responsibility into the
  renderer/component layer.
- Scope boundary: no new product behavior, copy, explanatory text, states, or
  interactions were introduced.
- Edit boundary: Edit mode remains reserved/quiet for the short-term client.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- New regression assertions keep `createEditLayerRow` usage and
  `layerPanel.replaceChildren` out of `short-term-macos-app.mjs`.
- `desktop:smoke` remains automated regression evidence only. It is not a
  substitute for future foreground macOS visual review using real production
  SVGA materials.

## Risks

- This slice improves implementation structure only; it does not claim visual
  polish or high-fidelity quality.
- The app entry file still contains orchestration, event handling, and proof
  collection. Further decomposition should continue in small verified steps.

## Next Step

Continue WP6AB with command-state DOM application or another narrow renderer
boundary, then pair the cleaner structure with focused design-validation passes
for keyboard flow, focus order, minimum window size, and foreground macOS
screenshots.
