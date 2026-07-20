# Local Path Apostrophe Redaction Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Fixed a generic local-path redaction gap where macOS or Windows paths containing an apostrophe could be split into partial matches and leave path fragments visible in diagnostics. Apostrophes inside path segments now stay within the redacted path match.

## Git State

- Base before task: `798b4f20`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-local-path-redaction.ts`
- `src/tests/short-term-local-path-redaction.test.ts`

## Requirement Checks

- Keeps exact sensitive-path replacement behavior unchanged.
- Preserves generic macOS and Windows path redaction.
- Redacts generic paths with apostrophes in folder names without leaving partial path fragments.
- Keeps nested renderer-facing value redaction cloning behavior intact.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-local-path-redaction.test.js` failed before the implementation because `Frame's Folder` was only partially redacted.
- `npm run build && node --test dist/tests/short-term-local-path-redaction.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js` (57 tests)
- `npm run test:all` (398 tests)

## Risks

- Low. The regex change only broadens apostrophes inside already-detected local path spans; existing delimiter behavior for semicolons, quotes, parentheses, and newlines is preserved.

## Next Steps

- Run full test and loop validation after commit.
