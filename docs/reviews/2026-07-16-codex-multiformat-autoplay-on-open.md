# Multi-format Autoplay On Open

Date: 2026-07-16

Branch: `codex/0.2-multiformat-autoplay-on-open-20260716`

Base / installed source baseline: `b2e1cb5f4e4f23d7ebda827070d8037c954a0e54`

Final source head: the commit containing this review file; exact hash is reported in the PM handoff.

## Outcome

Implementation Ready for PM/A0 independent review and Code Review routing.

Successful SVGA, Lottie, and VAP opens now enter `playing` immediately. Manual pause, replay, replacement, Reset, failure, and recovery behavior remain separate.

This is source-only work. It does not modify the installed app, package artifacts, foreground state, owner materials, placement, picker ownership, or UI styling.

## Changed

- After a successful multi-format workspace open reaches internal `ready`, the owner session immediately invokes the existing playback control and returns `playing`.
- The established SVGA controller receives `startPlayback: true` when the accepted owner model is playing.
- Lottie and VAP runtime mounts consume the playing model and invoke their real runtime play paths.
- The task-owned Lottie/VAP source oracle now requires playback to start after open instead of accepting the old stopped-at-start state.
- Successful open regressions cover file-button, native file-open event, drag/drop, first-launch queue, external-image Lottie, embedded-image Lottie, embedded/sidecar/fusion VAP, oversized VAP, and SVGA delegation.

## Files

- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

Product diff SHA-256 over these six files from base `b2e1cb5f`: `0dbb7ee70799734e5f1af608ba82feaa170c3bc073e9d28ccaf3a8d927f6f422`

## Failure-First Evidence

Before the fix, the initial Lottie owner-session assertion failed with actual `previewReady` instead of expected `playing`.

Root cause: the owner session returned immediately after the hidden workspace reached `ready`; the renderer then intentionally mounted every format in the stopped `previewReady` state. The SVGA delegation additionally hardcoded `startPlayback: false`.

## Validation

Passed:

- `npm run build`
- Focused owner/workspace state tests: PASS 28/28
- Multi-format conformance suite: PASS 28/28
- Focused real desktop session/runtime mount group: PASS 8/8
- Task-owned Lottie/VAP source oracle: PASS 3/3
- Root source suite: PASS 185/185
- Direct Electron prototype suite: PASS 139/141, with all changed playback/open/runtime tests passing
- `git diff --check`

Environment limits:

- The packaged-runtime preparation command stopped before tests because local runtime dependency `long` is absent.
- Two unrelated package-proof fixture tests in the direct Electron suite could not load missing local dependency `@electron/asar`. They are not counted as passes.

## Not Changed / Not Claimed

- No automatic resume after replacement or Reset; those existing state contracts remain unchanged.
- No startup placement, picker, main/preload/IPC, right-panel, CSS, or design-token changes.
- No installed app launch, package, promotion, QA, foreground control, owner material mutation, Product Owner acceptance, support, distribution, or release claim.

## Repair Health

- Root-cause hypothesis: the open flow stopped at the inspection-ready owner state instead of advancing through the existing playback action.
- Why prior coverage missed it: prior tests treated `previewReady` as the successful terminal state and then invoked Play manually.
- Success stop: all accepted formats return `playing`, the actual Lottie/VAP mounts receive play calls, and SVGA delegates `startPlayback: true`.
- Failure stop: if installed validation shows a format still stopped after open, run one format-specific runtime discriminator before another source repair.

## Next Gate

Independent Code Review of the exact clean head. Packaging, installation, and installed foreground validation remain downstream gates.
