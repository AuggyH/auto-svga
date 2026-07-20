# Acceptance Placement Entrypoint Bootstrap Async Repair

Date: 2026-07-16
Lane: Multi-format
Requirement: ASV-REQ-20260709-003
QA context: ASV-QA-20260714-001 / Permit093
Branch: `codex/0.2-acceptance-placement-entrypoint-bootstrap-20260716`
Rejected head: `1104eb72ff7af79d701f2063e4253e8000018923`

## Summary

Repaired Code Review finding `MF-ENTRYPOINT-BOOTSTRAP-CR-001`.

The prior entrypoint repair installed the acceptance startup proof writer before
local project requires, but removed the `unhandledRejection` guard
synchronously after registering `app.whenReady().catch(...)`. Node emits
`unhandledRejection` after the current turn, so an async rejected promise
scheduled during top-level local require initialization could still bypass the
bounded proof writer and recreate the Permit093 no-proof/no-process class.

This successor keeps the bootstrap fatal/rejection guard alive through the
current event-loop turn by scheduling release with `setImmediate`. The guard is
still bounded to entrypoint bootstrap and is not a permanent runtime exception
policy.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
- `docs/reviews/2026-07-16-codex-acceptance-placement-entrypoint-bootstrap-async-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-qa-20260714-001-acceptance-placement-entrypoint-bootstrap-async-repair-20260716/`

Product/test diff SHA-256 over the two touched source files relative to
`1104eb72ff7af79d701f2063e4253e8000018923`:

`406a2e6702edb9b6ba263c2ed87740e57f59bcc127a0317b5b677591d559feea`

## Failure-First Evidence

Added a focused test that uses a child Node process to exercise actual
`unhandledRejection` ordering:

- immediate same-turn handler removal misses the rejection;
- `setImmediate` removal catches the current-turn async rejection before
  release;
- product source must use the scheduled release and must not directly remove
  the guard after `app.whenReady().catch(...)`.

Before the `main.cjs` repair, the focused placement test failed because
`main.cjs` lacked `scheduleAcceptanceStartupFatalHandlerRelease`.

## Repair

- Added one scheduled-release latch for the early acceptance startup fatal
  handlers.
- Replaced direct synchronous handler removal after `app.whenReady().catch(...)`
  with `scheduleAcceptanceStartupFatalHandlerRelease()`.
- Preserved the existing startup proof writer, owner placement persistence,
  owner-bound picker behavior, and accepted placement proof contract.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`: PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`: PASS 11/11
- Focused startup/proof/picker/file-open group: PASS 25/25
- `npm run build`: PASS
- `npm run test:all`: PASS 538/538
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`: PASS

## Boundaries

No Electron, Auto SVGA, Finder, native chooser, foreground, screenshots,
installed app mutation, Packaging, QA, Code Review routing, owner material
mutation, Product Owner acceptance, support, distribution, or release action
was performed.

This is source-level Implementation Ready only. It does not prove installed
startup placement behavior and does not close ASV-QA-20260714-001.

## Retrospective

Root cause: the previous fix covered synchronous top-level exceptions but did
not model Node's asynchronous `unhandledRejection` delivery timing.

Why the prior fix failed: static source-order tests proved installation before
local requires, but they did not execute the same-turn promise rejection and
handler-removal order.

Reusable lesson: startup bootstrap guards need both source-order and event-loop
timing tests when they are meant to catch entrypoint initialization failures.
