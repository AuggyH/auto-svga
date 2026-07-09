# Review: UI/UX Code Review Repair

## 1. Summary

Repaired the three blocking findings from `2026-07-10-codex-code-review-uiux-redesign-migration.md` for UI/UX head `a08f143a`.

- `UIUX-CR-001`: general compare now imports the shared metric renderer and has a direct loaded A/B compare render test.
- `UIUX-CR-002`: compare facts now align by fact `id`; missing counterparts render as `unavailable` instead of `same`.
- `UIUX-CR-003`: asset filters now support roving keyboard semantics through Arrow/Home/End and preserve focus after filter changes.
- The migration review now names the actual in-scope runtime behavior changes instead of claiming no behavior changed.

No new product scope, foreground desktop work, packaging, local-stable promotion, or product/QA/Packaging lane files were changed.

## 2. Git state

- Branch: `codex/uiux-redesign-20260710`
- Commit before work: `a08f143a chore(uiux): migrate worktree changes to dedicated branch`
- Uncommitted changes before commit: UI/UX repair files only
- Untracked files: none

## 3. Changed files

- `docs/reviews/2026-07-10-codex-uiux-worktree-quarantine-migration.md`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-renderers.mjs`
- `docs/reviews/2026-07-10-codex-uiux-code-review-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Bind/import `renderMetricValueHtml` correctly in compare render path | Done |
| 2 | Add direct executable loaded A/B compare render test | Done |
| 3 | Align compare facts by `id` | Done |
| 4 | Missing counterpart must be visibly unavailable/different, not same | Done |
| 5 | Add asymmetric visible-fact test | Done |
| 6 | Implement usable roving-tab or equivalent keyboard semantics for asset filters | Done |
| 7 | Cover Arrow/Home/End behavior and focus preservation with direct tests | Done |
| 8 | Update migration review to name runtime behavior changes | Done |
| 9 | Do not touch PM/QA/Packaging/product requirement files | Done |
| 10 | Do not package, promote local stable app, or launch foreground client | Done |

## 5. Verification

```bash
$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs
passed

$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-model.mjs
passed

$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-renderers.mjs
passed

$ node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-event-bindings.mjs
passed

$ node --test --test-name-pattern "short-term general compare|short-term asset filters" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed: 3/3

$ npm run desktop:short-term:design-system-check
passed

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
initial sandbox run: prepared runtime succeeded; 40/43 passed; 3 local-server tests failed with sandbox EPERM on 127.0.0.1 listen

$ npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
non-sandbox rerun: passed 43/43

$ git diff --check
passed
```

Temporary ignored `node_modules` symlinks were used only to reuse already-present dependencies from the main worktree and were removed after validation. No lockfile or dependency declaration changed.

## 6. Output inspection

- Compare render: loaded A/B facts render through the shared metric-value HTML path, including unit splitting.
- Compare alignment: visible facts are unioned by fact `id`; both sides render the same fact order; unavailable counterpart cells show `data-diff="unavailable"` and `不可用`.
- Asset filters: `ArrowRight`/`ArrowDown` move forward, `ArrowLeft`/`ArrowUp` move backward, `Home` moves to first tab, `End` moves to last tab. Focus returns to the newly selected tab when the filter tablist held focus before re-render.

## 7. Risks

- This repair does not include foreground desktop visual evidence because the Code Review task explicitly requested no foreground work.
- The asset-filter focus test covers the pure model and exported interaction handler, not a full browser DOM tab traversal.

## 8. Next steps

- Send this repair commit back to Code Review as `Fix Ready`.
- After Code Review approval, continue the next already-authorized bundled UI/UX page-state task from the same dedicated UI/UX branch.

## 9. Commit

- Commit: this commit; final hash is reported in handoff.
- Branch: `codex/uiux-redesign-20260710`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: had to repair source behavior, tests, and review wording together because the original migration bundled runtime UI changes with worktree governance.
- Avoidable costs: compare and tablist behavior should have had direct tests before Code Review; relying on design-system smoke alone missed interaction semantics.
- Product lessons: UI/UX migration wording must distinguish "no out-of-scope product capability" from "no runtime behavior changed".
- Technical lessons: A/B compare surfaces should align facts by durable IDs, not array position or whichever side happens to have a row.
- Design / interaction lessons: roving tab UI is incomplete unless keyboard behavior and focus restoration are implemented with the visual selected state.
- Process lessons: for Code Review repair, direct model/interaction tests are faster and clearer than re-running broad visual validation first.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: keep CR repairs tightly tied to blocker IDs and run targeted tests before broad prepared suites.
