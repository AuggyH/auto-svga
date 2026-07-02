# Host Menu Dispatch Contract Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added a regression contract that derives Host-routed command items from the short-term macOS menu model and executes every one through `dispatchShortTermHostMenuAction()`. This prevents menu entries from drifting into no-op or unrouted Host actions while UI/UX continues separately.

## Git State

- Base before task: `2550b15d`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/tests/short-term-host-actions.test.ts`

## Requirement Checks

- Covers every Host-routed menu command item exposed by the current command menu model.
- Verifies each scenario completes and returns the expected action kind.
- Fails if a Host-routed menu item reaches the `menu_command_not_routed` fallback.
- Does not wire the temporary UI shell or add owner-visible UI behavior.

## Verification

- `npm run build && node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js` (44 tests)
- `npm run test:all` (394 tests)

## Risks

- Test setup uses synthetic SVGA fixtures and memory-backed host I/O, so it validates the host/action contract rather than a packaged macOS runtime menu.

## Next Steps

- Run loop validation before commit.
