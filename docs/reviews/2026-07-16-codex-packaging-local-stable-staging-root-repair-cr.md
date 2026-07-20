# Review: Packaging Local Stable Staging Root Repair CR Fix

## 1. Summary
Repaired the Code Review findings against rejected handoff `f3a8a2e47f847dda532d8c3f20eea58971606a2f`.

`PKG-STAGING-ROOT-CR-001` is addressed by requiring the target parent to already exist as a real directory before source inspection or staging, with no target-parent creation in the pre-staging path. The destination writability probe remains a later permit-scoped pre-exchange check after task-owned staging copy and validation.

`PKG-STAGING-ROOT-CR-002` is addressed by adding an exact-bound promotion exchange journal plus per-operation exchange manifest for interrupted installed/previous swaps. Recovery now classifies original, after-first-exchange, and complete byte roles, completes only deterministic recoverable states, rejects untrusted manifest bytes, and keeps the journal when manifest authority is incomplete.

This is source/test repair only. No owner app inspect, install, promotion, rollback, LaunchServices registration, foreground, Finder, QA route, Permit102 retry, `require_escalated`, or outside-sandbox wrapper was used.

## 2. Git state
- Branch: `codex/packaging-local-stable-staging-root-repair-cr-20260716`
- Rejected base: `f3a8a2e47f847dda532d8c3f20eea58971606a2f`
- Repair source/test diff SHA-256 from rejected base: `00fc8a274396ec556e9b07ad29f1e3cd69c1c4da819b62c48a0442f6d7b4af86`
- Model note: requested `gpt-5.6-sol/xhigh`; actual runtime used strongest compatible `gpt-5.5/xhigh` fallback.

## 3. Changed files
- `tools/svga-workbench/promote-local-stable-app.mjs`
- `tools/svga-workbench/promote-local-stable-app.test.mjs`
- `docs/reviews/2026-07-16-codex-packaging-local-stable-staging-root-repair-cr.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/packaging-local-stable-staging-root-repair-cr-20260716/README.md`
- `review/packaging-local-stable-staging-root-repair-cr-20260716/REVIEW_PACKET.md`
- `review/packaging-local-stable-staging-root-repair-cr-20260716/VALIDATION_SUMMARY.json`
- `review/packaging-local-stable-staging-root-repair-cr-20260716/MANIFEST.json`
- `review/packaging-local-stable-staging-root-repair-cr-20260716/packaging-local-stable-staging-root-repair-cr-20260716.zip`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Start from rejected `f3a8a2e4`. | Done. |
| 2 | Remove target-parent creation/mutation from pre-staging path. | Done; missing parent fails before source inspection/staging and is not created. |
| 3 | Keep `assertDestinationWritable` as later permit-scoped action only. | Done; it runs after staged candidate copy, identity validation, and payload binding. |
| 4 | Add durable exact-bound recovery journal/manifest for promotion exchange phases. | Done. |
| 5 | Prove failure before/after exchange phases, manifest publication failure, deterministic recovery, stale residue, and exact installed/previous roles. | Done in temp fixture tests. |
| 6 | Do not touch real owner apps or consume/retry permits. | Done. |

## 5. Verification
Commands run and results:
```text
node --check tools/svga-workbench/promote-local-stable-app.mjs
PASS

node --check tools/svga-workbench/promote-local-stable-app.test.mjs
PASS

node --test tools/svga-workbench/promote-local-stable-app.test.mjs
PASS 53/53

git diff --check
PASS

node -e "const fs=require('fs'); const p='docs/retrospectives/TASK_RETRO_LEDGER.jsonl'; const rows=fs.readFileSync(p,'utf8').trim().split(/\n/).filter(Boolean); rows.forEach((line,i)=>JSON.parse(line)); console.log('rows', rows.length);"
PASS 181 rows before this review entry

git diff --name-only f3a8a2e47f847dda532d8c3f20eea58971606a2f -- | rg '(^|/)(package(-lock)?\.json|pnpm-lock\.yaml)$|\.(png|gif|webm|mp4|mov|svga|zip)$|(^|/)generated/|(^|/)output/|(^|/)preview/'
PASS no matches
```

Skipped:
- No package build, install, promotion, rollback, LaunchServices registration, foreground, Finder, or QA run was authorized for this repair.
- No real `/Users/huangtengxin/Applications` or `~/Applications` app was inspected or mutated.

## 6. Output inspection
- Real app output: not generated.
- Owner installed app: not read or mutated.
- Temp fixture output: promotion recovery tests use task-owned `/private/tmp` fixture apps only.

## 7. Risks
- This repair adds deterministic recovery authority for promotion exchange interruptions, but it still needs independent Code Review before any candidate build or install permit can rely on it.
- The next real local-stable mutation still requires a fresh PM/A0 single-use permit and exact byte preflight.

## 8. Next steps
- PM/A0 should route this exact successor to independent Code Re-review.
- Do not promote, install, rollback, or inspect owner apps from this handoff.

## 9. Commit
- Commit: pending final handoff commit.
- Branch: `codex/packaging-local-stable-staging-root-repair-cr-20260716`
- Tag: none

## 10. Project retrospective
- Value assessment: High.
- Cost drivers: second CR round required failure injection around every promotion exchange phase rather than only pre-staging failures.
- Avoidable costs: the first staging-root repair stopped too early at task-owned copy safety and did not journal the installed/previous exchange itself.
- Product lessons: owner-visible local-stable promotion needs a deterministic recovery story for both installed and previous app roles before another one-shot permit.
- Technical lessons: a manifest written during recovery is only trusted after the durable journal records its exact sha256; otherwise the journal must remain.
- Design / interaction lessons: no owner-visible UI or interaction changed.
- Process lessons: do not treat a retained random staging root as recovery authority; record exact role/catalog identities before exchange.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No.

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: Tight temp-fixture crash probes were cheaper and safer than retrying any real promotion boundary.
