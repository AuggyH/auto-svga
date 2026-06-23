# P6-R1 Recovery Proposal

This is a proposal only. P6-R1 is not frozen or started.

## Options

### Option A: Continue Existing Technical Layer Repairs

Continue with A1 Web Baseline, A2 Shared Frontend, A3 Electron Host, A4 Parity,
and A5 Packaging.

Pros:

- Existing workers and branch boundaries already exist.
- Technical ownership is clear.
- Parallelism is easy to schedule.

Cons:

- This is the same shape that consumed six repairs.
- Cross-layer user journeys can still fail after every worker passes.
- Evidence remains downstream of implementation rather than designed around
  failing user flows.

### Option B: Split By End-to-End Vertical Flow

Use smaller vertical packages with their own failing tests, product changes,
evidence, integration verification, and human gate.

Pros:

- Each package maps to a user-visible outcome.
- Machine gates can fail before handoff packaging starts.
- A0 can integrate and verify after each package.
- Better separation between implementation owner, evidence owner, and final
  verifier.

Cons:

- Less parallel implementation.
- Requires more up-front test and evidence design.
- Some host and product files may need carefully sequenced ownership.

## Recommendation

Choose Option B.

P6 failed to reach acceptance because technical-layer completion did not equal
vertical product parity. P6-R1 should optimize for confidence, not worker
throughput.

## Work Packages

### WP1 - State Correctness

- Objective: Empty, Loading, Loaded, Invalid, and Recovery are visibly and
  semantically correct in Web and Desktop.
- Inputs: current P6 product shell, state probes, external review findings.
- Implementation owner: shared frontend worker.
- Evidence owner: evidence worker.
- Integration verifier: A0.
- Machine entry gate: failing tests for Loading hiding Empty CTA and Invalid
  clearing stale state.
- Machine exit gate: same fixture/viewport state evidence; stale fields clear.
- Human gate: compare state contact sheet for obvious state confusion.
- Dependencies: none.
- Prohibited shortcuts: no alias-only state pass; no screenshot-existence pass.
- Required failing test before implementation: invalid-after-loaded stale state
  test and loading-vs-empty visual text/geometry test.

### WP2 - Multi-source Acceptance Flow

- Objective: second SVGA, reference media, latest artifact, and synchronized
  playback all load and play where supported.
- Inputs: WP1 stable state machine.
- Implementation owner: shared frontend + host worker.
- Evidence owner: evidence worker.
- Integration verifier: A0.
- Machine entry gate: failing test for second SVGA loaded/playback proof.
- Machine exit gate: file bytes, playback, source labels, and sync controls
  proven for Web/Desktop.
- Human gate: owner sees multi-source flow contact sheet.
- Dependencies: WP1.
- Prohibited shortcuts: no item-id-only proof; no generic state proof.
- Required failing test before implementation: reference media and second SVGA
  proof missing should fail parity.

### WP3 - Interaction Evidence

- Objective: actual Web and Desktop traces prove before/action/after for
  required controls.
- Inputs: WP1/WP2 stable flows.
- Implementation owner: product/host worker as needed.
- Evidence owner: evidence worker.
- Integration verifier: A0.
- Machine entry gate: mutation test where action is skipped but artifact exists.
- Machine exit gate: before/after digest, screenshot, and context equality per
  action.
- Human gate: reviewer spot-checks trace screenshots.
- Dependencies: WP1, WP2.
- Prohibited shortcuts: no final-state-only trace; no context mismatch.
- Required failing test before implementation: skipped click must fail.

### WP4 - Visual And Motion Review

- Objective: same state/viewport/fixture visual and motion evidence, with clear
  human review boundary.
- Inputs: stable state and interaction flows.
- Implementation owner: product worker for fixes only.
- Evidence owner: evidence worker + read-only visual reviewer.
- Integration verifier: A0 + owner.
- Machine entry gate: identical Web motion frames in normal-motion mode fail.
- Machine exit gate: normal motion deltas, reduced-motion check, same state and
  viewport.
- Human gate: independent visual reviewer and owner visual gate.
- Dependencies: WP1-WP3.
- Prohibited shortcuts: no pixel-perfect PASS claim; no frame-existence-only
  motion pass.
- Required failing test before implementation: all-identical normal motion
  frames fail.

### WP5 - macOS App Delivery

- Objective: normal App open, File > Open, real workflow, package, privacy, and
  user manual test package.
- Inputs: WP1-WP4 accepted machine gates.
- Implementation owner: host/package worker.
- Evidence owner: A0.
- Integration verifier: A0 + owner.
- Machine entry gate: packaged launch without proof/smoke flags.
- Machine exit gate: App starts, loads fixture, plays, inspects, exits, cleans
  temp, logs redact paths.
- Human gate: owner double-click/manual import.
- Dependencies: WP1-WP4.
- Prohibited shortcuts: no hidden window proof; no proof env; no unsigned app
  described as production.
- Required failing test before implementation: proof/smoke flag launch rejected
  as normal App proof.

## Pre-R1 Required Validation Facilities

Before freezing P6-R1:

1. Finding ledger update command.
2. Final-head binding gate across Git, LOOP_STATE, LOOP_HISTORY, evidence,
   manifest, packet, validation, and parity report.
3. State/motion/interaction negative tests listed above.
4. Reviewer product-observation schema separate from packet-integrity review.
5. Gate taxonomy replacing overloaded PASS language.

## Stop Conditions

- Same finding appears in two consecutive rounds: stop and do root-cause review.
- Same finding appears in three rounds: stop implementation and run
  retrospective.
- Any machine gate fails: do not generate owner acceptance packet.
- If repair budget exhausts: do not create a new implementation prompt before
  postmortem.
