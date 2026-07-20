# Short-Term Recent Parser Guard

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Hardened short-term recent-file state normalization against malformed persisted
records. Invalid records are skipped, and invalid availability values now fall
back to `available` instead of entering the owner-visible recent-file model.

## Git State

- Base head before task: 9620c268
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-recent-files.ts`
- `src/tests/short-term-node-recent-files-store.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-recent-parser-guard.md`

## Requirement Checks

- S16 recent-file storage continues to preserve full paths only in host storage.
- Renderer-facing recent-file records still hide full local paths.
- Malformed persisted records no longer poison the recent-file model.
- Valid persisted records are preserved when neighboring records are malformed.
- No temporary UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-node-recent-files-store.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-node-host-session.test.js`
- `npm run test:all` (383 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; valid records keep existing normalization, sort, and redaction
  behavior.
- Next useful mainline task: inspect host/session command snapshots and
  renderer-safe serialization for any remaining mutation leaks.
