# Review: Real VAP Runtime Product Vertical

## 1. Summary

Completed the source-side Real VAP Runtime Product Vertical for `ASV-REQ-20260709-003` / `ASV-QA-20260711-001`.

The milestone now mounts the approved packaged `video-animation-player@1.0.5` runtime in the 0.2 Electron renderer path for a bounded local VAP fixture, reaches WebGL canvas/video-ready playback, preserves play/pause state on the existing player, and remounts only for replacement revision changes. Image fusion replacement and reset are proven through the real renderer proof and source regressions.

This is `Fix Ready / Code Review Required`; it is not package generation, installed-app mutation, QA acceptance, foreground visual acceptance, product-support acceptance, save/export/conversion support, or release readiness.

## 2. Git State

- Branch: `codex/0.2-real-vap-runtime-product-vertical-20260713`
- Base before work: `55f3da3b617855013bb3a142715c1f6d3c0cdb9c`
- Commit: pending at review creation; exact final head is reported in the Code Review callback.
- Known untracked residue preserved: `.pnpm-store/`
- Temporary dependency overlay: removed after hidden proof.

## 3. Changed Files

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
- `docs/reviews/2026-07-13-codex-real-vap-runtime-product-vertical.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260711-001-real-vap-runtime-product-vertical-20260713/`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Identify branch converting loaded VAP to source-side limitation | Done. Missing fusion replacement warnings no longer block base VAP playback. |
| 2 | Mount actual packaged VAP runtime in Electron renderer | Done in hidden non-foreground proof with real `video-animation-player` dist. |
| 3 | Render bounded H.264 VAP in product canvas and wire play/pause | Done. Proof reaches WebGL canvas `120x80`, video `readyState=4`, playing video unpaused, paused video paused. |
| 4 | Preserve facts, inventory, privacy, stale/dispose guards | Done. Source tests and proof preserve path redaction, no external requests, and lifecycle cleanup. |
| 5 | Fusion image replacement affects mounted runtime and reset restores base | Done. Proof records replacement revision 1 dirty/remount loaded and reset revision 2 clean/remount loaded. |
| 6 | Over-limit dimensions fail before runtime | Done via focused VAP preparation/inspection suites. |
| 7 | Preserve accepted Lottie/SVGA behavior | Done through related focused suites and full regression. |
| 8 | Use task-owned fixture only; no production asset commit | Done. No media/archive changed files; proof uses routed temp VAP fixture and generated temp PNG. |

## 5. Verification

Commands and results:

```text
npm run build
PASS

node --test --test-name-pattern "0\\.2 installed file-open keeps source identity|0\\.2 multi-format desktop mode|server uses bounded internal-trial CSP" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 3/3

node --test dist/tests/vap-playback-preparation.test.js dist/tests/vap-web-playback-adapter.test.js dist/tests/vap-preview-vertical.test.js
PASS 27/27

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 10/10

Hidden non-foreground Electron runtime proof
PASS, proof SHA-256 dc0c7b74ff1fa464d0310ff01462851f30a815ecf419a3a4bf89312639bea3a1

npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
PASS

npm run test:all
PASS 527/527

git diff --check
PASS

package/lockfile scan
PASS, no package or lockfile drift

production media/archive changed-path scan
PASS, no matches
```

Hidden proof highlights:

- Loaded: `previewReady`, format `vap`, runtime mount `loaded`, WebGL canvas count `1`, canvas `120x80`, video `readyState=4`, `anyVideoPaused=true`.
- Playing: model `playing`, same runtime loaded, `anyVideoPaused=false`.
- Paused: model `paused`, same runtime loaded, `anyVideoPaused=true`.
- Replacement: revision `1`, dirty `true`, image active, runtime remounted loaded.
- Reset: revision `2`, dirty `false`, runtime remounted loaded.
- Lifecycle: VAP loads `3`, destroys `2`, object URLs created `3`, revoked `2`.
- Network/CSP: no external requests; no CSP violation, DOMException playback failure, or `requestVideoFrameCallback` null error in console.
- Console warnings are limited to expected VAP missing-fusion warnings before replacement.

## 6. Output Inspection

- Real VAP runtime: mounted through Electron renderer, not fake constructor evidence.
- Canvas: WebGL-backed runtime canvas `120x80`.
- Video: actual video present, `readyState=4`.
- Replacement PNG: task-owned generated 1x1 PNG in temp, SHA-256 `1710ad6525d70838be202209527dab395eddb0c681073430119f3966a5587f36`.
- Bounded VAP fixture: routed task-owned VAP SHA-256 `25ce657cf3de383e368c829bfcb9a17879d2bc7c7ebe151f66ebf5d64b73dd64`.
- VAP sidecar: routed task-owned vapc SHA-256 `d1e9160d3d7f9d25c6b789f39c077603ff8ef50abaa19ccaf9192052ff55dc77`.

## 7. Risks

- This does not prove installed owner app foreground visual acceptance; Packaging and QA must rebuild/install from the reviewed head and run the product gate.
- VAP runtime still emits expected missing fusion warnings for tags that are not provided; these remain warning-level and no longer block base playback.
- The VAP package has no new dependency changes in this milestone; existing approved `video-animation-player@1.0.5` remains the runtime.

## 8. Next Steps

- Route exact final head to independent Code Review.
- If approved, Release/Packaging should rebuild/install exact reviewed bytes.
- QA should run the combined installed positive-capability gate only after Packaging installs the reviewed head.

## 9. Commit

- Commit: pending at review creation; exact final head is reported in callback.
- Branch: `codex/0.2-real-vap-runtime-product-vertical-20260713`
- Tag: none

## 10. Project Retrospective

- Value assessment: High
- Cost drivers:
  - Actual browser runtime proof was required because fake constructor tests missed VAP package bootstrap behavior.
  - The VAP package uses constructor-time async video play and WebGL initialization, so lifecycle repair needed real event timing.
  - Runtime replacement needed a private renderer payload cache because owner-visible models intentionally redact replacement values.
- Avoidable costs:
  - Earlier runtime proof predicates should have required actual paused video state, not only host model `paused`.
  - Existing source tests should have distinguished base VAP playback with missing fusion warnings from replacement-required hard blocks.
- Product lessons:
  - Missing VAP fusion replacement data should not block base video preview when the video itself is playable; it should remain visible as warning-level inventory/fusion feedback.
- Technical lessons:
  - Reuse the active VAP runtime across play/pause for the same source and replacement signature; remount only on source or replacement revision/config changes.
  - Bind VAP desired playback state to `player.video` readiness/`playing`, not immediate microtasks, because the package treats interrupted bootstrap play as a load error.
  - Runtime replacement values must stay private to the renderer/runtime payload and must not be inferred from redacted owner-visible `valuePreview`.
- Design / interaction lessons:
  - A visible preview can honestly show warning-level missing fusion issues while still allowing playback controls for the base media.
- Process lessons:
  - The self-hosted proof should stop at the first actual runtime/package error and avoid building a fake browser once real Electron evidence is available.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes, after CR/QA confirms the installed gate.

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: The most useful discriminator was one hidden Electron proof with the actual packaged runtime, followed by focused source regressions.
