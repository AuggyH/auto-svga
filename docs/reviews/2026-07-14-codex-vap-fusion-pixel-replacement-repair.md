# Review: VAP Fusion Pixel Replacement Repair

## 1. Summary

Completed the source repair for `ASV-QA-20260711-001` Permit 058. The owner-visible VAP image command now resolves the selected resource/display id to the canonical fusion runtime key before preparing the packaged player. A hidden real-Electron proof binds constructor identity, decoded image/texture state, deterministic frame-zero pixels, Reset restoration, paused stability, balanced cleanup, and offline closure.

State: `Fix Ready / PM Independent Review Required`. This is not installed QA acceptance, Packaging, foreground acceptance, support, or release readiness.

## 2. Git State

- Branch: `codex/0.2-vap-fusion-pixel-replacement-repair-20260714`
- Base: `32990e90077ad90d7dd1c21bc4fe527d2dbe80c3`
- Final commit: reported in the PM callback after this packet is committed.
- Classified residue preserved: `.pnpm-store/`
- Temporary hash-matched Electron dependency overlay: removed before final status.

## 3. Changed Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-vap-fusion-replacement-pixel-proof.cjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/reviews/2026-07-14-codex-vap-fusion-pixel-replacement-repair.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260711-001-vap-fusion-pixel-replacement-repair-20260714/`

## 4. Finding Ledger And Repair Health

| Finding | State | Evidence |
|---|---|---|
| `MF-VAP-FUSION-PIXEL-001` | Source repair complete; installed ticket remains open | Permit 058 source/replacement aligned frames were identical although replacement state changed. Failure-first real-runtime diagnostics showed instance 2 had parser/video/frame readiness but no `avatar` option, decoded source, or texture. |

- Root-cause hypothesis: the selected inventory/resource id was being reused as the runtime fusion key instead of resolving the sidecar's canonical `srcTag` / `runtimeBindingKey`.
- Why the prior proof passed falsely: it manually selected canonical `avatar` and asserted dirty/remount state. It bypassed the owner-visible default resource alias and did not require direct pixel change or exact Reset restoration.
- Failure-first evidence: two exact-runtime runs reproduced absent `avatar` constructor/source/texture state. Per Repair Health, the second run added only the smallest IPC discriminator and proved the renderer sent a private runtime value under the display/resource id while the prepared fusion parameter key remained wrong.
- Success stop: instance 2 receives and decodes `avatar`, frame-zero replacement pixels differ from source, paused pixels remain stable, instance 3 Reset restores the exact source digest, lifecycle balances, and external requests remain empty.
- Failure stop: repeated equal pixels after canonical binding, missing decoded/texture evidence, unbalanced cleanup, external request, path leak, or accepted playback regression stops the repair without another speculative patch.
- Budget: one diagnostic pair, one discriminating IPC observation, one narrow source repair, one final exact-head runtime proof.

## 5. Requirement Checks

| # | Requirement | Status |
|---|---|---|
| 1 | Reproduce the exact fusion fixture and replacement in the real packaged runtime | Done; state-only success was rejected. |
| 2 | Distinguish readiness, mapping, and stale-capture hypotheses | Done; mapping failed while parser/video/frame readiness and distinct capture files were proven. |
| 3 | Repair only the proven runtime boundary | Done; only VAP image private-value key canonicalization changed. |
| 4 | Prove replacement pixels, paused stability, and Reset restoration | Done in pre-commit proof; exact-head proof required after commit. |
| 5 | Preserve playback, warning-only oversize behavior, privacy, lifecycle, and offline closure | Done through related/full tests and real proof. |

## 6. Verification

```text
npm run build
PASS

focused controller plus proof-contract tests
PASS 2/2

related VAP and multi-format compiled suites
PASS 67/67

npm run test:all
PASS 530/530

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

## 7. Risks And Boundaries

- Installed replacement and Reset remain pending a rebuilt candidate and QA gate owned by PM/A0.
- No production or owner material is committed or copied; durable evidence uses aliases and hashes.
- No package/lock change, installed-app mutation, foreground operation, QA/Packaging route, save/export/conversion work, support claim, Product Owner acceptance, distribution, or release claim.
- The package source/type audit found `onDestroy` is used by shipped runtime code while older type/readme text says `onDestory`; this repair does not depend on either callback and the direct lifecycle counters balance after controller disposal.

## 8. Next Step

PM/A0 independently reviews the exact final head and final head-bound proof, then decides Code Review routing. Implementation does not route QA or Packaging.

## 9. Project Retrospective

- Value: high; closes the specific false-PASS boundary exposed by Permit 058.
- Avoidable cost: prior evidence checked model state and remount count instead of constructor binding and pixels.
- Product lesson: enabled Reset and changed issue counts do not prove visible replacement.
- Technical lesson: translate display/resource ids to runtime keys only at the private renderer payload boundary.
- Process lesson: a second same-symptom run should add one discriminating observation, not another speculative fix.
- Token usage: unavailable; the exact runtime constructor/texture probe was the highest-value discriminator.
