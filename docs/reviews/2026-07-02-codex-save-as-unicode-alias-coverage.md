# Save As Unicode Alias Coverage Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added regression coverage for Unicode-normalized Save As aliases. The host action tests and NQ1 Save As safety matrix now cover NFC/NFD filename variants in addition to same-source and case-only aliases.

## Git State

- Base before task: `4819d542`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/tests/short-term-host-actions.test.ts`
- `src/tests/helpers/nq1-save-as-safety-matrix.ts`
- `src/tests/nq1-save-as-safety-matrix.test.ts`

## Requirement Checks

- The existing Save As behavior is unchanged.
- Host action coverage rejects Unicode-normalized target aliases without writing output.
- The cross-platform safety matrix records macOS and Windows Unicode-normalized alias scenarios.
- The matrix still reports zero deferred Save As safety risks.

## Verification

- `npm run build && node --test dist/tests/short-term-host-actions.test.js dist/tests/nq1-save-as-safety-matrix.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-command-menu.test.js` (51 tests)

## Risks

- Low. This is coverage-only and exercises the canonical path behavior introduced in the previous Save As guard work.

## Next Steps

- Run full test and loop validation after commit.
