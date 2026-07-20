# Review: ASV-QA-20260711-001 Alpha2 File-open Terminal Repair

## 1. Summary

Repaired the installed macOS file-open path for the formal 0.2 multi-format
preview mode. The package already handled menu/dialog and drag/drop multi-format
opens, but installed app file-open events from LaunchServices were not routed
into the multi-format session. The repair now queues `open-file` events before
`app.whenReady()`, flushes them after renderer readiness, and renders each
attempt through a generation-bound terminal state.

Status: Fix Ready for Code Review. This is not QA acceptance or a package-ready
claim.

## 2. Git State

- Branch: `codex/0.2-alpha2-file-open-terminal-repair`
- Base: `046cf503f4f65d603c44923bc2a5ba60d718fd3a`
- Source fix commit: `2a33790f8ab48530bf29d2785a6afd5565b37457`
- Final handoff commit: pending after review packet commit
- Untracked files: known classified `.pnpm-store/` residue only

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-action-bridge.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/quality/reports/ASV-QA-20260711-001-file-open-terminal-repair.md`
- `docs/reviews/2026-07-12-codex-asv-qa-20260711-001-alpha2-file-open-terminal-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `review/asv-qa-20260711-001-alpha2-file-open-terminal-repair/`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Diagnose why installed foreground Lottie/VAP file-open returned to Launch without preview or typed failure. | Done: macOS `open-file` event was not handled or routed into 0.2 multi-format session. |
| 2 | Add failure-first source-level coverage for the installed foreground symptom. | Done: new contract fails without `app.on("open-file")` routing and renderer terminal actions. |
| 3 | Make routed Lottie/VAP opens reach preview/playback or visible typed terminal failure. | Done at source boundary: file-open events now invoke `openMultiFormatFilePath(..., "fileOpenEvent")` and renderer terminal actions. |
| 4 | Preserve 0.1 isolation and SVGA behavior. | Done: handler returns before `preventDefault()` outside formal 0.2; short-term bridge only attaches hidden file-open actions when handlers exist. Focused guard and full regression pass. |
| 5 | Preserve path privacy and stale-generation safety. | Done: no raw path is passed to renderer actions; host/session results remain path-redacted; renderer completion is eventId and active-request bound. |
| 6 | Avoid package, promotion, foreground launch, or support claim. | Done. No package/promotion/foreground action performed. |

## 5. Active QA Finding Ledger

| Finding | Round | Source | Outcome | Evidence | Repair State |
|---|---|---|---|---|---|
| `ASV-QA-20260711-001` | Permit `ASV-APR-20260712-009` | Installed build `046cf503` | Changes Requested | LOTTIE-A and VAP-A returned to Launch/open-candidate after exact installed app file-open events; no preview/playback or typed terminal failure. | Source repair locally closed; pending Code Review, rebuild/promotion, and QA foreground regression. |

## 6. Verification

```text
node --test --test-name-pattern "0.2 installed file-open events route" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 1/1

node --test --test-name-pattern "formal 0.1 direct multi-format|0.2 installed file-open|0.2 multi-format desktop session|0.2 renderer open contract" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 5/5

node --check tools/electron-prototype/experiments/svga-web/main.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/preload.cjs
PASS

npm run build
PASS

npm run test:all
PASS 524/524

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS
```

Additional scans:

- Package/lock diff: none.
- Production media/archive changed-file scan: none.
- `TASK_RETRO_LEDGER.jsonl`: parses, 138 lines before this entry.
- Formal 0.1 isolation scan: expected product-mode gate references only; no
  formal 0.1 visible multi-format menu/API widening.

## 7. Risks

- This has not been rebuilt into an installed package. QA foreground regression
  still requires Packaging to rebuild/promote the candidate and QA to rerun the
  installed LOTTIE-A/VAP-A matrix.
- Source tests prove the installed file-open event contract and terminal-state
  routing, not real-material foreground visual success.

## 8. Next Steps

1. Route exact final head to Code Review.
2. If Approved For Packaging/QA, route Release/Packaging for rebuilt alpha2
   candidate and installed metadata/runtime inspection.
3. QA then reruns foreground LOTTIE-A/VAP-A under a fresh permit.

## 9. Commit

- Source fix commit: `2a33790f8ab48530bf29d2785a6afd5565b37457`
- Final handoff commit: pending
- Tag: none

## 10. Project Retrospective

- Value assessment: High
- Cost drivers: installed-only LaunchServices path differed from menu/dialog
  and drag/drop source contracts; repair touched Electron main and renderer
  host bridge so broad regression was warranted.
- Avoidable costs: installed app file-open should have been a first-class
  source contract before foreground QA, not inferred from menu/dialog behavior.
- Product lessons: owner-visible open paths must all reach the same terminal
  preview/failure semantics before foreground acceptance.
- Technical lessons: macOS `open-file` is an independent Electron intake path;
  queue it early and flush only after renderer action readiness.
- Design / interaction lessons: returning to Launch after file selection is a
  broken user state unless the user cancelled; typed terminal feedback is
  required.
- Process lessons: source Fix Ready for installed foreground defects must name
  the rebuild/install/foreground gates separately.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes.

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: targeted source-contract tests avoided unsafe foreground
  reproduction while preserving a full regression gate.
