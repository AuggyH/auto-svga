# Codex Review: Short-Term Menu Command Routing

## Summary

Tightened the short-term host/menu boundary. Menu commands are now explicitly
classified as host-routed, native-delegated, renderer-delegated, or
unsupported. This prevents enabled macOS/native commands such as copy,
select-all, and minimize from being reported as unrouted host failures, while
keeping file/byte operations owned by the host-action layer.

The Recent submenu item ids (`openRecent:<id>`) are also accepted directly, so
a native menu can trigger a concrete recent row without translating it back to
the root `openRecent` command first.

This is main-engineering contract work only. It does not wire real behavior
into the temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `ec809b6d feat: route short-term close file action`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
  - Added menu route classification.
  - Added delegated action status for native and renderer-owned commands.
  - Added direct handling for `openRecent:<id>` submenu ids.
- `src/tests/short-term-host-actions.test.ts`
  - Covers native delegation, renderer delegation, disabled renderer commands,
    direct Recent submenu opening, and enabled menu item classification
    coverage.

## Requirement Checks

- Mainline priority: P7 desktop-client preparation plus P1 infrastructure.
- PRD alignment: S1 macOS menu opening, S2 playback command surface boundary,
  S14 save/menu behavior, and S16 Recent menu reopening.
- No UI shell wiring, UI polish, telemetry, network dependency, external AI, or
  product-scope expansion.
- No parser, preview renderer, optimization algorithm, replacement workflow,
  sequence repair, or save validation behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-session.test.js`
  - Result: 17 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 324 tests passed.

## Risks

- Delegated commands are not executed by this host-action module. The eventual
  native shell must still map native roles to macOS/Electron and renderer
  commands to the preview runtime.

## Next Steps

- Continue hardening the native-shell contract around command dispatch inputs
  before connecting the real UI shell.
