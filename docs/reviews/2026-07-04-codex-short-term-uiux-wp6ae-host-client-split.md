# Short-term UI/UX WP6AE Host Client Split Review

## Summary

Moved short-term host-bridge details for recent-file loading, recent-file
clearing, and menu-state snapshot synchronization out of the short-term macOS
app entry file into a dedicated host client module. The app entry still owns
when recent files refresh and how launch recent rows render, while the new
host client owns the direct bridge method calls and menu-state de-duplication.

No PRD-owned document, product behavior, visible copy, styling, state name, or
interaction flow was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit status at review time: pending commit

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-host-client.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority preserved: `docs/product/PRODUCT_ROADMAP.md` remains the only
  product scope authority.
- Short-term scope preserved: S16 recent-file behavior and menu-state behavior
  are unchanged; this slice only moves host bridge calls behind a module
  boundary.
- Owner boundary preserved: no new user-facing text, labels, states, panels, or
  explanatory UI were introduced.
- Design-system direction improved: the app entry file no longer directly owns
  recent-file host reads, recent-file host clearing, or host menu-state
  de-duplication.
- Regression guard added: tests require the host client import, exported host
  helpers, and bridge method names in the host client, while rejecting direct
  recent/menu bridge calls in the app entry file.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-host-client.mjs`
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
  modal/dialog and proof-only helper logic behind documented module
  boundaries.
