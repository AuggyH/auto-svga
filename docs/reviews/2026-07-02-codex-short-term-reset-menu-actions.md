# Short-term Reset Menu Actions Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added product-routed reset actions for short-term image replacement and runtime text preview. The Resource menu now contains reset entries, and their enabled state follows real image/text preview sessions instead of being always available.

## Git State

- Base before task: `7e2acd8b`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-app-state.ts`
- `src/workbench/short-term-command-menu.ts`
- `src/workbench/short-term-host-actions.ts`
- `src/workbench/short-term-host-menu-routing.ts`
- `src/workbench/short-term-prd-trace.ts`
- `src/workbench/short-term-workbench-facade.ts`
- `src/tests/short-term-app-state.test.ts`
- `src/tests/short-term-command-menu.test.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-host-menu-routing.test.ts`
- `src/tests/short-term-prd-trace.test.ts`
- `src/tests/short-term-workbench-facade.test.ts`

## Requirement Checks

- Covers S12 reset for image replacement preview.
- Covers S13 reset for runtime text preview.
- Keeps reset actions disabled until there is an actual preview replacement to clear.
- Does not touch temporary UI shell code or expose deferred editor features.

## Verification

- `npm run build && node --test dist/tests/short-term-app-state.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-prd-trace.test.js dist/tests/short-term-workbench-facade.test.js`
- `npm run test:all` (391 tests)

## Risks

- The final UI shell still needs to render these menu items from the command model. This change only makes the main-process/action contract truthful and reviewable.

## Next Steps

- Continue checking short-term Host/menu actions for false-completed states and stale enabled/disabled conditions.
