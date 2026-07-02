# Codex Review: Short-Term Close File Action

## Summary

Closed a menu-action gap in the short-term host boundary. The command menu
already exposed `closeFile`; this change adds the facade and host-action route
so closing the current file returns to launch state, clears current source and
dirty output, and keeps recent records available.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `d0cadf53 feat: compose short-term node host session`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-workbench-facade.ts`
  - Added `closeShortTermWorkbenchFile`.
- `src/workbench/short-term-host-actions.ts`
  - Added `closeFile` host action kind and menu route.
  - Clears current local path and active output bytes while preserving recent
    state.
- `src/tests/short-term-workbench-facade.test.ts`
  - Covers close returning to launch state without losing recent rows.
- `src/tests/short-term-host-actions.test.ts`
  - Covers close after an unsaved optimization output and verifies dirty output
    cleanup, recent retention, disabled close state, and path redaction.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S1/S16 host state recovery and menu-action completeness.
- No UI shell wiring, UI polish, telemetry, network dependency, or external AI.
- No parser, preview, optimization algorithm, replacement workflow, sequence
  repair, save validation, or product-scope expansion.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-host-session.test.js`
  - Result: 18 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 321 tests passed.

## Risks

- Closing a dirty output currently discards the in-memory output without a
  separate confirmation model. This matches the current host-contract boundary
  but the eventual UI shell may need a native confirmation dialog before it
  calls the close action.

## Next Steps

- Continue auditing enabled command-menu entries against host-action routes
  before wiring the real native shell.
