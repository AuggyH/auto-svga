# Short-term Menu Logs Route Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added the short-term macOS menu contract entry for showing logs. The Help menu now exposes `显示日志`, and host menu routing classifies `showLogs` as a renderer-owned command instead of unsupported.

## Git State

- Base before task: `c40fd31e`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-app-state.ts`
- `src/workbench/short-term-command-menu.ts`
- `src/workbench/short-term-host-menu-routing.ts`
- `src/tests/short-term-command-menu.test.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-host-menu-routing.test.ts`
- `src/tests/short-term-prd-trace.test.ts`

## Requirement Checks

- Aligns with `docs/product/PRODUCT_ROADMAP.md`: logs are menu-bar entry points, not main-surface buttons.
- Aligns with `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`: Help menu includes a log entry.
- Does not expose export acceptance, sequence repair, batch replacement, advanced editing, or AI generation.
- Does not decide the still-open appearance/theme menu behavior.

## Verification

- `npm run build && node --test dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-prd-trace.test.js dist/tests/short-term-workbench-facade.test.js`
- `npm run test:all` (390 tests)

## Risks

- `showLogs` is intentionally renderer-delegated. This change defines the command/menu contract; the final UI shell still needs to render the actual logs view.

## Next Steps

- Continue auditing short-term menu and host boundaries against S1-S16 without wiring temporary UI shell code.
