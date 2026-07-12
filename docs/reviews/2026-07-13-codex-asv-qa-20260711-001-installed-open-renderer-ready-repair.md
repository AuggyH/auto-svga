# ASV-QA-20260711-001 Installed Open Renderer Ready Repair

Date: 2026-07-13

Requirement: ASV-REQ-20260709-003

Branch: `codex/0.2-installed-open-runtime-discriminator-20260713`

Repaired finding: `MF-EARLY-CR-001`

Previous reviewed head: `287f3c670bfb2876bffb689b7cc397cccd2171ca`

State: Fix Ready for Code Review re-review. No QA, Packaging, promotion, foreground run, or product-support claim.

## Summary

Code Review found that the previous early listener repair still treated `window.loadURL()` completion as renderer readiness. That could flush a launch-time file-open queue before the renderer action bridge had called `notifyMultiFormatRendererReady()`. If dispatch failed in this gap, the item was already shifted out of the queue and was lost.

This repair makes `IPC_CHANNELS.multiFormatRendererReady` the real readiness gate:

- `renderer_load_completed` remains trace-only and no longer flips `multiFormatDesktopRendererReady`.
- The expected-sender `renderer_action_bridge_ready` IPC flips `multiFormatDesktopRendererReady = true` and then flushes queued file-open events.
- `flushPendingMultiFormatOpenFileEvents()` now peeks at the first queue item and shifts it only after `dispatchMultiFormatOpenFileEvent()` succeeds.
- A dispatch failure records `dispatch_failed`, keeps the queued item, and stops the current flush attempt so a later valid bridge-ready path can retry.

## Why The Prior Fix Was Incomplete

The prior fix moved `app.on("open-file")` early enough to capture launch-time events, but did not make the renderer action bridge readiness authoritative. It still allowed the queue to be consumed during the `loadURL()` to action-bridge-ready gap.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Removes `loadURL()`-driven readiness/flush.
  - Moves readiness/flush to the validated `multiFormatRendererReady` IPC handler.
  - Preserves queued file-open events until dispatch success.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates the installed file-open static contract to require flush after `renderer_action_bridge_ready`.
  - Adds a launch-time queue regression proving queued items survive `loadURL()` completion and are not shifted before renderer action bridge acceptance.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- Focused installed-open renderer-ready repair tests: PASS 3/3
- Focused installed-open/runtime/formal package-mode group: PASS 7/7
- `git diff --check`: PASS
- `npm run build`: PASS
- `npm run desktop:short-term:design-system-check`: PASS
- `npm run test:all`: PASS 525/525

## Boundaries

- No installed app bytes changed.
- No Packaging, QA, foreground launch, owner material mutation, or promotion was performed.
- Formal `0.1.x` remains guarded before multi-format host-visible side effects.
- This does not claim Lottie/VAP product support, foreground visual success, Product Owner acceptance, release readiness, or save/export/conversion support.

## Next Gate

Route this repair head back to Code Review. If approved, PM can coordinate the exact rebuild/install and combined installed product gate already described by the lane route.

## Project Retrospective

The useful lesson is that “renderer loaded” and “renderer action bridge ready” are distinct host states. Launch-time macOS file events should remain queued until the action bridge itself acknowledges readiness, and the queue should consume items only after an accepted dispatch.

Token usage: unavailable from local runtime.
