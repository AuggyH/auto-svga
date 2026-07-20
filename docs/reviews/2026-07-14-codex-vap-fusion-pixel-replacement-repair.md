# Review: VAP Fusion Pixel Replacement Repair

## 1. Summary

Completed the source repair for `ASV-QA-20260711-001` Permit 058, the bounded `MF-VAP-FUSION-CR-001` review finding, and the proof-integrity follow-up `MF-VAP-FUSION-PM-001`. The owner model now treats normalized VAP `resourceId` as the only public fusion selection identity, resolves it uniquely to one replaceable canonical runtime key, snapshots that binding across the host picker, and returns the accepted key explicitly. The renderer no longer searches overlapping aliases or falls back to the requested id. All three real-runtime proof shims now traverse that same authority contract. The hidden real-Electron proof remains the positive pixel oracle for constructor identity, decoded image/texture state, deterministic frame-zero pixels, Reset restoration, paused stability, balanced cleanup, and offline closure.

State: `Fix Ready / PM Independent Review Required`. This is not installed QA acceptance, Packaging, foreground acceptance, support, or release readiness.

## 2. Git State

- Branch: `codex/0.2-vap-fusion-pixel-replacement-repair-20260714`
- Base: `32990e90077ad90d7dd1c21bc4fe527d2dbe80c3`
- Final commit: reported in the PM callback after this packet is committed.
- Classified residue preserved: `.pnpm-store/`
- Temporary hash-matched Electron dependency overlay: removed before final status.

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/scripts/run-vap-fusion-replacement-pixel-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-vap-runtime-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-rendering-matrix-proof.cjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/reviews/2026-07-14-codex-vap-fusion-pixel-replacement-repair.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260711-001-vap-fusion-pixel-replacement-repair-20260714/`

## 4. Finding Ledger And Repair Health

| Finding | State | Evidence |
|---|---|---|
| `MF-VAP-FUSION-PIXEL-001` | Source repair complete; installed ticket remains open | Permit 058 source/replacement aligned frames were identical although replacement state changed. Failure-first real-runtime diagnostics showed instance 2 had parser/video/frame readiness but no `avatar` option, decoded source, or texture. |
| `MF-VAP-FUSION-CR-001` | Fix Ready; independent re-review required | The exact cross-namespace fixture failed before repair: public `resourceId=vap_fusion_2` resolved to an earlier record whose `srcTag` was `vap_fusion_2` instead of the selected record's canonical `badge` key. A follow-up failure-first case proved that two unique public resources could also expose the same canonical key: preparation returned `status=failed` with `ambiguous_fusion_source_tag` but retained both fusion records, while owner selection still accepted one. Owner, host-picker, and renderer regressions now require one public record and one canonical-key owner; zero, duplicate-public, duplicate-canonical, malformed, nonreplaceable, stale source, and changed picker binding cases reject without revision, dirty state, runtime-value storage, or remount. |
| `MF-VAP-FUSION-PM-001` | Fix Ready; PM independent pre-CR review required | The two shared real-runtime proof shims still called owner replacement with a public id and returned it as the runtime key. A failure-first static regression failed on both scripts. They now perform the same before/after binding-token check and explicit canonical echo as the dedicated pixel proof; the regression covers all three scripts and rejects direct public-id fallback. Product source is unchanged. |

- Root-cause hypothesis: the selected inventory/resource id was being reused as the runtime fusion key instead of resolving the sidecar's canonical `srcTag` / `runtimeBindingKey`.
- Why the prior proof passed falsely: it manually selected canonical `avatar` and asserted dirty/remount state. It bypassed the owner-visible default resource alias and did not require direct pixel change or exact Reset restoration.
- Failure-first evidence: two exact-runtime runs reproduced absent `avatar` constructor/source/texture state. Per Repair Health, the second run added only the smallest IPC discriminator and proved the renderer sent a private runtime value under the display/resource id while the prepared fusion parameter key remained wrong.
- Success stop: instance 2 receives and decodes `avatar`, frame-zero replacement pixels differ from source, paused pixels remain stable, instance 3 Reset restores the exact source digest, lifecycle balances, and external requests remain empty.
- Failure stop: repeated equal pixels after canonical binding, missing decoded/texture evidence, unbalanced cleanup, external request, path leak, or accepted playback regression stops the repair without another speculative patch.
- Budget: one diagnostic pair, one discriminating IPC observation, one narrow source repair, one final exact-head runtime proof.

`MF-VAP-FUSION-CR-001` repair health:

- Root-cause hypothesis: display ids, normalized resource ids, source ids, tags, and runtime keys were treated as one ordered alias namespace in both owner-model acceptance and renderer remount preparation.
- Why the first repair missed it: its exact-head proof used one collision-free `avatar` record and proved the resolved happy path, but it never asked whether a second record could own the same string in a different identity namespace.
- Failure-first evidence: the reviewer-shaped two-record fixture failed with actual target `vap_fusion_2` instead of expected `badge` before source changes. The follow-up unique-public/duplicate-canonical fixture returned `accepted` before the guard even though preparation's exact duplicate-tag model was `failed` and carried both `avatar` runtime keys. Behavioral host probes also showed changed picker bindings could proceed without an authority snapshot.
- Success stop: public VAP selection uses one unique `resourceId`, resolves to exactly one replaceable well-formed canonical key, survives unchanged across the picker, is returned explicitly to the renderer, and all rejected cases remain mutation-free while the exact-head pixel proof stays green.
- Failure stop: any alias reinterpretation, fallback to requested id, stale picker acceptance, rejected-case mutation, wrong runtime constructor key, equal replacement/source pixels, Reset mismatch, path leak, unbalanced lifecycle, or external request stops the repair.
- Budget: one consolidated owner/host/renderer authority change and one final exact-head proof; no adjacent runtime or UI redesign.

`MF-VAP-FUSION-PM-001` repair health:

- Root-cause hypothesis: two older shared evidence shims duplicated the picker contract and predated the canonical owner/host authority repair.
- Why the prior repair missed it: the dedicated direct-pixel proof was corrected and statically guarded, but the regression enumerated only that one script.
- Failure-first evidence: one three-script regression passed for the dedicated proof and failed on both shared scripts at the missing selection snapshot and public-id return.
- Success stop: every real-runtime proof script snapshots an accepted binding before and after read, requires the same token and canonical owner echo, returns only the canonical key, and the dedicated exact-head pixel/reset proof remains green.
- Failure stop: any public-id echo/fallback, token mismatch acceptance, canonical mismatch, pixel/reset regression, path leak, unbalanced cleanup, or network request stops the handoff.
- Budget: two proof-shim edits, one shared static regression, no product code changes, and one final exact-head dedicated proof.

## 5. Requirement Checks

| # | Requirement | Status |
|---|---|---|
| 1 | Reproduce the exact fusion fixture and replacement in the real packaged runtime | Done; state-only success was rejected. |
| 2 | Distinguish readiness, mapping, and stale-capture hypotheses | Done; mapping failed while parser/video/frame readiness and distinct capture files were proven. |
| 3 | Repair only the proven runtime boundary | Done; VAP public selection authority is centralized at the owner/host boundary and renderer alias interpretation is removed. |
| 4 | Prove replacement pixels, paused stability, and Reset restoration | Done in pre-commit proof; exact-head proof required after commit. |
| 5 | Preserve playback, warning-only oversize behavior, privacy, lifecycle, and offline closure | Done through related/full tests and real proof. |

## 6. Verification

```text
npm run build
PASS

focused owner authority tests
PASS 13/13

combined owner authority and VAP preparation tests
PASS 23/23

focused host/controller authority tests
PASS 4/4

three-script proof authority regression
PASS 1/1; failure-first failed on both shared shims before repair

complete Electron experiment source/runtime suite
PASS 74/74 with the temporary hash-matched dependency overlay

related VAP, Lottie, owner, workspace, and inventory compiled suites
PASS 89/89

npm run test:all
PASS 532/532

npm run desktop:short-term:design-system-check
PASS

hidden non-foreground real VAP fusion pixel proof before commit
PASS, SHA-256 ffff75db15c8a14b34ecf8c81a730102521c660b05a96445a97d3c69f738f1e7
```

Pre-commit proof facts:

- Exact input hashes: VAP `25ce657c...`, sidecar `d1e9160d...`, replacement PNG `bb976694...`; no paths emitted.
- Instance chain: source 1, replacement 2, Reset 3.
- Replacement runtime: constructor `avatar` option present; `srcData.avatar` decoded `1254x1254`; `textureMap.avatar=1`; frame 0 references `avatar`.
- Every capture: backing `120x80`, expected frame 0, seeked event observed, one video-frame callback observed.
- Pixel digests: source `9b8fcfe8...`; replacement and delayed paused replacement `7641030d...`; Reset `9b8fcfe8...`.
- Lifecycle: VAP load/destroy `3/3`; object URL create/revoke `3/3`; external requests empty.
- Exact final-head proof is generated after commit and supplied separately to PM/A0 so `proof.sourceHead` equals the final commit.
- The first post-commit proof attempt failed closed because its frame callback was registered after the Reset seek had already presented frame zero. The harness now registers the callback before the target seek and awaits seek plus presentation together; no product source changed for that evidence-timing correction.
- The first successor-head proof attempt also failed closed because the isolated proof IPC handler returned the public `resourceId` as `replacementRuntimeValue.targetId`, bypassing the repaired host authority and recreating the old missing-texture shape. The proof handler now snapshots owner selection around its bounded read, requires the accepted owner result to echo the canonical key, and returns only that key; the static proof contract rejects the former public-id fallback.
- The first complete Electron experiment run in this repair passed 72/74 runnable checks and failed only two package-proof fixtures because the local prototype dependency tree was absent. After package/lock hashes were independently matched to the established `d657` tree, a temporary ignored symlink overlay produced 74/74; it is removed before final status.
- The `MF-VAP-FUSION-PM-001` validation again observed the same environment-only 72/74 state before the verified overlay and then passed 74/74. Build, full `test:all` 532/532, and design-system also passed after the proof-shim repair.

## 7. Risks And Boundaries

- Installed replacement and Reset, plus independent closure of `MF-VAP-FUSION-CR-001`, remain pending later gates owned by PM/A0.
- No production or owner material is committed or copied; durable evidence uses aliases and hashes.
- No package/lock change, installed-app mutation, foreground operation, QA/Packaging route, save/export/conversion work, support claim, Product Owner acceptance, distribution, or release claim.
- The package source/type audit found `onDestroy` is used by shipped runtime code while older type/readme text says `onDestory`; this repair does not depend on either callback and the direct lifecycle counters balance after controller disposal.

## 8. Next Step

PM/A0 independently reviews the exact final head and final head-bound proof, then decides Code Review routing. Implementation does not route QA or Packaging.

## 9. Project Retrospective

- Value: high; closes the specific false-PASS boundary exposed by Permit 058.
- Avoidable cost: prior evidence checked model state and remount count instead of constructor binding and pixels.
- Product lesson: enabled Reset and changed issue counts do not prove visible replacement.
- Technical lesson: keep one public `resourceId` namespace and resolve it once to a canonical runtime key at the owner/host authority boundary; renderers and proof harnesses consume the accepted result without fallback.
- Review lesson: a real happy-path pixel proof must be paired with adversarial identity collisions and rejected-case mutation checks.
- Process lesson: a second same-symptom run should add one discriminating observation, not another speculative fix.
- Token usage: unavailable; the exact runtime constructor/texture probe was the highest-value discriminator.
