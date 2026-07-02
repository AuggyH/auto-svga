# Image Replacement Model Redaction Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Hardened the image replacement workflow model boundary so path-like strings in runtime `imageKey` input cannot leak local path fragments into renderer-facing failure models. Replacement workflow models are now redacted before return, covering diagnostics and model fields.

## Git State

- Base before task: `cf633604`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-image-replacement-workflow.ts`
- `src/tests/short-term-image-replacement-workflow.test.ts`

## Requirement Checks

- Keeps normal supported PNG replacement behavior unchanged.
- Keeps indexed PNG replacement support unchanged.
- Keeps unsafe replacement failure closed with no output bytes.
- Prevents path-like replacement keys from leaking into renderer-facing workflow models.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-image-replacement-workflow.test.js` failed before the implementation because a path-like `imageKey` remained in the failed model.
- `npm run build && node --test dist/tests/short-term-image-replacement-workflow.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-host-actions.test.js` (45 tests)
- `npm run test:all` (400 tests)

## Risks

- Low. Normal resource keys are unchanged; only local-path-like strings are redacted in returned workflow models.

## Next Steps

- Run full test and loop validation after commit.
