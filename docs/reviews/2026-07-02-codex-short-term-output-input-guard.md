# Short-Term Output Input Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added runtime fail-closed guards for direct imageKey rename and image
replacement host actions. Malformed renderer/runtime payloads now return
blocked action results before lower-level workflow code can throw or mutate
output state.

## Git State

- Base head before task: 91c394d7
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-output-input-guard.md`

## Requirement Checks

- S11 imageKey rename and S12 image replacement keep existing behavior for
  valid requests.
- Malformed rename/replacement payloads fail closed without producing dirty
  output.
- Dirty confirmation flags are read safely from runtime payloads.
- No UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-node-host-session.test.js`
- `npm run test:all` (380 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; only invalid runtime payload paths changed.
- Next useful mainline task: continue hardening direct save/playback/text
  preview action inputs where runtime payloads can bypass TypeScript types.
