# Short-Term Menu Command Id Boundary

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Sanitized menu `commandId` values before they are returned in host action
results or diagnostic strings. Routing still uses the original menu input, but
renderer-facing results now expose only known-safe command identifiers or a
generic `unsupported` marker for malformed input.

## Git State

- Base head before task: ee985dac
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-menu-command-id-boundary.md`

## Requirement Checks

- S1/S14/S16 menu dispatch keeps routing behavior unchanged for valid commands.
- Malformed command ids no longer echo local path-like fragments into renderer
  action results.
- No UI shell, product scope, or workflow behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-workbench-facade.test.js`
- `npm run test:all` (374 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; valid command ids preserve their previous result values.
- Next useful mainline task: continue auditing renderer-facing host/session
  payloads for untrusted strings that should be normalized at the boundary.
