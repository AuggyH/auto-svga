# UI/UX Wide Preview Evidence

Date: 2026-07-09
Owner lane: UI/UX
Version context: Auto SVGA 0.1.x / SVGA Preview MVP
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Added a dedicated wide Preview smoke screenshot for the short-term macOS client:
`short-term-preview-overview-wide`.

This is validation infrastructure only. It does not change product behavior,
visible copy, UI controls, menu structure, or the promoted local stable app.

## Why

The existing `short-term-preview-overview` smoke screenshot is captured at the
launch/square scale and can hide layout issues that only appear in the actual
workbench proportion. The Figma R4 canvas/playback packet and Owner sketches
need a wide comparison target before the next visual polish WP.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Allows `short-term-preview-overview-wide` as a product artifact scenario.
  - Captures it at the default workbench content size (`1440 x 900` CSS px).
  - Restores the original content size after capture.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
  - Captures `short-term-preview-overview-wide` after returning appearance to
    light mode.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Asserts the new scenario is captured by the smoke runner, whitelisted by
    the main process, and mapped to default workbench sizing.

## Requirement Checks

- PRD authority: no product scope change; supports the design verification
  requirements in the short-term UI/UX redesign plan.
- Page states touched: Preview default information evidence only.
- Modules touched: `PlaybackControls` / Preview canvas evidence path only.
- Components changed: no owner-visible component change.
- Tokens changed: none.
- Non-goals retained:
  - did not add controls, labels, states, menus, or explanatory copy;
  - did not treat smoke evidence as final visual acceptance;
  - did not use or commit Figma screenshots or production assets.

## Verification

- `node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS
- `npm run desktop:short-term:design-system-check`
  - PASS
- `git diff --check -- tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - PASS

Generated evidence:

- `.artifacts/product/short-term/short-term-preview-overview-wide.png`
  - PNG dimensions: `2880 x 1800` Retina pixels, corresponding to `1440 x 900`
    CSS px.
- `.artifacts/product/short-term/artifact-index.json`

First smoke attempt failed because the renderer requested the new scenario
before the main-process scenario whitelist was updated. The failure was useful:
the final patch now covers the whitelist with a unit assertion.

## Visual Notes

The new wide screenshot makes the next polish target clearer than the square
smoke screenshot. It shows the Preview surface at a realistic workbench ratio,
so future Figma/Owner-sketch comparison can inspect right-surface width, canvas
breathing room, and bottom playback rhythm without relying on cropped square
evidence.

This WP does not claim foreground visual acceptance. Final UI acceptance still
requires foreground packaged-app screenshots with macOS chrome and real
production SVGA materials.

## Risks

- The artifact uses synthetic smoke data, so it is not a substitute for real
  production-material validation.
- It is nonforeground Electron evidence; it cannot prove native titlebar/menu
  quality.

## Next Steps

- Use `short-term-preview-overview-wide.png` as the nonforeground comparison
  baseline for the next visual polish WP.
- Continue with bottom playback rhythm and Preview canvas/right-surface polish
  only where the wide evidence shows a real gap.

## Project Retrospective

- What helped: adding the wide screenshot exposed layout proportions that the
  square smoke artifact could not show.
- What failed first: the new scenario was not in the main-process whitelist.
- Lesson: every new screenshot scenario needs both renderer capture and
  host-side allowlist coverage before smoke is expected to pass.
- Token usage source: Codex goal token count.
- Token usage at review time: `3330506`.
