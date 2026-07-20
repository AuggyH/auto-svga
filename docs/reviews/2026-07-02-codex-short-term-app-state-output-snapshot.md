# Short-Term App State Output Snapshot

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Hardened `attachShortTermPersistedOutput` so persisted output metadata is
cloned before entering short-term app state. External mutation of a
caller-owned output record can no longer change renderer-facing save
availability, validation refs, or dirty-output metadata after attachment.

## Git State

- Base head before task: ada66771
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-app-state.ts`
- `src/tests/short-term-app-state.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-app-state-output-snapshot.md`

## Requirement Checks

- S14 save menu enablement remains derived from attached persisted output.
- App state now owns a snapshot of persisted output metadata.
- Opening another file still clears dirty persisted output.
- No temporary UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-app-state.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-save-state.test.js`
- `npm run test:all` (386 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; this matches the facade/session snapshot strategy already in place.
- Next useful mainline task: continue auditing save execution result and
  renderer-safe serialization surfaces for mutation and redaction gaps.
