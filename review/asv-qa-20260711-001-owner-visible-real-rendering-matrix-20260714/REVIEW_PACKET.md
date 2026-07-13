# ASV-QA-20260711-001 Owner-visible Real Rendering Matrix

## Summary

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-owner-visible-real-rendering-matrix-20260714`
- Base: `19d668f01fc1ebeb026a1a519e4d6e8fa6c1d1f1`
- State: `Implementation Ready / Code Review Required`

This milestone repairs the shared 0.2 owner-visible preview runtime so valid SVGA, Lottie, and in-policy VAP exercise real renderer surfaces instead of source-side placeholder contracts.

## Root Cause

The revoked matrix acceptance relied on labels and model states that could be true while the visible runtime area still showed placeholder text. SVGA had no prepared runtime payload path, and runtime progress was overwritten by generic playback state rendering after mount. The result was a UI that could say ready or playing while the user still saw source-side preview contract content and no time advancement.

## Key Changes

- Added bounded SVGA runtime payload preparation with `svgaBase64` and the existing `svga-web` vendor runtime script.
- Added renderer-side SVGA runtime mounting through the existing canvas playback module.
- Drew SVGA frame 0 immediately after real `svga-web` mount so `previewReady` owns decoded canvas pixels.
- Preserved the active same-source SVGA canvas across play/pause state transitions instead of repainting the source-side placeholder card.
- Preserved Lottie and VAP runtime mounting while synchronizing visible playback time from active runtime progress.
- Reused the active Lottie animation for same-source play/pause so pausing preserves the advanced frame instead of remounting to frame 0.
- Scoped the runtime-mount canvas aspect ratio to its intrinsic backing store, preserving `120x80` VAP presentation without changing the formal SVGA canvas rule.
- Hardened the proof gate so successful loaded/playing/paused phases fail if source-side placeholder or limited-playback copy is still visible, if SVGA lacks direct nonblank backing-store pixels, or if SVGA backing-store evidence matches the opaque placeholder-card shape.
- Bound Lottie evidence to the live SVG child and VAP evidence to the WebGL child, including time-paired pixel change and backing/CSS/capture aspect-ratio equality.
- Added a hidden packaged-equivalent real-rendering matrix proof for SVGA, Lottie, VAP, VAP replacement/reset, over-limit VAP, and missing-resource Lottie.
- Extended focused Electron tests so the desktop session prepares SVGA, Lottie, and VAP candidates to terminal runtime states.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-rendering-matrix-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Validation

- `node --check` for touched runtime/session/proof files: PASS.
- Focused renderer/session tests: PASS 2/2.
- Related runtime-mount/installed-open/replacement/over-limit/formal 0.1 focused group: PASS 10/10.
- Hidden non-foreground real-rendering matrix proof: PASS.
- `npm run build`: PASS.
- `npm run desktop:short-term:design-system-check`: PASS.
- `npm run test:all`: PASS 528/528.

## Runtime Proof Coverage

The hidden Electron proof uses task-owned local fixtures and no installed app:

- SVGA: real `svga-web` canvas mounts, direct canvas backing-store pixels are nonblank, the backing store stays `300x300` across load/play/pause, playing advances, and paused state stabilizes on decoded artwork.
- Lottie: real `lottie-web` SVG runtime mounts with a generated adjacent image, playing advances, and paused state preserves the advanced frame.
- VAP: real `video-animation-player` WebGL/video runtime mounts, video reaches ready state, play/pause are truthful, and backing/CSS/Retina-capture dimensions remain `120x80` / `120x80` / `240x160`.
- VAP replacement/reset: image replacement remounts runtime with dirty/reset-enabled state, reset remounts source state.
- Negative cases: over-limit VAP blocks before runtime creation; missing-resource Lottie produces a typed terminal failure.
- External requests: none.
- False-positive guards: intentional source-side placeholder text, generic visible-canvas identity, transparent blank SVGA backing store, opaque source-side placeholder-card pixels, nonzero pause-frame reset, blank/static Lottie or VAP child pixels, and square VAP CSS distortion are rejected as playable success.

Latest pre-commit proof: `/var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-real-rendering-matrix-proof-94715/real-rendering-matrix-proof.json`, SHA-256 `b713a89d68ee710aebe41eb8bd65aa199f76c3ceafa78cea05a958aa90c825c7`.

Final Code Review callback supplies the post-commit head-bound proof path and SHA-256.

## Protected Boundaries

- No foreground control.
- No installed app mutation.
- No owner production asset commit or copy.
- No package build, promotion, or QA route from this implementation turn.
- No save/export/conversion scope.
- No Product Owner acceptance, product support, distribution, or release readiness claim.

## Next Action

Route the exact committed head to Code Review. If approved, PM can coordinate Packaging and QA for rebuilt installed bytes.
