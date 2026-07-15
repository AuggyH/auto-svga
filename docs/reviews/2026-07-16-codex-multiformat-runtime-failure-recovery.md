# Multi-format Runtime Failure Recovery

Date: 2026-07-16

Branch: `codex/0.2-multiformat-daily-use-stability-20260716`

Base / installed QA baseline: `0f430fa2b63abe7b9e87a9336a087c4b2533e87f`

Final source head: the commit containing this review file; exact hash is reported in PM handoff.

## Outcome

Implementation Ready for PM/A0 independent review and Code Review routing.

This is source-only work. It does not touch the installed app, foreground, Finder/native chooser, startup placement proof, packaging, promotion, QA roots, or owner materials.

## Changed

- Preserved the active multi-format document when runtime preview preparation or VAP runtime load fails after a successful open.
- Converted the current owner model into `playbackFailed` instead of using the Open-failure path.
- Kept source identity, selected image/text targets, right-panel projection, replacement affordances, and host recover controls alive.
- Routed the next play/replay interaction through host `recover`, allowing the session to re-enter `previewReady`.

## Files

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Product diff SHA-256 over changed source/test files from base `0f430fa2`: `a7beed276675217274844b4e50d98fba32f8ac94e1a5957ddcf4adcc7ab56675`

## Failure-First Evidence

The new focused regression failed before the product fix:

```text
node --test --test-name-pattern "runtime prepare failure preserves" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
FAIL: expected state.view "preview", actual "failed"
```

Root cause: `mountRuntimePreview().catch()` and VAP `onLoadError` called `showFailure(...)`. That path clears runtime and enters the failed view, but it does not convert the active model into a recoverable playback failure. The product could therefore lose the daily-use context after a renderer/session error even though the host session has a `recover` action.

## Validation

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `node --test --test-name-pattern "runtime prepare failure preserves" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` PASS 1/1
- Focused renderer/open/runtime group PASS 6/6
- `npm run build` PASS
- `npm run test:all` PASS 538/538
- `npm run desktop:short-term:design-system-check` PASS
- `git diff --check` PASS
- Strict JSONL parse PASS before packet reseal; rerun required after final ledger/packet updates.
- Package/lockfile changed-path scan PASS, no output.
- Production media/generated-output changed-path scan PASS, no output.

Partial / environment:

- Direct full `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` was PARTIAL 78/80. The two failures are macOS package-proof fixture tests that require missing local dependency `@electron/asar`. The touched runtime/open/controller tests in that file passed, including the new recovery test.

## Not Changed / Not Claimed

- No startup placement or acceptance proof source changes.
- No picker/native chooser source changes.
- No renderer CSS/layout changes.
- No installed app launch, packaging, promotion, QA route, foreground control, Finder/dialog interaction, owner material mutation, save/export/conversion support, Product Owner acceptance, distribution readiness, or release readiness.

## Repair Health

- Root-cause hypothesis: runtime preview mount failures were handled by the generic owner failure view rather than the multi-format playback failure model.
- Why previous work missed it: source coverage proved successful mount/replacement/reset and Open failure revocation, but did not assert post-open runtime prepare/load failure recovery at the controller boundary.
- Success stop: active source remains in preview as `playbackFailed`, menu preserves recover/replacement authority, raw paths stay redacted, and host `recover` restores `previewReady`.
- Failure stop: if an installed/runtime proof later shows a second same symptom after this source repair, stop and run a smallest discriminator between host `recover`, renderer remount, and runtime dependency failure.

## Next Gate

PM/A0 independent review, then Code Review if PM routes it. Installed QA Permit097 and the 0f430fa2 baseline remain separate.
