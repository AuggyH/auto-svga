# Review: lucky-notice-runtime-structure-case

## 1. Summary

Analyzed three real production SVGA files from the lucky notice module and
captured the performance root cause as a production case retrospective.

The key finding is that `bg_lucky_notice_all.svga` and
`bg_lucky_notice_end.svga` are not mainly risky because of embedded image
memory. They are risky because repeated 24-frame coin sequences expand into
thousands of SVGA sprite records and hundreds of thousands of `FrameEntity`
records. This can explain why a file with modest encoded size and about
1.10 MiB decoded image memory may still approach about 20 MiB runtime memory
on phones.

Promoted runtime structure diagnostics and optimization into the short-term
PRD as required capabilities S17 and S18.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `969e0ca2`
- Uncommitted changes before this task: unrelated UI/UX implementation files
  already existed and were left untouched.
- Untracked files before this task: none related to this task.

Unrelated working-tree files observed and not staged:

- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`

## 3. Changed files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/retrospectives/production-cases/2026-07-07-lucky-notice-svga-runtime-structure-memory.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-07-codex-lucky-notice-runtime-structure-case.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Analyze `bg_lucky_notice_all.svga` and `bg_lucky_notice_start.svga` together with the earlier `bg_lucky_notice_end.svga`. | Done |
| 2 | Record the real production case in the repository without committing production assets. | Done |
| 3 | Document the exposed problem, likely solution paths, and Auto SVGA product implications. | Done |
| 4 | Update PRD if Auto SVGA can solve this class of issue. | Done |
| 5 | Promote the capability as a must-do item instead of leaving it only to design or client engineering. | Done |

## 5. Verification

Commands run and results:

```text
rg runtime-structure/S17/S18 terms
found the new product requirements, acceptance rows, memory model, optimization methods, sample matrix entry, and production case references

git diff --check
passed

node -e parse TASK_RETRO_LEDGER.jsonl
passed

git diff --cached --name-only
confirmed staged files are documentation only and contain no production media assets
```

## 6. Output inspection

- `bg_lucky_notice_start.svga`: 72.1 KiB, 687 x 192, 60 FPS / 60 frames,
  2 images, 2 sprites, 120 `FrameEntity` records, about 1.01 MiB decoded
  image memory.
- `bg_lucky_notice_all.svga`: 342.6 KiB, 981 x 360, 20 FPS / 80 frames,
  36 images, 2703 sprites, 216,240 `FrameEntity` records, about 4.85 MiB
  decoded image memory.
- `bg_lucky_notice_end.svga`: 163.3 KiB, 432 x 192, 60 FPS / 120 frames,
  27 images, 2883 sprites, 345,960 `FrameEntity` records, about 1.10 MiB
  decoded image memory.
- `all` and `end` both contain a 24-frame coin sequence fanned out across many
  instances. `start` does not show the same runtime-structure issue.
- Temporary visual/contact-sheet evidence was kept under
  `/tmp/auto-svga-lucky-notice-case/` and intentionally not committed.

## 7. Risks

- The rough runtime memory estimate is calibrated from one client-reported
  production case. It is useful for warning, but target-player-specific
  profiling is still needed for final thresholds.
- Low-alpha pruning is not universally lossless. It should remain review-only
  unless a target-player threshold profile is explicitly selected and
  validated.
- Sequence-fanout rebake/collapse may produce large visual or file-size trade
  offs and needs before/after playback comparison.

## 8. Next steps

- Implement S17 inspection metrics in the SVGA analyzer.
- Add at least one synthetic high-fanout fixture so the risk detector is not
  dependent on production assets.
- Implement S18 safe all-zero sprite pruning first, then add review-gated
  low-alpha/FPS/sequence-fanout optimizations.
- Feed runtime-structure risk into AEB export planning so the AE bridge can
  prevent this pattern before handoff.

## 9. Commit

- Commit: pending at review creation
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: three real SVGA samples had to be parsed, summarized, compared,
  and translated into PRD-level requirements without committing production
  assets.
- Avoidable costs: future performance cases should start from a reusable
  `svga structure stats` command/report so manual comparison is cheaper.
- Product lessons: decoded image memory, encoded file size, and image count are
  insufficient performance gates; runtime structure risk is a first-class
  product requirement.
- Technical lessons: repeated sequence animation can explode sprite and frame
  records even when embedded image assets remain small.
- Design / interaction lessons: the product UI must explain why a small-looking
  file is still high risk, otherwise users will distrust the warning.
- Process lessons: real production incidents should be promoted into PRD only
  after the cause is measurable and the mitigation path is bounded.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: when analyzing real media incidents, first extract a compact
  structural table, then inspect visuals only for the few files that explain
  the anomaly.
