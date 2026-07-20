# Review: UI/UX Compare Row Order Repair

## 1. Summary

Repaired Code Review re-review blocker `UIUX-CR-002R` for UI/UX repair head `b83b5742`.

The general compare panel now computes one shared compare row order in `renderCompareMetricColumns()` and renders both A/B columns from that same `rowIds` list. Missing counterpart facts still render as `data-diff="unavailable"` with `不可用`, but both columns now keep identical semantic row order even when A and B each have their own unique visible fact.

No product scope, foreground desktop work, packaging, local-stable promotion, or product/QA/Packaging lane files were changed.

## 2. Git state

- Branch: `codex/uiux-redesign-20260710`
- Commit before work: `b83b5742 fix(uiux): repair code review blockers`
- Uncommitted changes before commit: compare model and test only
- Untracked files: none

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-10-codex-uiux-compare-row-order-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Compute one shared compare row order for both A and B columns | Done |
| 2 | Keep missing counterpart cells visibly unavailable | Done |
| 3 | Add direct both-sides-unique visible-fact test | Done |
| 4 | Assert identical A/B label/id order | Done |
| 5 | Existing focused compare and asset-filter tests pass | Done |
| 6 | Design-system check passes | Done |
| 7 | Prepared Electron suite result reported | Done |
| 8 | No packaging, foreground launch, local-stable promotion, product/QA/Packaging files | Done |

## 5. Verification

```bash
$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs
passed

$ node --test --test-name-pattern "short-term general compare" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed: 3/3

$ node --test --test-name-pattern "short-term general compare|short-term asset filters" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed: 4/4

$ npm run desktop:short-term:design-system-check
passed

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
sandbox run: prepared runtime succeeded; 41/44 passed; 3 local-server tests failed with sandbox EPERM on 127.0.0.1 listen

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
non-sandbox rerun: passed 44/44
```

Temporary ignored `node_modules` symlinks reused existing main-worktree dependencies for validation and were removed afterward. No lockfile or dependency declaration changed.

## 6. Output inspection

- Shared row order is computed once: `const rowIds = compareFactIds(aFacts, bFacts)`.
- A and B columns both call `renderCompareMetricColumnHtml(..., rowIds, ...)`.
- Compare metric cells expose `data-fact-id` so direct tests can verify semantic row order.
- The new both-sides-unique test covers A-only `runtimeInvisibleRatio` and B-only `sequenceFanoutRisk`; both rendered columns expose the same id order.

## 7. Risks

- This is a source-level Code Review repair only; it does not include foreground desktop visual acceptance.
- The shared row order currently uses A-first union order, reused for both columns. It closes row divergence; a future canonical ordering table could be added if product/design later wants a fixed cross-file order independent of side A.

## 8. Next steps

- Return this repair as `Fix Ready` to Code Review for another re-review.
- After Code Review approval, continue the next already-authorized bundled UI/UX page-state task.

## 9. Commit

- Commit: this commit; final hash is reported in handoff.
- Branch: `codex/uiux-redesign-20260710`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: re-review found a stronger invariant than the first repair test; prepared suite needed a non-sandbox rerun for local-server tests.
- Avoidable costs: first repair should have tested both-sides-unique facts, not only one-sided missing facts.
- Product lessons: compare accuracy is current `0.1.x` behavior quality, not future product scope.
- Technical lessons: compare row identity should be a shared row model, not independently generated column models.
- Design / interaction lessons: visual compare rhythm only works if semantic row identity is identical across columns.
- Process lessons: Code Review repair tests should encode the full invariant from the reviewer report.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: adversarial direct tests are cheaper than another Code Review loop.
