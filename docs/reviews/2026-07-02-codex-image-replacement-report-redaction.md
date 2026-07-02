# Image Replacement Report Redaction Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Extended image replacement workflow redaction from the renderer-facing model to the returned round-trip report. Path-like resource keys from malformed or privacy-sensitive SVGA inputs can no longer leak through replacement proof reports.

## Git State

- Base before task: `9c817d26`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-image-replacement-workflow.ts`
- `src/tests/short-term-image-replacement-workflow.test.ts`

## Requirement Checks

- Keeps successful supported PNG replacement behavior unchanged.
- Keeps indexed PNG replacement support unchanged.
- Keeps model redaction for failed replacement paths.
- Adds round-trip report redaction for successful replacement paths.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-image-replacement-workflow.test.js` failed before the implementation because a path-like resource key remained in `roundTripReport`.
- `npm run build && node --test dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-host-actions.test.js` (46 tests)
- `npm run test:all` (403 tests)

## Risks

- Low. Normal resource keys and replacement bytes are unchanged; only path-like strings in returned proof reports are redacted.

## Next Steps

- Run full test and loop validation after commit.
