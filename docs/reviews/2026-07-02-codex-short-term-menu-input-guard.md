# Short-Term Menu Input Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added a runtime fail-closed guard for malformed menu dispatch input. Valid menu
commands still route normally, but missing or non-string `commandId` values now
return a blocked host action result instead of throwing before product-state
handling.

## Git State

- Base head before task: e822507b
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-menu-input-guard.md`

## Requirement Checks

- S1/S14/S16 menu dispatch remains unchanged for valid commands.
- Malformed runtime menu payloads fail closed with a renderer-safe action
  result.
- No UI shell, layout, or product scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-command-menu.test.js`
- `npm run test:all` (378 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; the change only handles invalid runtime input before normal
  routing.
- Next useful mainline task: keep auditing host-facing entry points for runtime
  input shapes that TypeScript alone cannot protect at IPC boundaries.
