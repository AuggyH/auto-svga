# Codex Review: Short-Term Command Menu Contract

## Summary

Added a TypeScript command-menu contract for the short-term product state. The model converts `ShortTermAppStateModel.commands` into grouped native-menu-ready sections for App, File, Edit, Resource, Optimize, Playback, View, Window, and Help without depending on the temporary UI shell.

The contract keeps recent-file entries path-redacted, maps standard text operations to native roles, normalizes macOS accelerators, and fails closed if the app-state command list drifts without a menu mapping.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `7eabbaf feat: add short-term workbench facade`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-command-menu.ts`
  - Added the command-menu schema and menu item/group model.
  - Added conversion from app-state commands to native-menu-ready menu groups.
  - Added flattening helper for validation and future host adapters.
- `src/tests/short-term-command-menu.test.ts`
  - Covers command coverage, recent path redaction, native text roles, Save/Save As state, macOS accelerator normalization, and command-contract drift failure.

## Requirement Checks

- Keeps Product Roadmap as the scope authority.
- Does not wire real functionality into the temporary UI/UX shell.
- Provides a backend contract for future macOS menu integration and standard text operations.
- Does not add deferred editor workflows or sequence repair menu claims.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-command-menu.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-workbench-facade.test.js`
  - Result: 17 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 303 tests passed.

## Risks

- Electron/native menu wiring is still future work. This change only provides the product-engine contract.
- The temporary shell has its own JavaScript command model; it remains historical/shell scaffolding until UI/UX provides integration-ready contracts.

## Next Steps

- Continue by adding a small host-action adapter contract around open, recent-open, save, and menu-dispatch operations.
- Keep command availability derived from `ShortTermAppStateModel` so UI and native menus stay consistent.
