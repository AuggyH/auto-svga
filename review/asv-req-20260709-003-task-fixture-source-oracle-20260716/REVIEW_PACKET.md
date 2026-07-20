# Review Packet

## Outcome

Implementation Ready / Pending PM independent review and Code Review routing.

## Changed

Added a task-owned, standards-valid source fixture/oracle contract for external-image Lottie and fusion-capable VAP, plus the source-only desktop session runtime-value bridge needed to prepare replacement payloads from canonical replacement authority.

## Exact Scope

Changed files:

- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/multiformat-task-runtime-fixtures.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-task-fixture-source-oracle.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-req-20260709-003-task-fixture-source-oracle-20260716/*`

Base source: `04de162a7425b2e7b00969d2579b15ba2d1f379c`

Product diff SHA-256: `451d5dd128c2405caab1e8c03a0f3807b8a29fa6675044d560df0ac9541df87e`

## Evidence

Failure-first:

- Initial source oracle failed because accepted Lottie image replacement did not reach the prepared runtime payload.
- Fixture contract tests now fail closed for missing Lottie external image, deferred-font fixture drift, missing/malformed VAP sidecar, and VAP fusion identity drift.

Positive:

- Lottie fixture opens as `previewReady`, inlines adjacent image data for runtime preparation, reaches source play/pause states, applies image and text replacements through accepted canonical runtime targets, resets image while preserving text, and resets text to source.
- VAP fixture opens as `previewReady`, prepares adjacent `vapc` sidecar runtime config, exposes image target `avatar` and text target `title`, applies image/text replacements through canonical fusion keys, resets one target while preserving its sibling, and restores clean source state.
- Proof schema is redacted and source-only; it records no raw owner paths or production material paths.

## Validation Summary

Passed:

- `node --check` for touched CJS/MJS files and the new test.
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs` PASS 2/2.
- Focused host/session/canonical replacement group in `svga-web-experiment.test.mjs` PASS 5/5.
- `npm run build` PASS.
- `npm run test:all` PASS 538/538.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check` PASS.
- `git diff --check` PASS.

## Nonclaims

No Electron runtime proof, no installed QA, no foreground run, no installed app mutation, no package/promotion, no runtime permit, no owner material use, no production asset commit, no Product Owner acceptance, no public support, no distribution/release readiness, and no save/export/conversion support.

## Next Gate

PM/A0 independent review. Code Review only if PM routes this successor.
