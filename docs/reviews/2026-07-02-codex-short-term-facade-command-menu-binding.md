# Codex Review: Facade Command Menu Binding

## Summary

Bound the short-term command-menu contract into `ShortTermWorkbenchFacadeModel`. Future UI or host adapters can now read one facade model for app state, command availability, recent files, active output, active workflow, and native-menu-ready command groups.

This keeps command availability synchronized between app state and menu state, including Save As after a validated output, after failed no-output workflows, and after save completion.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `2d40f6e feat: add short-term command menu contract`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-workbench-facade.ts`
  - Added `commandMenu` to the facade model.
  - Derives menu state from the same `ShortTermAppStateModel` used by the facade.
- `src/tests/short-term-workbench-facade.test.ts`
  - Verifies facade launch state includes command-menu groups.
  - Verifies Save As availability stays aligned across app state and command menu.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-app-state.test.js`
  - Result: 17 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 303 tests passed.

## Risks

- This is still a model contract. Native Electron/macOS menu dispatch remains future host-adapter work.

## Next Steps

- Add a small host-action adapter for open, recent-open, save, and menu dispatch once the native shell boundary is ready.
