# Short-term UI/UX WP6AG Playback Model Split Review

## Summary

Moved short-term SVGA playback lifecycle internals out of the macOS app entry
file into a dedicated playback model module. The new module owns svga-web
parser/player construction, canvas sizing, playback mount/start, playback
cleanup, pause/resume, replay, canvas clearing, and the player prototype used
by the smoke playback-failure probe. The app entry still owns when playback is
mounted, which canvas is targeted, and how command state is refreshed.

No PRD-owned document, product behavior, visible copy, styling, state name, or
interaction flow was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit status at review time: pending commit

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority preserved: `docs/product/PRODUCT_ROADMAP.md` remains the only
  product scope authority.
- Short-term scope preserved: S2 playback, S10 comparison playback, S12
  replacement preview playback, and Edit-reserved playback behavior are
  unchanged.
- Owner boundary preserved: no new user-facing text, labels, states, panels, or
  explanatory UI were introduced.
- Design-system direction improved: the app entry file no longer directly owns
  vendor parser/player construction, player configuration, parser buffer
  conversion, or low-level canvas clearing.
- Regression guard added: tests require playback model exports and vendor
  playback details in the playback model, while rejecting those details in the
  app entry file.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `npm run desktop:short-term:design-system-check`
  - Result: passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Result: 30/30 passed.
- `npm run desktop:smoke`
  - Result: passed.

## Risks

- This is a structural componentization slice. It does not claim high-fidelity
  visual improvement by itself.
- Desktop smoke remains regression evidence only; visual or interaction
  acceptance still needs foreground macOS screenshots with real production SVGA
  files.

## Next Steps

- Continue reducing the main short-term app entry file by moving remaining
  proof-only smoke helpers behind documented module boundaries.
