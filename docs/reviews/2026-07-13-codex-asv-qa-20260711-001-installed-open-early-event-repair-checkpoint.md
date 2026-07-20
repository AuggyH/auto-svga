# ASV-QA-20260711-001 Installed Open Early Event Repair Checkpoint

Date: 2026-07-13

Requirement: ASV-REQ-20260709-003

Branch: `codex/0.2-installed-open-runtime-discriminator-20260713`

Base head before repair: `5b0e67dda60d2b2ad6d9748b9d7a3c724bf7753c`

State: Checkpoint implemented; no CR, QA, Packaging, promotion, foreground run, or support claim.

## Summary

Permit 022 proved the same packaged runtime can reach `previewReady` for a synthetic Lottie when the app is launched first, bridge readiness is reached, and the file is delivered to the same process afterward. The repeated installed failure from permit 018/018 follow-up therefore was not caused by an absent Lottie parser/player/runtime chain.

The first evidence-backed difference is startup delivery timing: the installed foreground gates used macOS file-open delivery as part of app launch, while the passing discriminator delivered the file after `main_started` and bridge readiness. In the source, `app.on("open-file")` was registered near the end of `main.cjs`, after startup trace and after substantial setup. A launch-time file-open event could therefore arrive before the listener existed, leaving the app on the Launch/open-candidate surface.

## Root Cause Map

- A. LaunchServices did not deliver `open-file`: not proven. Permit 022 proves LaunchServices can deliver to the task-owned app when listener and runtime are ready.
- B. Runtime not recognized as formal 0.2: unlikely for this symptom. Permit 018 installed identity reported `productMilestoneId=0.2-multiformat-preview`, and Permit 022 trace reached formal 0.2.
- C. Event queued but not flushed: not the first missing phase in source. Queue/flush was proven in Permit 022.
- D. Main/session completed but renderer did not apply: not the first missing phase for the installed Launch fallback. Same-process trace reached renderer/session complete and `previewReady`.
- First concrete difference repaired: the `open-file` listener now registers immediately after trace creation and before `main_started`, so launch-time file-open events can be prevented and queued.

## Product Boundary Notes

The task-owned real LOTTIE-A alias shape was compared read-only at metadata level. It is a Lottie JSON with embedded image assets and should surface a visible typed limitation rather than a loaded playback preview. The repair does not claim real LOTTIE-A playback success.

The positive source/dev runtime path for synthetic Lottie and bounded sidecar VAP remains covered by existing tests. A rebuilt installed candidate is required to prove this specific launch-time `open-file` listener repair in the real app package.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Moved multi-format file-open queue state and `app.on("open-file", handleMultiFormatOpenFileEvent)` registration before `main_started`.
  - Kept formal 0.1 guard before `event.preventDefault()`.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Strengthened the installed file-open static test to require listener registration before `main_started` and `app.whenReady()`.
  - Added embedded-image Lottie file-open coverage proving visible `playbackBlocked` typed limitation, non-replaceable embedded image assets, redaction, and no renderer load.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- Focused file-open regression pair: PASS 2/2
- Focused Electron installed file-open / runtime / formal 0.1 group: PASS 6/6
- `node --test dist/tests/vap-inspection.test.js`: PASS 14/14
- `node --test dist/tests/multiformat-owner-preview-candidate.test.js`: PASS 10/10
- `node --test dist/tests/lottie-json-inspection.test.js`: PASS 10/10
- `npm run build`: PASS
- `npm run desktop:short-term:design-system-check`: PASS
- `npm run test:all`: PASS 525/525
- `git diff --check`: PASS

One broader Electron pattern run also executed the package-proof tests and failed only on the existing local dependency-tree gap `Cannot find module '@electron/asar'`; the exact non-packaging Electron subset passed after excluding those unrelated package-proof cases.

## Risks And Next Gate

- This source repair still requires a rebuilt alpha2 candidate and installed foreground regression; installed bytes are unchanged.
- It does not repair or relax LOTTIE-A embedded image limitations. For that real material, success is a visible typed limitation unless product scope later approves embedded image playback support.
- No Product Owner acceptance, Lottie/VAP product support, save/export/conversion support, package readiness, foreground visual success, or release readiness is claimed.

## Project Retrospective

The discriminating trace was valuable because it separated product runtime capability from delivery timing. The lesson is to register macOS `open-file` handlers before startup traces or heavy setup, then keep same-process queue/flush tests as regression coverage.

Token usage: unavailable from local runtime.
