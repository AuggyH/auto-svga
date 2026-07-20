# Short-Term Save State Source Name Boundary

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Added a final `sourceName` sanitization guard at
`createShortTermPersistedOutputRecord`, the shared constructor for
renderer-facing save records. This keeps future output-producing workflows from
leaking path-like source names into save state even if they forget to sanitize
their own options first.

## Git State

- Base head before task: ecaaa955
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-save-state.ts`
- `src/tests/short-term-save-state.test.ts`
- `docs/reviews/2026-07-02-codex-short-term-save-state-source-name-boundary.md`

## Requirement Checks

- S14 persisted output records keep source names display-safe.
- Existing save availability and read-back validation behavior is unchanged.
- No UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-save-state.test.js dist/tests/short-term-path-display.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-optimization-compare-session.test.js dist/tests/short-term-rename-preview-session.test.js`
- `npm run test:all` (373 passed)
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; the change only sanitizes a display field.
- Next useful mainline task: continue auditing renderer-facing records for
  duplicated sanitization logic that can be centralized.
