# Short-Term Open Input Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added runtime fail-closed guards for direct local-open and recent-open host
actions. Invalid request shapes now return blocked action results before dirty
guards, loading state, or host file reads can run.

## Git State

- Base head before task: 0de2c43
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-open-input-guard.md`

## Requirement Checks

- S1 local open and S16 recent open keep existing behavior for valid requests.
- Malformed runtime open payloads fail closed without mutating current file,
  active output, or recent state.
- Host file reads are not attempted for malformed requests.
- No UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-node-host-session.test.js`
- `npm run test:all` (379 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; valid input paths keep the same open flow.
- Next useful mainline task: continue checking host action entry points that
  receive renderer/runtime payloads despite TypeScript compile-time types.
