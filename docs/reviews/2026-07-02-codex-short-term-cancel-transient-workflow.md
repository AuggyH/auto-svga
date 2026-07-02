# Short-term Cancel Transient Workflow Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a product-routed cancel action for short-term transient outputs. The Edit menu now exposes `Esc` / "取消当前操作" for active optimization comparison and imageKey rename previews only, returning the Workbench state to source preview and dropping unsaved transient output.

## Git State

- Base before task: `abf205ce`
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

- Covers S10 cancel/back behavior for optimization comparison.
- Covers S11 Esc/cancel behavior for imageKey rename preview.
- Keeps S14 save state truthful by disabling Save As after cancelled transient output is discarded.
- Fails closed when no file is open, no transient output exists, or a rename attempt failed without producing output.
- Does not touch the temporary UI shell, visual layout, parser internals, exporter bytes, or packaged App artifacts.

## Verification

- `npm run build && node --test dist/tests/short-term-app-state.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-prd-trace.test.js dist/tests/short-term-workbench-facade.test.js` (64 tests)
- `npm run test:all` (392 tests)
- `git diff --check`

## Risks

- The final UI shell still needs to consume the command/menu model. This change only adds the main-process/action contract and state semantics.
- Cancel currently applies to optimization comparison and rename preview. Image and text replacement keep their explicit reset flows.

## Next Steps

- Run full repository tests and loop validation before commit.
- Continue auditing short-term Host/menu action boundaries for stale enabled states, false completed actions, and missing fail-closed behavior.
