# UI/UX Preview Canvas Scale Polish

Date: 2026-07-09
Owner lane: UI/UX
Version context: Auto SVGA 0.1.x / SVGA Preview MVP
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Adjusted the short-term Preview playback canvas display sizing so source
canvases are not visually upscaled beyond their original SVGA canvas size.

For the common `300 x 300` Preview case, the artwork now reads at the same
scale as the Owner/Figma canvas-first direction instead of growing to an
oversized workbench fill.

## Why

The new wide Preview smoke artifact showed a clear high-fidelity gap: a
`300 x 300` SVGA was rendered around the visual weight of a much larger asset
inside the canvas. The Owner reference sketches and Figma R4 canvas contract
show the opened artwork centered around its native 300px footprint with quiet
surrounding canvas space.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-fit-model.mjs`
  - Keeps the responsive fit behavior, but caps the rendered CSS size at the
    decoded movie width and height.
- `tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs`
  - Updates the source-size test so `300 x 300` and `400 x 200` canvases do not
    upscale when the window is larger.

## Requirement Checks

- PRD authority: supports S2 Preview playback and the canvas-first UI/UX
  direction; no product scope change.
- Page states touched: Preview default information, Compare/Optimization
  playback surfaces indirectly through shared fit model.
- Modules touched: playback canvas sizing only.
- Components changed: no HTML component or visible copy change.
- Tokens changed: none; existing fit token still controls downscaling within
  available canvas space.
- Non-goals retained:
  - did not add zoom controls, fullscreen controls, labels, or new modes;
  - did not change SVGA decoding, source bytes, or canvas internal resolution;
  - did not change right-panel information, optimization behavior, or save
    logic.

## Verification

- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-playback-fit.test.mjs`
  - PASS
- `node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS
- `npm run desktop:short-term:design-system-check`
  - PASS
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - PASS

Generated evidence:

- `.artifacts/product/short-term/short-term-preview-overview-wide.png`
  - The `300 x 300` smoke SVGA now appears at native visual scale in the wide
    Preview screenshot.

## Visual Notes

The canvas now better matches the Owner-confirmed design language: immersive
checkerboard surface, centered artwork, large quiet surrounding space, and no
extra explanatory chrome.

The change intentionally makes tiny source canvases visually tiny rather than
inventing a zoom policy. A future zoom/fit control would need explicit product
scope; this WP only corrects default display scale.

## Risks

- Very small SVGA canvases may appear small by default. This is truthful to the
  source canvas and avoids adding unapproved zoom behavior, but it may need a
  future product decision if real materials require inspection zoom.
- Smoke evidence remains nonforeground and synthetic. Owner-visible acceptance
  still requires packaged foreground review with real production materials.

## Next Steps

- Promote the committed build to the local stable app for Owner-visible
  testing.
- Continue visual polish on playback control rhythm and right-surface density
  using the wide screenshot as baseline.

## Project Retrospective

- What helped: the previous wide evidence WP made the source-size mismatch
  obvious.
- What changed: the fit model now preserves responsive downscaling while
  avoiding default upscaling beyond source dimensions.
- Lesson: canvas-first polish should distinguish playback internal resolution
  from visual CSS size.
- Token usage source: Codex goal token count.
- Token usage at review time: `3477974`.
