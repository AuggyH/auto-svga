# Multi-format Task Fixture Source Oracle

Date: 2026-07-16

Branch: `codex/0.2-multiformat-daily-use-stability-20260716`

Base / predecessor head: `04de162a7425b2e7b00969d2579b15ba2d1f379c`

Final source head: the commit containing this review file; exact hash is reported in PM handoff.

## Outcome

Implementation Ready for PM/A0 independent review and Code Review routing.

This is a source-only closure for the task-owned external-image Lottie and fusion-capable VAP fixture/oracle contract. It does not launch Electron or Auto SVGA and does not claim installed/runtime visual acceptance.

## Changed

- Added a deterministic task-owned fixture generator for:
  - external-image Lottie JSON plus adjacent PNG resource;
  - fusion-capable VAP MP4 plus adjacent `vapc` JSON sidecar;
  - a bounded PNG replacement fixture.
- Added a source-only oracle that opens both task fixtures through `MultiFormatDesktopPreviewSession`, proves source/runtime payload preparation, play/pause model state, image/text replacement, target reset, cleanup, and path-redacted evidence.
- Mirrored the main-process replacement authority in the source-only desktop session by returning accepted canonical `replacementRuntimeValue` for apply actions.
- Added failure-first fixture contract coverage for missing Lottie resource, deferred-font Lottie drift, missing/malformed VAP sidecar, and fusion target drift.

## Files

- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/multiformat-task-runtime-fixtures.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`

Product diff SHA-256 over changed source/test files from `04de162a7425b2e7b00969d2579b15ba2d1f379c`: `451d5dd128c2405caab1e8c03a0f3807b8a29fa6675044d560df0ac9541df87e`

## Failure-First Evidence

The first source oracle run failed before repair because Lottie image replacement reached the owner model but did not reach the prepared runtime payload. The source-only desktop session did not return the private canonical runtime value that the real main/renderer bridge already uses.

The fixed oracle now fails closed if:

- external Lottie resources are missing;
- the Lottie fixture declares deferred fonts;
- the VAP sidecar is missing or malformed;
- VAP fusion identities drift away from deterministic `avatar` image and `title` text targets;
- accepted replacement actions do not echo the canonical runtime key and private runtime value.

## Validation

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/multiformat-task-runtime-fixtures.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs` PASS 2/2
- Focused host/session/canonical replacement group in `svga-web-experiment.test.mjs` PASS 5/5
- `npm run build` PASS
- `npm run test:all` PASS 538/538
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check` PASS
- `git diff --check` PASS
- `TASK_RETRO_LEDGER.jsonl` parse PASS before this review entry; final strict parse is repeated after packet sealing.

The retained pre-commit source-only proof passed with SHA-256 `50bc4110340e65cec8aad2523bbcb85a33581e4311e4201ee4caf2ca98cec0b8`. A final exact-head source-only proof is regenerated after commit and reported in the PM handoff.

## What This Proves

- External-image Lottie can be represented by a task-owned fixture with adjacent resource identity, inline runtime preparation, image/text replacement, target reset, sibling preservation, and redacted evidence.
- Fusion-capable VAP can be represented by a task-owned fixture with adjacent sidecar identity, image/text fusion classification, canonical runtime keys, replacement/reset source restoration, and redacted evidence.
- The source-only host/controller oracle uses the same canonical runtime value authority as the main/renderer bridge.

## Not Changed / Not Claimed

- No Electron, Auto SVGA, Finder, Figma, native chooser, or foreground launch.
- No installed app mutation, packaging, promotion, QA route, runtime permit, or Product Owner acceptance.
- No real browser pixel playback proof, installed QA, public support, distribution readiness, release readiness, save/export/conversion support, owner material use, or production-media commit.
- No UI styling, placement, startup/bootstrap discriminator, picker, Reset, OwnerRightPanelSnapshotV1, or host authority behavior was intentionally changed outside the source-only session contract.

## Repair Health

- Root-cause hypothesis: the source-only oracle/session seam lacked the private accepted runtime value returned by the installed main/renderer replacement bridge, causing state-only replacement acceptance to be mistaken for runtime payload readiness.
- Why earlier evidence missed it: hidden runtime evidence remained blocked and older source proofs could pass on model dirty/reset state without directly preparing payloads from canonical runtime values.
- Success stop: source-only oracle opens both task fixtures, prepares runtime payloads, applies image/text replacements through canonical keys, resets source state, redacts evidence, and broad source validation passes.
- Failure stop: if a future hidden Electron permit still exits before runtime proof, do not infer source contract failure from this checkpoint; use the existing runtime-oracle diagnostic protocol and fresh zero-process preflight.

## Next Gate

PM/A0 independent review, then Code Review if PM routes this successor. A hidden Electron/runtime permit is still required for actual browser runtime evidence.

## Project Retrospective

- Value assessment: Medium-high.
- Cost drivers: previous hidden runtime oracle exit `134`; source proof had to avoid foreground and runtime launch while still advancing external-resource and fusion fixture authority.
- Avoidable costs: earlier source oracles should not have treated model dirty/reset state as enough replacement proof.
- Product lessons: task-owned fixtures are useful only when they bind identity, resource resolution, canonical runtime keys, reset behavior, and redacted evidence together.
- Technical lessons: source-only session seams should mirror the main/renderer private runtime-value contract whenever they prepare Lottie/VAP payloads.
- Design / interaction lessons: no owner-visible UI or styling change was needed.
- Process lessons: exact source oracle proof remains source-only and must not be upgraded into installed/runtime acceptance.
- Token usage: unavailable.
