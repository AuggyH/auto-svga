# Rename Workflow Model Redaction Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Hardened the imageKey rename workflow so path-like strings in runtime resource-key input cannot leak into renderer-facing failed models or generated reports. Rename workflow reports and models are redacted before return, matching the image replacement workflow privacy boundary.

## Git State

- Base before task: `6ed95492`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-rename-workflow.ts`
- `src/tests/short-term-rename-workflow.test.ts`

## Requirement Checks

- Keeps successful imageKey and matteKey reference rename behavior unchanged.
- Keeps unsafe target-key failure closed with no output bytes.
- Keeps Save As enablement tied to validated renamed output.
- Prevents path-like rename keys from leaking into failed workflow models.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-rename-workflow.test.js` failed before the implementation because a path-like source key remained in the failed model.
- `npm run build && node --test dist/tests/short-term-rename-workflow.test.js dist/tests/short-term-rename-preview-session.test.js dist/tests/short-term-host-actions.test.js` (43 tests)
- `npm run test:all` (401 tests)

## Risks

- Low. Normal image keys are unchanged; local-path-like strings are redacted in returned workflow reports and models.

## Next Steps

- Run full test and loop validation after commit.
