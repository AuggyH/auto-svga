# Packaging Review: Auto SVGA 0.2.0-alpha.2 WP7 Integration

## Summary

Release/Packaging integrated the QA-accepted WP7 source-side asset
qualification milestone into the accepted 0.2 package/runtime-proof line and
advanced the package/source identity to Auto SVGA `0.2.0-alpha.2` internal
candidate.

This is source integration only. No candidate archive was generated, no
local-stable promotion was run, and `/Users/huangtengxin/Applications/Auto
SVGA.app` was not replaced.

## Source Binding

- Branch: `codex/packaging-0.2-alpha2-wp7-integration-20260711`
- Starting package/runtime-proof head:
  `29480173e855ea87e2a1aba8709cb4cd501471d5`
- Package proof repair commit preserved:
  `530a9d743b5174091588078781ce018941029ea2`
- QA-accepted WP7 source head:
  `f18d8b9790af5f219f7335168692a221d93fd677`
- WP7 base:
  `33755c4221365dc924da2cd37b8370f14f147726`
- Integration commits on this branch:
  - `c89d5d1a feat: add multiformat asset qualification readiness`
  - `38d53e76 fix: redact multiformat inventory fields`
  - `cf063a12 fix: close mixed path redaction fragments`
  - `6357e35d fix: stamp 0.2 alpha2 package identity`

The WP7 commits were cherry-picked because the package/runtime-proof line and
the WP7 source line share WP6 as their merge base. The accepted package proof
repair remains ancestral through `29480173`, and the WP7 source content is
present through the cherry-picked commits. The only intended source-surface
difference from WP7 is the product/package identity update from
`0.2.0-alpha.1` to `0.2.0-alpha.2`.

## Changed Files

- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `docs/reviews/2026-07-11-codex-0.2-multiformat-asset-qualification-wp7.md`
- `src/workbench/multiformat-asset-qualification.ts`
- `src/workbench/local-path-redaction.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-asset-qualification.test.ts`
- `src/tests/short-term-local-path-redaction.test.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/packaging/macos/Info.plist`
- `tools/electron-prototype/experiments/svga-web/scripts/build-multiformat-qualification-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`

## Requirement Checks

- WP7 source-side readiness/privacy scope is integrated from the QA-accepted
  source line.
- Package proof behavior from `530a9d74` is preserved: proof identity binds
  source plist, product/stage/channel metadata, packaged runtime build-info,
  and exact runtime dependency closure.
- Candidate identity is now:
  - product version: `0.2.0`
  - release stage: `alpha.2`
  - distribution channel: `internal`
  - candidate channel: `local/internal candidate`
  - bundle short version: `0.2.0-alpha.2`
  - bundle version: `0.2.0-alpha.2`
  - owner-visible label: `Auto SVGA 0.2.0-alpha.2 internal candidate`

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/prepare-runtime.mjs`
- `npm run build`
- `node --test dist/tests/multiformat-asset-qualification.test.js dist/tests/short-term-local-path-redaction.test.js dist/tests/multiformat-owner-preview-candidate.test.js`
  - PASS `21/21`
- `node --test --test-name-pattern 'macOS package proof' tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS `5/5`
- `node --test --test-name-pattern 'formal 0\\.1 direct multi-format IPC|formal 0\\.2 multi-format preload|0\\.2 multi-format desktop mode|0\\.2 multi-format desktop session' tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - PASS `4/4`
- `npm run desktop:short-term:design-system-check`
- Direct macOS package proof identity probe for `0.2.0-alpha.2`
- `git diff --check`
- `TASK_RETRO_LEDGER.jsonl` parse: PASS, `135` rows
- Package/lockfile changed-path scan: no matches
- Production media/archive/generated-output changed-path scan: no matches

Limited / not green:

- `npm run test:all` reported `523/524` passing. The single failure was
  `export CLI reports a clear error when protobufjs is missing`; this run used
  a temporary symlink to another worktree's `node_modules` because this
  packaging worktree has no local dependencies installed, so the test's
  dependency-hiding fixture could still see `protobufjs`. This was recorded as
  an environment limitation, not as a full-suite PASS.

Skipped:

- No final package candidate archive generation.
- No installed-app replacement or local-stable promotion.
- No foreground, Finder/Open dialog, real production material, playback,
  visual acceptance, save/export/conversion, signing, notarization, Windows,
  public distribution, or release-readiness validation.

## Risks And Follow-Up

- Code Review should check that the WP7 cherry-picks did not lose source
  behavior while preserving the package/runtime-proof hardening.
- The next package-candidate gate should rebuild artifacts from the final
  approved head only after Code Review and PM route it.
- Full root regression should be rerun in a prepared dependency environment if
  Code Review requires a clean `524/524` result.

## Non-Claims

This is not QA acceptance, package-candidate generation, local-stable
promotion, installed-app replacement, Product Owner acceptance, foreground
visual acceptance, real-material playback success, Lottie/VAP product support,
save/export/conversion support, signing/notarization, Windows validation,
public distribution, production support, or release readiness.

## Retrospective

- Value assessment: High.
- Cost drivers: cross-lane cherry-pick, retrospective union conflict
  resolution, product/package identity stamping, package proof regression, and
  dependency-limited validation.
- Lesson: versioned source integration should update both user-facing candidate
  model identity and package proof identity in the same branch before any
  package artifact is generated.
- Avoid next time: do not run direct `.ts` tests with plain Node when this repo
  expects compiled `dist/tests` entry points.

## Token Usage

Unavailable.
