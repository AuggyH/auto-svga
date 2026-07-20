# ASV-QA-20260711-001 Permit 016 Input Chain Repair

## Scope

- Requirement: `ASV-REQ-20260709-003`
- QA fact-source: `b31c76fdffd3c5864b7308fa3c2ff6598457749b`
- QA evidence SHA-256: `0f4fddff6be390e588d60ef4b457c66d9da2a6c5f952ac8cef6624ab4480a0d0`
- Repair branch: `codex/0.2-installed-open-payload-repair-20260713`
- Base: `c3150ead6edc046f70811209ed48c8a99c88243b`
- Status: Fix Ready for Code Review, not QA acceptance.

## Failure And Root Cause

Installed permit 016 proved that LOTTIE-A, a bounded 120x160 VAP plus sidecar,
and the real over-limit VAP all failed before format detection with the same
path-redacted `Owner-visible multi-format preview open input is incomplete`
message.

The main process passed the valid source discriminant `fileOpenEvent`, while
the owner-visible candidate, shared workspace, Lottie vertical, and VAP
vertical accepted only `fileButton`, `dragDrop`, and `menuOpen`. This rejected
the complete local path input at the first validator. Existing tests checked
the main queue and renderer event actions separately, but session-positive
tests used `fileButton` and renderer mount tests used fabricated results.

A second gap appeared after positive open: desktop control, replacement, and
reset results omitted the active hashed `sourceId`, so the renderer could clear
the runtime mount during play/pause or remount operations.

## Repair Contract

- Root-cause hypothesis: the installed source discriminant and hashed source
  identity were not represented end to end in the shared open/control contract.
- Why prior evidence missed it: static installed event tests stopped before the
  real session validator, while positive session and renderer tests used
  different synthetic entry shapes.
- Failure-first test: send temporary Lottie and bounded VAP paths through
  `openLocalFilePath(path, "fileOpenEvent")` and require positive terminal
  states. Before the repair, the first Lottie assertion returned `failed`.
- Success stop condition: Lottie and bounded VAP reach positive session,
  payload, mount, playback, facts, and inventory evidence; fusion replacement
  and reset remain truthful; over-limit VAP reaches the 1504 policy; 0.1,
  privacy, stale-request, and full regression gates pass.
- Failure stop condition: any recurrence of generic incomplete input, stale
  source remount, raw path exposure, over-limit bypass, 0.1 widening, or third
  independent recurrence stops implementation and returns exact evidence.

## Repair

- Added `fileOpenEvent` to the owner/workspace/Lottie/VAP open-source contracts
  and their runtime validators.
- Retained the current hashed source identity in the desktop session for
  control/replacement/reset results.
- Allowed an open result to update that identity only when its request id still
  matches the returned model, preserving stale-open protection.
- Added a renderer fallback to its already-confirmed state source id for
  runtime preparation after controls or replacement actions.

## Verification

- Failure-first: FAIL as expected before repair, Lottie status `failed` instead
  of `previewReady`.
- Build: PASS.
- Installed file-open, renderer mount, and formal 0.1 focused group: PASS 6/6.
- Related Lottie/VAP/workspace/owner/asset group: PASS 43/43.
- Full `npm run test:all`: PASS 525/525.
- Desktop design-system check: PASS.
- Node syntax and `git diff --check`: PASS.

Positive fixtures are generated under task-owned temporary directories and are
deleted during test cleanup. No production material is copied, mutated, or
committed. Serialized models are asserted not to contain raw temporary paths.

## Finding Ledger

| Finding | External round | Reviewed source | Outcome | Evidence | Attempted repair | Current status |
|---|---|---|---|---|---|---|
| `ASV-QA-20260711-001-P016` | Installed positive-capability permit 016 | `c3150ead` | Changes Requested | Lottie, bounded VAP, and over-limit VAP all stopped at `open_input_invalid` before detection | Propagate `fileOpenEvent` and active hashed source identity through session/control/renderer boundaries; add same-shape positive tests | Fix Ready / independent Code Review required |

## Boundary And Next Gate

No package, installed-app mutation, foreground run, QA rerun, save/export,
conversion, Product Owner acceptance, support claim, visual success, or release
readiness is included. The exact Fix Ready head must pass Code Review before a
new package and installed foreground gate can be considered.
