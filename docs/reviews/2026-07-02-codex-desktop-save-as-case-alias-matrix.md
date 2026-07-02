# Desktop Save As Case Alias Matrix Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Closed the remaining desktop Save As case-alias gap in the Electron host boundary. Edited-output, optimized-output, and sequence-repair Save As now share the same conservative source-path comparison, and the NQ1 safety matrix no longer carries the previous Windows/macOS case-variant deferred risk.

## Git State

- Base before task: `8b53187c`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `src/tests/helpers/nq1-save-as-safety-matrix.ts`
- `src/tests/nq1-save-as-safety-matrix.test.ts`
- `docs/product/EDITOR_TEST_MATRIX.md`

## Requirement Checks

- Save As source protection is shared across edited, optimized, and sequence-repair outputs.
- Case-only source aliases are rejected in the safety matrix for macOS and Windows paths.
- The previous deferred case-variant risk count is now zero.
- IPC sender validation, temporary exclusive writes, redacted responses, and source-id checks remain covered by the matrix.

## Verification

- Failure-first: `npm run build && node --test dist/tests/nq1-save-as-safety-matrix.test.js` failed before the host implementation with `same_source_target_rejected`.
- `npm run build && node --test dist/tests/nq1-save-as-safety-matrix.test.js`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` (28 tests)

## Risks

- Low. The behavior is conservative: if a target is only a case variant of the opened source, users must use the explicit overwrite path instead of Save As.

## Next Steps

- Run full test and loop validation after commit.
