# UI/UX Playback Rhythm Polish

Date: 2026-07-09
Owner lane: UI/UX
Version context: Auto SVGA 0.1.x / SVGA Preview MVP
Branch: `agent/codex/short-term-preview-qa-20260708`

## Summary

Polished the short-term playback control bar rhythm without adding new
controls or changing playback behavior.

The progress track and time text now behave as one compact control group in
wide workbench layouts instead of stretching the time text to the far canvas
edge. The progress track contrast is also slightly stronger so the scrub area
is visible over the checkerboard canvas.

## Why

After the wide Preview evidence screenshot was added, the playback bar showed a
clear visual mismatch with the Owner/Figma direction: the time text was too far
from the progress track in a wide canvas. The fix keeps the current action set
but improves the spatial rhythm.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
  - Adds component tokens for playback progress/control-group proportions.
  - Strengthens the semantic playback track surface token.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
  - Changes the playback bar grid to a tokenized four-column layout:
    buttons, progress, time, trailing breathing space.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Asserts the new playback proportion tokens and grid contract.

## Requirement Checks

- PRD authority: supports S2 playback UI and the canvas-first Preview surface;
  no product scope change.
- Page states touched: Preview playback, Compare empty disabled playback bar,
  and shared playback surface.
- Modules touched: `PlaybackControls`.
- Components changed: no HTML changes and no new controls.
- Tokens changed:
  - `--asv-component-playback-progress-track-fr`
  - `--asv-component-playback-end-spacer-fr`
  - playback track surface token strength
- Non-goals retained:
  - did not add loop, fullscreen, zoom, or scrub interaction;
  - did not add visible explanatory text;
  - did not change playback start/pause/replay behavior.

## Verification

- `node --test --test-name-pattern "default Electron renderer|short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS
- `npm run desktop:short-term:design-system-check`
  - PASS
- `git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - PASS

Generated evidence:

- `.artifacts/product/short-term/short-term-preview-overview-wide.png`
  - Time text now sits closer to the progress track in the wide Preview
    evidence screenshot.

## Visual Notes

The trailing empty space is intentional. The Owner sketches include extra icon
slots in that region, but those controls are not part of this implementation
slice. This WP only improves layout rhythm for existing controls.

## Risks

- The track remains noninteractive in the current short-term implementation;
  this WP only polishes visual grouping.
- Smoke evidence is not final visual acceptance. Foreground packaged-app
  validation with real materials remains required before Owner acceptance.

## Next Steps

- Promote the committed build to local stable because this is owner-visible UI
  polish.
- Continue with right-surface density or real-material foreground validation,
  depending on the next highest-value gap.

## Project Retrospective

- What helped: the wide Preview screenshot revealed control spacing that square
  smoke screenshots hid.
- What changed: playback rhythm is now governed by component tokens, not an
  ad hoc wide `1fr` track.
- Lesson: when future controls are absent, leave quiet space rather than adding
  unsupported buttons to fill the design.
- Token usage source: Codex goal token count.
- Token usage at review time: `3691126`.
