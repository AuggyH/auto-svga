# Recent File ID Uniqueness Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Hardened restored recent-file records so duplicate host-provided ids cannot produce duplicate renderer/menu ids. When a duplicate id is encountered, the later record now falls back to a stable path-hash recent id.

## Git State

- Base before task: `2bdd9636`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-recent-files.ts`
- `src/tests/short-term-recent-files.test.ts`

## Requirement Checks

- Preserves local-path de-duplication.
- Keeps normal explicit ids unchanged when unique.
- Ensures renderer/menu recent records have unique ids even when restored host data is malformed or duplicated.
- Verifies each generated id can still resolve to a recent-open request.

## Verification

- `npm run build && node --test dist/tests/short-term-recent-files.test.js dist/tests/short-term-node-recent-files-store.test.js dist/tests/short-term-host-session.test.js dist/tests/short-term-host-actions.test.js` (66 tests)
- `npm run test:all` (396 tests)

## Risks

- Low. Only duplicate restored ids are rewritten; unique ids and path-based default ids keep existing behavior.

## Next Steps

- Run loop validation after commit.
