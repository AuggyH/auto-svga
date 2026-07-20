# Review: Multi-format production input integrity and replaceability

## 1. Summary
Closed the earliest source-level product gaps in the owner-visible multi-format production-input chain.

- External-image Lottie adjacent resources now use a root-bound, no-follow, bounded, identity-checked read contract. Symlink aliases, path escapes, size drift, and read-time file replacement fail closed with owner-safe typed feedback.
- Real SVGA inspection now marks designer-named, non-sequence, non-matte imageKeys as replaceable.
- The desktop 0.2 session now injects the established SVGA image replacement preview workflow. A wide SVGA can Open, expose its imageKey, apply a runtime-only PNG replacement, return the accepted public/canonical/binding receipt, remount replacement bytes, target Reset to the source bytes, and reopen cleanly without mutating the source file.
- Existing external-image Lottie and fusion-capable VAP source oracles remain green; no duplicate VAP implementation was added.

## 2. Git state
- Branch: `codex/0.2-production-input-replaceability-20260716`
- Base before work: `083a37aa9cd564a06c56105d3fd0953b87f32753`
- Commit: included in the final milestone head reported to PM/A0.
- Classified untracked residue preserved: `.pnpm-store/` only.

## 3. Changed files
- `src/tests/avatar-frame-inspection-report.test.ts`
- `src/tests/svga-format-adapter.test.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/workbench/svga/format-adapter.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-production-input-replaceability.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | External-image Lottie adjacent resources stay local, bounded, path-redacted, and drift-safe | Done; root-bound no-follow read plus failure-first symlink escape regression |
| 2 | External-image Lottie Open, facts/assets, autoplay, pause/resume remain functional | Done; existing task-owned source oracle retained |
| 3 | Fusion-capable VAP canonical targets, image/text replacement, Reset, and reopen isolation remain functional | Done; existing real source host/controller oracle and related suites retained |
| 4 | Replaceable wide SVGA exposes real imageKey and supports replacement -> target Reset -> source immutability | Done; new real protobuf desktop-session flow |
| 5 | Automatic, sequence, and matte resources do not become replaceable | Done; adapter classification regression |
| 6 | Preserve UI styling, formal 0.1 behavior, privacy, save/export boundaries, and classified residue | Done |

## 5. Failure-first evidence
- Before the host read repair, a Lottie `avatar.png` symlink to an image outside the source root opened as `playing`; the new test requires typed `missing_resource` before runtime payload creation.
- Before the adapter/controller repair, the real wide SVGA owner snapshot had `imageTargets=[]`; after exposing the designer imageKey, the desktop session would have failed with `svga_replacement_controller_missing` without the injected established preview workflow.
- The first full-suite run exposed one stale inspection expectation: `img_frame` now correctly contributes the `可替换资源` concept. Only that expected owner fact was updated.

## 6. Verification
```text
npm run build
PASS

node --test dist/tests/svga-format-adapter.test.js
PASS 6/6

node --test --test-name-pattern "aliases that escape|replaceable wide" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 2/2

node --test dist/tests/multiformat-preview-workspace.test.js dist/tests/multiformat-owner-preview-candidate.test.js dist/tests/lottie-preview-vertical.test.js dist/tests/vap-preview-vertical.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-image-replacement-workflow.test.js
PASS 65/65

node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 31/31

node --test --test-name-pattern "0\\.2 desktop session|0\\.2 host-owned|0\\.2 installed file-open|owner-visible.*replacement|launch-time file-open" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 8/8

npm run test:all
PASS 542/542

npm run desktop:short-term:design-system-check
PASS

node --check (touched CJS/MJS), git diff --check
PASS

TASK_RETRO_LEDGER strict JSONL parse before append
PASS 188 rows
```

Product source diff SHA-256 over `src/` and `tools/` before review/ledger material: `43dbd7e3a360d82a9e314f3b46a1319f082ed5e2647d1c29bbdc1e78f4672aa1`.

Changed-path scans found no package/lockfile drift and no PNG, SVGA, GIF, MP4, ZIP, owner material, or generated runtime output.

## 7. Output inspection
- The wide fixture is 800x320 and contains one designer imageKey, `profile_frame`.
- Applied runtime bytes have a different SHA-256 from source bytes; target Reset restores the exact source SHA-256.
- The source file SHA-256 is unchanged after Apply, Reset, and reopen.
- Accepted replacement receipts expose only the public target, canonical runtime target, binding token, kind, and bounded inline runtime value; no local path is returned.
- The packaged runtime preparation copies the complete compiled `dist` tree and removes tests only, so the established replacement preview session is in runtime closure without a new dependency.

## 8. Risks and boundaries
- This is source-level implementation evidence. No Electron foreground run, installed app mutation, Packaging, promotion, QA, Product Owner acceptance, support, distribution, or release claim was performed.
- The task-owned external-image Lottie and fusion VAP source oracle does not substitute for later installed real-material QA.
- SVGA replacement remains preview-only and single-target-at-a-time, matching the established short-term workflow; this milestone does not add multi-target authoring or save/export behavior.

## 9. Next steps
- PM/A0 may independently audit the exact clean head and decide whether to route one Code Review.
- Installed product validation requires a later rebuilt exact-head candidate and separately authorized QA.

## 10. Project retrospective
- Value assessment: High
- Cost drivers: the real SVGA adapter and desktop host had to be traced together because fake controller tests masked the missing production injection.
- Avoidable costs: replaceability should have been asserted from a real adapter result before the owner-visible replacement surface was considered complete.
- Product lessons: an enabled replacement surface is not a capability until real source bytes produce a canonical target and the host owns a reversible runtime preview.
- Technical lessons: adjacent resources need one no-follow, identity-bound, bounded read rather than separate `stat` and `readFile` calls.
- Design / interaction lessons: no styling changed; the existing right-panel projection now receives truthful SVGA replaceability facts.
- Process lessons: retain the already-green Lottie/VAP oracle and move to the next real gap instead of adding duplicate scaffolding.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: failure-first host tests plus one full source suite were sufficient without taking a foreground or package lifecycle gate.
