# Short-Term Save Input Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added runtime fail-closed guards for short-term Save / Save As host action
payloads. Malformed save commands or non-string target paths now return a
blocked action result before any write attempt, while preserving existing dirty
output so the user can still save through a valid action.

## Git State

- Base head before task: 5a0b2d42
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-save-input-guard.md`

## Requirement Checks

- S14 save behavior is unchanged for valid Save and Save As requests.
- Invalid save commands fail closed without pretending to be Save As.
- Non-string Save As target paths fail closed without writing or leaking local
  paths in action diagnostics.
- Dirty optimized output remains available after malformed save requests.
- No temporary UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-save-execution.test.js`
- `npm run test:all` (381 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; only invalid runtime payload paths changed.
- Next useful mainline task: continue hardening playback/runtime text-preview
  action inputs and host/session seams that can receive untyped renderer data.
