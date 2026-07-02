# Codex Review: Short-Term Host Menu Routing Module

## Summary

Extracted short-term menu command routing rules into a dedicated host-boundary
module. The host action adapter still re-exports the classifier for existing
callers, but route ownership, Recent submenu id parsing, native delegation, and
renderer delegation no longer live as inline constants inside the action
executor.

This is a code-quality and maintainability pass over the previous menu routing
work. It does not change product behavior or wire real behavior into the
temporary UI/UX shell.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `30cd627b feat: classify short-term menu command routing`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-menu-routing.ts`
  - Added route classification helpers.
  - Added Recent submenu id parser.
  - Added native-delegation predicate.
- `src/workbench/short-term-host-actions.ts`
  - Uses the new routing helper module and keeps behavior unchanged.
- `src/tests/short-term-host-menu-routing.test.ts`
  - Covers host/native/renderer/unsupported classification, Recent submenu id
    parsing, and native-delegation boundaries.

## Requirement Checks

- Mainline priority: P1 infrastructure plus P7 desktop-client preparation.
- PRD alignment: keeps S1/S2/S14/S16 menu and host boundaries explicit without
  adding new product scope.
- No UI shell wiring, UI polish, telemetry, network dependency, external AI, or
  product-scope expansion.
- No parser, preview renderer, optimization algorithm, replacement workflow,
  sequence repair, or save validation behavior change.

## Verification

- `npm run build` passed.
- Targeted tests passed: `node --test dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-command-menu.test.js`
  - Result: 17 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 327 tests passed.

## Risks

- None beyond the prior menu-routing behavior. This change only moves routing
  rules into a smaller module with direct tests.

## Next Steps

- Continue auditing native-shell integration seams while keeping UI-shell
  wiring deferred until stable integration points exist.
