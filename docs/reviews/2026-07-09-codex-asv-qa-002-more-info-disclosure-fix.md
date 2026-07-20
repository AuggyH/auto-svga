# Review: ASV-QA-20260709-002 More Info Disclosure Fix

## Summary

- Fixed the Preview right information surface so runtime-structure secondary diagnostics are available behind `更多信息`.
- Kept warning/fail runtime-structure fields promoted in the default summary.
- Added focused regression coverage for the disclosure grouping and package-inspection markers.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Fix commit: `fa0ca9f6ed5beb589b00dd1593d8379abb87476d`
- Pre-existing unrelated dirty files were present before this repair and were not included in the implementation commit.

## Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Add owner-visible `更多信息` or equivalent expanded secondary-details state. | Done |
| 2 | Preserve default promotion for medium/high risk, warning copy, and optimization-candidate fields. | Done |
| 3 | Preserve friendly terminology and avoid `SpriteEntity`, `FrameEntity`, `图层数`, `图层过多` in default renderer. | Done |
| 4 | Do not close QA directly; return Fix Ready with report/evidence. | Done |
| 5 | Refresh owner local stable app before QA owner-baseline regression. | Pending Release/Packaging |

## Verification

- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-runtime-structure-more-info.test.mjs`: PASS, 2/2.
- `git diff --check` on touched implementation/test files: PASS.
- `npm run build`: PASS.
- `node --test dist/tests/runtime-structure-diagnostics.test.js dist/tests/svga-image-optimizer.test.js dist/tests/short-term-optimization-workflow.test.js dist/tests/short-term-product-model.test.js dist/tests/asset-intelligence.test.js`: PASS, 19/19.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: PASS, 39/39 after rerun with local listener permission for `127.0.0.1`.

## Risks And Follow-Up

- QA cannot regress the owner-used baseline until `/Users/huangtengxin/Applications/Auto SVGA.app` is refreshed to include `fa0ca9f6ed5beb589b00dd1593d8379abb87476d` or a descendant.
- The fix is deliberately narrow; it does not add new optimization capability or change runtime structure thresholds.

## Project Retrospective

- Lesson: when product policy allows secondary diagnostics behind disclosure, the render model needs a grouped contract rather than a lossy visible-only filter.
- Process note: source-level acceptance should include package-inspection marker tests for UI states that QA validates by `app.asar` inspection.
- Ledger update: skipped in this commit because `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` already has unrelated uncommitted changes in the worktree.
