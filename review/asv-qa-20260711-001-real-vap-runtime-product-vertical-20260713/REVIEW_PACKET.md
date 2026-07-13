# ASV-QA-20260711-001 Real VAP Runtime Product Vertical

## Summary

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-real-vap-runtime-product-vertical-20260713`
- Base: `55f3da3b617855013bb3a142715c1f6d3c0cdb9c`
- State: `Fix Ready / Code Review Required`

This milestone replaces the previous source-side VAP limitation with a real hidden 0.2 Electron renderer runtime path for supported bounded local VAP. The actual approved `video-animation-player@1.0.5` browser runtime mounts, plays, pauses, remounts for image fusion replacement, and resets to base state under a task-owned non-foreground proof.

## Root Cause

The product had three source-side gaps:

- Missing VAP fusion replacement tags were treated as playback-blocking, so base playable VAP stayed in a limitation state.
- The renderer remounted/destroyed the VAP runtime on every model status change, so play/pause created new players instead of controlling the active player.
- The runtime payload was built from owner-visible `valuePreview`, which intentionally redacts image values, so VAP fusion replacement did not receive the real data URI.

The real runtime proof also exposed one package-timing issue: pausing immediately during VAP constructor bootstrap interrupts the package's initial `video.play()` promise and is reported as a load error. The fix binds desired playback state to the package-owned `player.video` `playing` event, then enforces preview/paused with an actual pause.

## Key Changes

- Base VAP playback now proceeds with warning-level missing fusion issues instead of blocking the runtime.
- VAP renderer preview reuses the active player for the same `sourceId` and replacement signature.
- Play/pause/seek sync onto the existing VAP player.
- Remount occurs on source change, image/text replacement revision change, or reset.
- Renderer keeps private runtime replacement values for payload preparation without exposing raw values in the owner-visible model.
- VAP runtime script loading includes a VAP-only regenerator-runtime shim so CSP stays strict without generic `unsafe-eval`.
- Hidden runtime proof script exercises the actual Electron renderer, actual VAP package, actual H.264 bounded fixture, WebGL canvas, play/pause, image replacement, reset, and offline/no-network closure.

## Changed Files

- `src/workbench/vap-playback-preparation.ts`
- `src/workbench/vap-web-playback-adapter.ts`
- `src/tests/vap-playback-preparation.test.ts`
- `src/tests/vap-preview-vertical.test.ts`
- `src/tests/vap-web-playback-adapter.test.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/vap-regenerator-runtime-global-shim.js`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-vap-runtime-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Validation

- `npm run build`: PASS
- Focused Electron runtime/controller/CSP tests: PASS 3/3
- VAP preparation / adapter / hidden vertical focused tests: PASS 27/27
- Owner-preview candidate focused tests: PASS 10/10
- Hidden non-foreground real VAP Electron proof: PASS
- Design-system check: PASS
- `npm run test:all`: PASS 527/527
- `git diff --check`: PASS
- Package/lockfile scan: PASS, no package or lockfile drift
- Production media/archive changed-path scan: PASS, no matches

## Real Runtime Proof

Proof SHA-256: `dc0c7b74ff1fa464d0310ff01462851f30a815ecf419a3a4bf89312639bea3a1`

Important evidence:

- Loaded VAP: `previewReady`, WebGL canvas count `1`, canvas `120x80`, video `readyState=4`, `anyVideoPaused=true`.
- Playing: model `playing`, `anyVideoPaused=false`.
- Paused: model `paused`, `anyVideoPaused=true`.
- Image replacement: revision `1`, dirty `true`, runtime remounted loaded.
- Reset: revision `2`, dirty `false`, runtime remounted loaded.
- Lifecycle: VAP loads `3`, destroys `2`, object URLs created `3`, revoked `2`.
- External requests: none.
- Console: no CSP violation, DOMException playback failure, or `requestVideoFrameCallback` null error; only expected missing fusion warnings before replacement.

## Protected Flow Checks

- Formal 0.1 isolation preserved.
- No save/export/conversion work.
- No package build or installed app mutation.
- No foreground operation.
- No production asset commit or copy.
- Temporary hash-matched Electron dependency overlay removed after proof.
- Classified `.pnpm-store/` residue preserved and unstaged.

## Risks

- This is source/dev runtime evidence only. Installed foreground product acceptance still requires Packaging and QA.
- Real owner VAP materials beyond the bounded task-owned fixture are not claimed as visually accepted.
- VAP product support, release readiness, public distribution, and Product Owner acceptance remain out of scope.

## Next Action

Route this exact head to Code Review. If approved, Packaging should rebuild/install exact reviewed bytes, then QA should run the combined installed positive-capability product gate.
