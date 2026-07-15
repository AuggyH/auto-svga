# Review: Packaging Promotion Recovery CLI Boundary

## 1. Summary
Repaired the remaining `PKG-STAGING-ROOT-CR-002` gap from Code Re-review of
`d9034fd0102396b065c7482ebf6ce27928698c15`: promotion recovery is now reachable
through the repository-owned CLI as `--recover-promotion`.

The new CLI mode is mutually exclusive with inspect, rollback, and rollback
recovery; rejects package, target, registration, rollback-id, and rollback
binding authority; and dispatches to the durable promotion journal recovery
without starting a new promotion, package build, install, rollback, or
LaunchServices registration.

Before implementation, the root-cause contract was recorded in
`docs/reviews/2026-07-16-codex-packaging-promotion-recovery-cli-root-cause.md`.

This is source/test repair only. No owner app inspect, install, promotion,
rollback, LaunchServices registration, foreground, Finder, QA route, Permit102
retry, `require_escalated`, or outside-sandbox wrapper was used.

## 2. Git state
- Branch: `codex/packaging-local-stable-staging-root-recover-cli-20260716`
- Base before work: `d9034fd0102396b065c7482ebf6ce27928698c15`
- Repair source/test diff SHA-256 from base:
  `6ea92a25d34655e0d4588f80c0bd7c5020a76c8e5c41b0dcd45f9dbd2dc56ba7`
- Model note: requested `gpt-5.6-sol/xhigh`; actual runtime used strongest
  compatible `gpt-5.5/xhigh` fallback.

## 3. Changed files
- `tools/svga-workbench/promote-local-stable-app.mjs`
- `tools/svga-workbench/promote-local-stable-app.test.mjs`
- `docs/reviews/2026-07-16-codex-packaging-promotion-recovery-cli-root-cause.md`
- `docs/reviews/2026-07-16-codex-packaging-promotion-recovery-cli.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/packaging-promotion-recovery-cli-20260716/README.md`
- `review/packaging-promotion-recovery-cli-20260716/REVIEW_PACKET.md`
- `review/packaging-promotion-recovery-cli-20260716/VALIDATION_SUMMARY.json`
- `review/packaging-promotion-recovery-cli-20260716/MANIFEST.json`
- `review/packaging-promotion-recovery-cli-20260716/packaging-promotion-recovery-cli-20260716.zip`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Produce root-cause review/contract before implementation. | Done. |
| 2 | Add one repository-owned promotion recovery entrypoint. | Done: `--recover-promotion`. |
| 3 | Strict mode/argument parsing. | Done; mode conflicts and target/package/rollback authority are rejected. |
| 4 | Bind to durable journal/manifest recovery. | Done; CLI dispatch calls `recoverPromotionTransaction()`. |
| 5 | Deterministic idempotent recovery/replay tests. | Done; CLI dispatch recovers once, second invocation fails on missing journal. |
| 6 | Journal/manifest mismatch fails closed and retains residue. | Done. |
| 7 | No owner app mutation or downstream route. | Done. |

## 5. Verification
Commands run and results:
```text
node --check tools/svga-workbench/promote-local-stable-app.mjs
PASS

node --check tools/svga-workbench/promote-local-stable-app.test.mjs
PASS

node --test tools/svga-workbench/promote-local-stable-app.test.mjs
PASS 55/55

git diff --check
PASS

TASK_RETRO_LEDGER.jsonl parse
PASS

package-lock/media/archive changed-path scan from d9034fd0
PASS no output
```

Skipped:
- No package build was run; this repair is a source/CLI safety boundary and
  the route did not authorize candidate generation.
- No real `/Users/huangtengxin/Applications` or `~/Applications` app inspect,
  install, promotion, rollback, or recovery was run.

## 6. Output inspection
- Real app/package output: not generated.
- Owner installed/previous app: not read or mutated.
- Recovery evidence: temp-fixture apps under task-owned `/private/tmp` only.

## 7. Risks
- This source repair still needs independent Code Re-review before any future
  package candidate, recovery, or promotion permit can rely on it.
- `--recover-promotion` intentionally has no target override; it trusts only
  the durable promotion journal's recorded target/previous/stage authority.

## 8. Next steps
- PM/A0 should route this exact successor head to independent Code Re-review.
- Do not issue a promotion or recovery permit from this handoff until review
  approves the CLI boundary.

## 9. Commit
- Commit: pending final handoff commit.
- Branch: `codex/packaging-local-stable-staging-root-recover-cli-20260716`
- Tag: none

## 10. Project retrospective
- Value assessment: High.
- Cost drivers: second recurrence required root-cause analysis and a real CLI
  dispatch test, not only module-level recovery helpers.
- Avoidable costs: prior fixture coverage imported recovery directly and missed
  the operator command surface.
- Product lessons: recovery authority must be reachable through the same
  repository-owned tool operators use during local-stable incidents.
- Technical lessons: a recovery function is not production recovery unless the
  CLI parser and dispatcher expose it under strict mode authority.
- Design / interaction lessons: no owner-visible UI or interaction changed.
- Process lessons: repeated recovery-authority findings should start from a
  root-cause contract before another patch.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No.

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: Testing the actual CLI dispatch would have prevented the prior
  incomplete recovery fix.
