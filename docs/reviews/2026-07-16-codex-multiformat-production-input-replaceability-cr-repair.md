# Review: Multi-format production input replaceability CR repair

## 1. Summary
Repaired the four blocking source findings from Code Review of
`f41c6c7b27b9de6699e610ed364d10411e1574f7`.

- Active source authority now binds runtime prepare, Apply, and Reset to the
  current same-generation source descriptor. A file changed after Open, an old
  retained deterministic source id, or a same-path reopen with a stale source id
  fails closed before runtime mutation.
- Lottie adjacent image reads now use descriptor-bound root-local authority:
  no-follow path traversal, exact directory entry names, ancestor identity
  recheck, hardlink rejection, size/hash binding, and bounded reads.
- SVGA owner-visible replacement targets now require positive static image scene
  usage. Unreferenced unknown/internal designer-named images stay out of the
  replaceable target list while genuine referenced static imageKeys remain
  replaceable.
- Existing autoplay-on-open, playback, canonical Apply/Reset receipts, reopen
  isolation, Lottie/VAP replacement authority, privacy, and 0.1 SVGA delegation
  are preserved.

## 2. Git state
- Branch: `codex/0.2-production-input-replaceability-repair-20260716`
- Rejected source base: `f41c6c7b27b9de6699e610ed364d10411e1574f7`
- Commit: final successor head reported to PM/A0 after this packet is sealed.
- Classified untracked residue preserved: `.pnpm-store/` only.

## 3. Changed files
- `src/workbench/short-term-product-model.ts`
- `src/tests/svga-format-adapter.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-production-input-replaceability-cr-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Finding closure
| Finding | Repair | Evidence |
|---|---|---|
| `MF-REPLACEABILITY-CR-001` | Open records a source descriptor; Apply and Reset rehash the current source and reject changed bytes before revision/runtime/remount mutation. | New desktop-session regression mutates the SVGA source after Open and proves Apply/Reset return typed blocked state. |
| `MF-REPLACEABILITY-CR-002` | Runtime prepare accepts only the active source id and active descriptor; same-path reopen invalidates the older id. | New regression proves stale source id and same-path old source id both fail before runtime preview. |
| `MF-LOTTIE-CR-001` | Adjacent reads are exact-entry, no-follow, descriptor-bound, hardlink-rejecting, ancestor-checked, size/hash-checked reads. | New regressions cover hardlink, case alias, Unicode alias, growth, file replacement, and ancestor swap. |
| `MF-SVGA-TARGET-CR-001` | Replaceable image resources require `static_image` scene usage, excluding unknown/unreferenced internal images. | Adapter and desktop-session fixture now include an unreferenced `internal_unused_designer_badge` and assert it is not replaceable. |

## 5. Verification
```text
node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

npm run build
PASS

node --test --test-name-pattern "Lottie intake rejects|Lottie runtime rejects|source mutation and stale source IDs|replaceable wide SVGA" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 5/5

node --test dist/tests/svga-format-adapter.test.js
PASS 6/6

node --test dist/tests/multiformat-preview-workspace.test.js dist/tests/multiformat-owner-preview-candidate.test.js dist/tests/multiformat-asset-qualification.test.js dist/tests/lottie-preview-vertical.test.js dist/tests/lottie-svg-playback-adapter.test.js dist/tests/vap-preview-vertical.test.js dist/tests/vap-inspection.test.js dist/tests/vap-playback-preparation.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-image-replacement-workflow.test.js
PASS 104/104

npm run test:all
PASS 542/542

npm run desktop:short-term:design-system-check
PASS
```

```text
git diff --check
PASS

strict TASK_RETRO_LEDGER.jsonl parse
PASS 190 rows

changed-path package/lock/media scan
PASS no matches
```

Visible review packet manifest and ZIP integrity are sealed after the final
commit so the packet can bind the exact successor head.

Product source diff SHA-256 over `src/` and `tools/` before review/ledger
material: `0e584d691c8d8bbc828fea10d10e4f90713e893b179fefa904b339240bed7ac8`.

## 6. Boundaries
- Source-only repair. No Electron or Auto SVGA launch, foreground use,
  installed app mutation, Packaging, QA, Product Owner acceptance, support,
  distribution, or release claim.
- No owner material, raw paths, screenshots, dialogs, Finder, save/export
  changes, new dependencies, or UI styling changes.
- Existing `.pnpm-store/` residue remains classified and uncommitted.

## 7. Next gate
PM/A0 can independently audit this exact clean successor and route one Code
Review re-review. Downstream installed QA requires a rebuilt exact-head
candidate and separately authorized QA.

## 8. Project retrospective
- Value assessment: High
- Cost drivers: the repair had to bind source identity across host reads,
  runtime prepare, SVGA Apply/Reset, Lottie adjacent resource resolution, and
  model target projection without weakening existing positive flows.
- Avoidable costs: deterministic path-derived source ids were retained beyond
  their valid generation and were not enough source authority for mutable local
  files.
- Product lessons: a replacement target is owner-visible only when it is
  positively used by the scene and can be reverted against the same Open-time
  source bytes.
- Technical lessons: adjacent resources need descriptor and ancestor identity
  checks, not path containment alone.
- Process lessons: the CR finding set was batched into one source repair while
  preserving the existing daily-use chain and no-foreground boundary.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 9. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
