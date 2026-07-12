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

## Active Finding Ledger

| Round | Head | Disposition | Evidence | Repair State |
| --- | --- | --- | --- | --- |
| Initial CR | `287f3c670bfb2876bffb689b7cc397cccd2171ca` | Changes Requested, `MF-EARLY-CR-001` | `loadURL()` completion could set ready, flush, dispatch, and drop the queued item before renderer action bridge readiness. | Repaired in `main.cjs` by moving readiness/flush to the renderer-ready IPC and preserving queue items until dispatch success. |
| Re-review | `a25f4cba0a1f8334085986ee1929ce1be52c61ba` | Changes Requested, `MF-EARLY-CR-001R` | Product code direction was accepted, but `multiformat-open-runtime-trace.test.mjs` still asserted the rejected `loadURL -> ready -> flush` contract. | Repaired by updating the trace contract test to require `loadURL()` trace-only behavior and `renderer_action_bridge_ready` IPC-bound flush. |

### Root-Cause Review For Recurrence

The recurrence was not a new runtime-gate implementation defect. It was a stale tracked diagnostic contract outside the focused `svga-web-experiment.test.mjs` group. The first repair updated the implementation and the installed-open source tests, but did not run or update `multiformat-open-runtime-trace.test.mjs`, which was specifically designed to protect the runtime trace order and still encoded the old unsafe order.

Success stop condition: the exact trace contract test passes, the focused installed-open/runtime group passes, `main.cjs` still checks syntactically, diff hygiene passes, and no code re-expansion is needed.

Failure stop condition: any remaining tracked test asserts `loadURL()` as readiness, any queue item can be shifted before accepted dispatch, or a third independent recurrence appears; in that case implementation should pause for a fuller retrospective.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Removes `loadURL()`-driven readiness/flush.
  - Moves readiness/flush to the validated `multiFormatRendererReady` IPC handler.
  - Preserves queued file-open events until dispatch success.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates the installed file-open static contract to require flush after `renderer_action_bridge_ready`.
  - Adds a launch-time queue regression proving queued items survive `loadURL()` completion and are not shifted before renderer action bridge acceptance.
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs`
  - Updates the trace contract so `renderer_load_completed` is trace-only and readiness/flush are bound to the `renderer_action_bridge_ready` IPC handler.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs`: PASS 3/3
- Focused installed-open renderer-ready repair tests: PASS 3/3
- Focused installed-open/runtime group: PASS 5/5 after the trace-test repair
- Focused installed-open/runtime/formal package-mode group on the first repair head: PASS 7/7
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

The follow-up lesson from `MF-EARLY-CR-001R` is to include trace-contract tests when repairing trace semantics; otherwise the implementation and primary behavior tests can pass while a dedicated diagnostic guard still encodes the rejected behavior.

Token usage: unavailable from local runtime.
