# ASV-QA-20260711-001 Permit 018 Runtime Discriminator

## Status

`Runtime Discriminator Ready / One Bounded PM Permit Required`.

This record is for the repeated installed positive-capability symptom on exact
source `94dc86f78e84e3ed8798f81d1556e5836d23621f`. It is not a speculative source
fix, Code Review handoff, package promotion, QA rerun, or support claim.

## Durable QA Evidence

- QA fact-source: `77e5bde2e53e4f3ff406d3d199a439357a5d1556`
- Report: `docs/quality/reports/ASV-QA-20260711-001-permit-20260713-018-combined-installed-positive-capability.md` in the QA worktree
- Evidence JSON: `/private/tmp/auto-svga-qa-multiformat-positive-20260713-018/ASV-APR-20260713-018-combined-installed-positive-capability-evidence.json`
- Evidence SHA-256: `8341d2c3131d4664ed4fbadb920f01042af55fab310bdcc9dd4c6bbb403070fb`
- Observed result: installed identity/runtime preflight passed, one exact
  LOTTIE-A macOS file-open launch remained on Launch/open-candidate, and QA
  stopped before VAP under the first-missing-phase rule.

## Active Finding Ledger

| Finding | External round | Reviewed head | Outcome | Prior attempt | Why it did not close the finding | Current recovery |
|---|---|---|---|---|---|---|
| `ASV-QA-20260711-001-P018` | Installed positive-capability permit 018 | `94dc86f7` | Changes Requested | Added `fileOpenEvent` to all source validators and preserved hashed source identity through controls/remounts | Same-shape source/session tests passed, but they did not execute an actual packaged LaunchServices startup. The installed window still showed no evidence that the event reached or survived the main-to-renderer startup boundary. | One trace-only packaged discriminator followed by a minimal observed fix and same-shape confirmation |

This is the second consecutive installed appearance of the same owner-visible
Launch symptom after a source repair. Root-cause review is therefore mandatory
before another behavior change. A third independent recurrence stops this
repair and requires a retrospective.

## Root-cause Map

Only these hypotheses are in scope:

| Hypothesis | First distinguishing trace evidence |
|---|---|
| A. LaunchServices did not deliver Electron `app.on("open-file")`. | `main_started` exists but no `open_file_received`. |
| B. Event arrived outside formal 0.2 runtime mode. | `open_file_received` followed by `open_file_rejected_mode` with `formalRuntimeMode=false`. |
| C. Event queued but was not flushed when the renderer action bridge became ready. | `open_file_queued`; an early/deferred or failed flush; later `renderer_action_bridge_ready`; no accepted renderer begin action. |
| D. Main/session completed but renderer action delivery/application failed. | accepted renderer begin plus `session_open_completed`, followed by missing/false renderer completion or a non-loaded terminal model. |

Source inspection identifies one high-probability discriminator, not yet a
finding closure: main marks the renderer ready immediately after
`window.loadURL()`, while the action bridge is installed only after the
renderer module's top-level dynamic import and event/controller setup. The
diagnostic build deliberately preserves this timing.

## Diagnostic Trace Contract

The trace is disabled by default. A packaged app enables it only when its own
`Contents/Resources/auto-svga-multiformat-trace-run-id` marker contains a safe
run id. Output is fixed to
`/private/tmp/auto-svga-multiformat-trace-<run-id>.jsonl`.

Allowed fields are limited to phase id, timestamp, event/request id, format,
hashed source id, product milestone/formal mode, queue depth, bridge-ready
state, model status, issue code, and action acceptance. Raw paths, file names,
messages, and material bytes are not accepted by the serializer.

## Repair Contract

- Root-cause hypothesis: the exact failure is inside A-D; current source order
  makes C the leading hypothesis, but no behavior fix is allowed before the
  packaged trace distinguishes it.
- Why the previous repair failed: it repaired a real source-validator gap but
  its positive evidence began after LaunchServices delivery and renderer
  readiness, so it could not prove the installed startup boundary.
- Failure-first scenario: launch one task-owned, distinctly identified
  temporary packaged app through LaunchServices with one task-owned Lottie
  file and read only the path-redacted trace.
- Success stop condition: the trace identifies the first missing A-D phase;
  after the minimal fix, the same launch shape reaches accepted renderer open,
  `previewReady`, runtime payload preparation, and renderer loaded state.
- Failure stop condition: ambiguous process/window identity, any raw path or
  material byte in trace, an unapproved foreground requirement, failure to
  distinguish A-D, or a third installed recurrence stops implementation.

## Current Validation

- New trace contract and marker tests: PASS 3/3.
- Main/preload/trace syntax: PASS.
- Existing 525/525 and positive session tests were not rerun because permit 018
  requires a real-launch discriminator rather than another source-only cycle.

## Next Gate

Prepare one task-owned app copy under `/private/tmp` with a distinct bundle id,
display name, trace marker, and synthetic Lottie input. Request one exact PM
foreground permit. Do not launch it before the permit.
