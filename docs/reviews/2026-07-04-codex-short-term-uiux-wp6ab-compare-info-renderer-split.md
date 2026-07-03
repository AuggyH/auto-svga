# Short-term UI/UX WP6AB Compare Info Renderer Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving
Compare info panel DOM HTML placement out of the app entry file and into the
short-term DOM renderer module.

The app entry still chooses which compare HTML model to display for General
Compare, opened B files, and optimization comparison. The renderer now owns the
actual `compareInfoA` / `compareInfoB` panel DOM write.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows `DESIGN.md` and the short-term UI/UX redesign
  execution plan by keeping composed panel rendering behind a renderer boundary.
- Scope boundary: no compare behavior, layout, labels, copy, actions, or
  generated compare HTML were changed.
- Historical boundary: no legacy Web Preview / Workbench visual baseline or
  inspector/checker framing was introduced.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-renderers.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- New regression assertions keep `nodes.compareInfoA.innerHTML` and
  `nodes.compareInfoB.innerHTML` out of `short-term-macos-app.mjs`.
- Compare HTML generation remains in `short-term-macos-compare-model.mjs`; this
  change only moves placement of that HTML into the renderer layer.
- `desktop:smoke` remains automated regression evidence only. It is not a
  substitute for future foreground macOS visual review using real production
  SVGA materials.

## Risks

- This slice improves structure only; it does not claim final visual quality or
  final compare interaction acceptance.
- The app entry still contains large playback orchestration and proof
  collection, which should continue to be reduced carefully.

## Next Step

Continue WP6AB by moving another owner-visible DOM responsibility behind a
renderer/module boundary, then schedule a focused design-validation pass once
the app entry is no longer carrying most component rendering.
