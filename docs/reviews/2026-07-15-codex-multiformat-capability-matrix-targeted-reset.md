# Review: Multi-format Capability Matrix And Target-scoped Reset

## 1. Summary

Audited the current `0.2` multi-format product against the roadmap, requirement,
design authority, open QA tickets, and direct evidence. The resulting capability
matrix separates implementation, source/dev validation, installed-QA acceptance,
incomplete behavior, and intentional unsupported scope.

The highest-value authorized gap that did not overlap the frozen native-picker
landing was per-target runtime Reset. Lottie and VAP rows exposed individual Reset
controls, but the owner/session/host contract discarded the selected target and
cleared the complete replacement context. Reset now carries active source,
public target, and kind through renderer, preload/IPC, host, session, and owner
model authority. One target is removed by its accepted canonical runtime key;
sibling replacements remain active and dirty, while the final target Reset
restores the source. SVGA keeps its existing controller behavior and now echoes
the resolved key required by the shared host contract.

Code Review then exposed two authority gaps. Lottie image and text candidates
did not share one collision-checked public/canonical namespace, and the host
accepted a Reset result after checking only status plus runtime key. The repair
now rejects duplicate aliases and cross-kind canonical collisions before any
revision or renderer mutation. Main and the real-runtime proof host require a
Reset receipt bound to action type, public target, canonical runtime target, and
the exact selection token.

State: `Fix Ready / PM Independent Review Required`. This is not installed QA,
Packaging, Product Owner acceptance, support, distribution, or release readiness.

## 2. Git State

- Branch: `codex/0.2-capability-matrix-completion-20260715`
- Base: `7cba862ed25986a0a50970222077dc5820e5f0aa`
- Frozen native-picker source: unchanged on its original branch.
- Final commit: supplied in the PM callback after commit.
- Classified residue preserved: `.pnpm-store/`.
- Temporary hash-matched Electron dependency overlay: removed after proof.

## 3. Changed Files

- `docs/product/MULTIFORMAT_CAPABILITY_MATRIX.md`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-vap-fusion-replacement-pixel-proof.cjs`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement Checks

| Requirement | Status | Evidence |
|---|---|---|
| Source-of-truth SVGA/Lottie/VAP capability matrix | Done | Status vocabulary and complete user-flow inventory in `MULTIFORMAT_CAPABILITY_MATRIX.md`. |
| Highest-value non-overlapping positive capability | Done | Target-scoped Lottie/VAP image/text Reset; frozen picker source is unchanged. |
| Public-to-canonical target authority | Done | Host requires sourceId, public target, kind, and accepted canonical echo before renderer storage changes. |
| Reject inactive/malformed/stale Reset without mutation | Done | Owner and host failure-first regressions retain revision, active values, runtime load count, and current preview. |
| Real runtime sibling isolation | Done in hidden source/dev runtime | Five-instance VAP proof: source, text, text+image, image-only after text Reset, source after image Reset. |
| Preserve accepted playback, oversize warning, 0.1, save/export boundaries | Done at source regression boundary | Full suite and design-system passed; no package, dependency, or persistence scope changed. |

## 5. Finding Ledger And Repair Health

| Finding | State | Evidence |
|---|---|---|
| `MF-CAP-MATRIX-001` | Closed at source/dev boundary | Per-row Reset previously called a global reset contract. New tests prove Lottie and VAP sibling isolation and final source restoration. |
| `MF-CAP-MATRIX-EVIDENCE-001` | Closed | First real proof attempt exposed that the proof-only text IPC returned model state without the production canonical runtime value. The proof host now uses the same source/selection/canonical authority as production. |
| `MF-TARGET-RESET-CR-001` | Closed in repair source | Cross-kind `text:1` and duplicate text aliases now return `replacement_target_ambiguous` before revision, active replacement, or renderer-load mutation. Both Apply and targeted Reset have failure-first coverage. |
| `MF-TARGET-RESET-CR-002` | Closed in repair source | Main and proof host require `resetReplacement` plus matching public target, canonical runtime target, and binding token. Apply receipts and changed receipt fields fail typed and path-redacted before renderer bookkeeping. |
| Current installed matrix | Open downstream gate | Frozen `7cba862e` Packaging/QA is separate; this successor has no installed or foreground acceptance. |

- Root cause: Reset originally carried only replacement kind at the host
  boundary. The first repair added per-target authority but inherited Lottie's
  ordered alias lookup and a partial Apply-era receipt check instead of making
  canonical uniqueness and action-bound receipts shared invariants.
- Why the prior behavior passed tests: earlier tests applied one replacement at
  a time; a global reset and a target reset are indistinguishable in that shape.
- Failure-first evidence: two-replacement Lottie and VAP tests showed the first
  Reset cleared both records and disabled Reset. The first direct runtime attempt
  also rejected state-only proof when the proof host omitted the canonical text
  runtime value. Code Review repair probes then showed cross-kind `text:1` and
  duplicate `Same` aliases were accepted, while an accepted Apply receipt could
  satisfy the host Reset check.
- Success stop: targeted Reset removes exactly one accepted canonical key,
  preserves sibling dirty/reset state and runtime pixels, final Reset restores
  exact source pixels, paused frames stay stable, lifecycle balances, and network
  requests remain empty.
- Failure stop: wrong/missing canonical echo, sibling loss, unexpected revision,
  equal replacement/source pixels, failed source restoration, path leak,
  unbalanced lifecycle, or accepted-flow regression stops handoff.
- Budget used: one product contract repair, one proof-host discriminator, one
  hidden real-runtime rerun, and one broad validation pass.

## 6. Verification

```text
npm run build
PASS

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 17/17

focused host/controller/proof contract group
PASS 9/9

related Lottie/VAP/workspace group
PASS 74/74

npm run test:all
PASS 534/534

npm run desktop:short-term:design-system-check
PASS

hidden non-foreground real VAP target-isolation proof before repair
PASS, SHA-256 af0576e3d33fb1f7013b96d5a23557fd8b249aa3333c28a8c2716cbc7211fc22
```

Pre-commit proof facts:

- Task-owned inputs are bound by hashes only: VAP `1d0e9ff1...`, sidecar
  `27e03ca2...`, replacement PNG `840e365c...`.
- Instance chain is `1 -> 2 -> 3 -> 4 -> 5`.
- Text runtime binds `title`; combined runtime binds `avatar` and `title`;
  text Reset retains only decoded/textured `avatar`; final Reset binds neither.
- Source, text, combined, and image-only pixel digests are distinct; combined
  and image-only delayed paused digests are stable; final digest equals source.
- VAP load/destroy is `5/5`; object URL create/revoke is `5/5`;
  `externalRequests=[]`.
- Exact final-head proof is generated after commit and supplied separately so
  `proof.sourceHead` equals the final commit.

## 7. Risks And Boundaries

- Current installed acceptance is pending and must not be inferred from this
  source/dev proof.
- Direct installed Lottie/VAP text replacement remains incomplete in the
  capability matrix even though the VAP hidden runtime pixel proof is positive.
- No owner or production material is committed or copied. Durable records expose
  aliases and hashes only.
- No foreground, installed app, Finder/dialog, LaunchServices, package,
  promotion, QA, save/export/conversion, or external network action occurred.

## 8. Next Step

PM/A0 independently reviews the exact successor head and head-bound proof, then
decides one Code Review route. Implementation does not route QA or Packaging.

## 9. Project Retrospective

- Value: high; closes a user-visible multi-target workflow rather than adding
  another metadata-only helper.
- Avoidable cost: the first temporary Lottie visual fixture rendered its image
  nodes at zero size. Repair Health stopped that path after the second identical
  pixel symptom and moved to the approved fusion VAP fixture.
- Product lesson: per-row affordances require per-row mutation authority;
  labeling a button by target does not make a global host operation targeted.
- Technical lesson: keep public row identity and canonical runtime key separate,
  require one-to-one binding across format namespaces, and bind accepted Reset
  receipts to operation type, both identities, and selection generation.
- Evidence lesson: prove sibling preservation with simultaneous active values,
  direct runtime bindings, and pixels; one-at-a-time replacement cannot expose a
  destructive global Reset.
- Token usage: unavailable; exact counts were not exposed to the implementation
  session.
