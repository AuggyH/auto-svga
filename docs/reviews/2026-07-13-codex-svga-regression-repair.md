# Review: ASV-QA-20260711-001 SVGA Regression Repair

## 1. Summary
Restored the remaining SVGA regression boundary for the accepted routed SVGA-A material without rerunning Lottie or VAP lifecycle work. The accepted material was located by SHA-256 only in approved local material scope, then exercised through a hidden/non-foreground packaged-equivalent Electron session.

The first failure was a source payload boundary: SVGA sources larger than the 256 KiB probe window could be detected by range read but could not be parsed because the workspace required an unavailable bounded full read. The second failure was a desktop headless playback contract gap: the SVGA playback adapter entered ready state but returned no `value`, so the shared workspace classified playback as failed.

The repair adds a bounded local full-read path for accepted local sources up to 50 MiB, keeps probe range reads bounded, adds read-after-stat size verification in the desktop host, and returns a minimal SVGA playback value contract from the headless desktop adapter.

## 2. Git State
- Branch: `codex/0.2-svga-regression-repair-20260713`
- Base/source head before work: `3547156e4ffaac65a56bd07a9c55c0f2a24435d5`
- Uncommitted changes at review write: implementation, tests, review, and retrospective only
- Untracked files: classified `.pnpm-store/` residue only
- Temporary dependency overlay: removed before final validation
- Temporary proof script: removed before commit

## 3. Changed Files
- `src/workbench/multiformat-preview-workspace.ts`
- `src/tests/multiformat-preview-workspace.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-13-codex-svga-regression-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260711-001-svga-regression-repair-20260713/REVIEW_PACKET.md`

## 4. Requirement Checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not regenerate or tune synthetic SVGA fixture | Done |
| 2 | Locate accepted SVGA material by full SHA only in approved roots | Done |
| 3 | Do not publish raw material path in durable docs/callbacks | Done |
| 4 | Run hidden/non-foreground packaged-equivalent Electron SVGA open/playback proof | Done |
| 5 | Bind source head, input hash/alias, open status, model state, cleanup, no external requests | Done |
| 6 | Preserve VAP green and Lottie accepted evidence without rerun | Done |
| 7 | No installed app, foreground, Finder/dialog, save/export/conversion, QA, Packaging | Done |

## 5. Verification
```text
Hidden Electron proof:
PASS /var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-svga-regression-proof-96603/svga-regression-proof.json
SHA-256 f55e627978f397e46fc62f1e16f0b693bfd2b3d83daeadd4dbefe9fd29be5af5
Input alias SVGA-A, input SHA-256 d7315b1e6ba5fdecc7bb071dc6734c3e3948cff1b96c27b94467cae5e56a5193
Model states: previewReady -> playing -> paused
External requests: []
Runtime cleanup counters: no Lottie/VAP loads or object URLs
```

```text
npm run build
PASS

node --test --test-name-pattern 'accepted SVGA payloads|normalizes SVGA' dist/tests/multiformat-preview-workspace.test.js
PASS 2/2

node --test --test-name-pattern 'headless SVGA playback|desktop session opens synthetic|installed file-open source' tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 4/4

node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

npm run test:all
PASS 528/528

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS

TASK_RETRO_LEDGER JSONL parse
PASS 147 rows before this entry

package/lockfile changed-path scan
PASS no output

production media/archive changed-path scan
PASS no output
```

## 6. Output Inspection
- Hidden proof source head: `3547156e4ffaac65a56bd07a9c55c0f2a24435d5`
- Product milestone: `0.2-multiformat-preview`
- SVGA-A accepted input: hash-bound only; raw path redacted
- Parser/open result: accepted and completed
- Model result: `previewReady`, then `playing`, then `paused`
- Active issue codes: none
- Visible content tokens in proof: `SVGA`, `资源`, `图层`, `可替换`
- Note: the proof snapshot includes stale textContent in an inactive error node, but active model issues are empty and active body text did not surface the failure copy. Foreground QA remains the right gate for user-visible final judgment.

## 7. Risks
- This is source/hidden packaged-equivalent evidence, not installed-app foreground QA.
- The 50 MiB local full-read cap is intentionally conservative for local SVGA parsing; larger local sources still fail closed.
- Lottie and VAP were not rerun by design; their prior accepted fact sources remain authoritative for this route.

## 8. Next Steps
- Route this exact repair head to Code Review only.
- Do not route QA or Packaging until Code Review disposition.

## 9. Commit
- Commit: pending at review write
- Branch: `codex/0.2-svga-regression-repair-20260713`
- Tag: none

## 10. Project Retrospective
- Value assessment: High
- Cost drivers: accepted material was larger than the probe window, and the hidden desktop SVGA adapter had not previously needed to return a normalized playback value.
- Avoidable costs: the accepted-material proof should have been in the matrix before positive VAP/Lottie closure.
- Product lessons: SVGA regression evidence needs one real accepted owner/test material path through the same multi-format workspace, not only synthetic SVGA fixtures.
- Technical lessons: range-only detection and full parsing have different byte needs; bounded full-read capability must be explicit and capped.
- Design / interaction lessons: hidden proof can confirm model state, but installed foreground remains necessary for final visible presentation judgment.
- Process lessons: when the same route says "do not synthesize", search by hash first and keep material identity redacted in durable records.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token Usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: a single accepted-material phase discriminator was cheaper than revisiting VAP/Lottie runtime proof.
