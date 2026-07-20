# Review Packet

## Outcome

Implementation Ready / Pending PM independent review and Code Review routing.

## Changed

Multi-format runtime preview preparation/load failures now preserve the currently opened file as a recoverable `playbackFailed` document instead of entering the generic Open-failure path.

## Exact Scope

Changed files:

- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-runtime-failure-recovery.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-req-20260709-003-runtime-failure-recovery-20260716/*`

Base: `0f430fa2b63abe7b9e87a9336a087c4b2533e87f`

Product diff SHA-256: `a7beed276675217274844b4e50d98fba32f8ac94e1a5957ddcf4adcc7ab56675`

## Evidence

Failure-first:

- New regression failed before the product fix because runtime prepare failure switched `state.view` to `failed`.

Positive:

- Runtime prepare failure leaves the current Lottie source in `preview`.
- Model status becomes `playbackFailed`.
- Source id, display name, selected image target, selected text target, and right-panel-driven replacement command state are preserved.
- Owner-visible failure copy is typed and path-redacted.
- Play/pause command triggers host `recover`.
- Recovery returns to `previewReady` and remounts runtime.

## Validation Summary

Passed:

- Controller syntax
- Test syntax
- Focused runtime failure regression 1/1
- Focused renderer/open/runtime group 6/6
- Root build
- Root `test:all` 538/538
- Desktop design-system check
- Diff hygiene
- Package/lockfile changed-path scan
- Production media/generated-output changed-path scan

Partial:

- Direct full `svga-web-experiment.test.mjs` run was 78/80 because local `@electron/asar` is absent for two macOS package-proof fixture tests. Related runtime/open/controller tests passed.

## Nonclaims

No installed QA, no Product Owner acceptance, no foreground run, no installed app mutation, no packaging, no promotion, no Finder/native chooser, no startup-placement repair, no save/export/conversion support, and no release/distribution readiness.

## Next Gate

PM/A0 independent review. Code Review only if PM routes this successor.
