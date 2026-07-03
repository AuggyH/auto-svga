# Short-term UI/UX WP6AF Dialog Model Split Review

## Summary

Moved short-term dialog helper behavior out of the macOS app entry file into a
dedicated dialog model module. The new module owns open-dialog detection,
closing the currently open dialog, modal show/close lifecycle handling, and
discard-confirmation orchestration. The app entry still owns product flow,
which message is shown, and which state render callback runs when dialog state
changes.

No PRD-owned document, product behavior, visible copy, styling, state name, or
interaction flow was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit status at review time: pending commit

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dialog-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- PRD authority preserved: `docs/product/PRODUCT_ROADMAP.md` remains the only
  product scope authority.
- Short-term scope preserved: discard confirmation, text replacement modal,
  keyboard cancel behavior, and command-state dialog-open behavior are
  unchanged.
- Owner boundary preserved: no new user-facing text, labels, states, panels, or
  explanatory UI were introduced.
- Design-system direction improved: the app entry file no longer directly owns
  modal show lifecycle, open-dialog lookup, or open-dialog close behavior.
- Regression guard added: tests require the dialog model import, exported
  dialog helpers, modal show lifecycle in the dialog model, and reject
  reintroducing direct `showDialog`, `dialog.showModal`, or open-dialog document
  lookup in the app entry file.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dialog-model.mjs`
- `npm run desktop:short-term:design-system-check`
  - Result: passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - First run: failed because one structure assertion still expected the app
    entry to call `renderDiscardMessage(nodes, message)` directly after discard
    confirmation moved to the dialog model callback boundary.
  - Repair: changed that assertion to require the app entry to pass a
    `renderMessage` callback and require the dialog model to call
    `renderMessage(message)`.
  - Final result: 30/30 passed.
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
  proof-only helper logic behind documented module boundaries.
