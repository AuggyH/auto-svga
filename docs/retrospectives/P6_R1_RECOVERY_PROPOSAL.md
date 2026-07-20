# P6-R1 Recovery Proposal

Status: approved recovery basis; P6-R1 contract revision 3 is frozen for
micro-delta external contract review; implementation and WP0 are not started.

## Correct Freeze Order

1. Owner approved this repaired postmortem and recovery proposal.
2. P6-R1 contract revision 3 is frozen for micro-delta external contract
   review.
3. P6-R1 starts with WP0 Recovery Gate Bootstrap only after contract review
   passes and the owner authorizes WP0.
4. WP0 must pass before WP1 begins.

No validation tooling or product runtime changes should happen before the
P6-R1 contract review passes and WP0 is explicitly authorized.

## Options

### Option A: Continue Existing Technical Layer Repairs

Continue with A1 Web Baseline, A2 Shared Frontend, A3 Electron Host, A4 Parity,
and A5 Packaging.

Pros:

- Existing workers and branch boundaries already exist.
- Technical ownership is easy to parallelize.

Cons:

- This is the same shape that consumed six repairs.
- Cross-layer user journeys can still fail after every worker passes.
- Evidence remains downstream of implementation rather than designed around
  failing user flows.

### Option B: Split By End-to-End Vertical Flow

Use smaller vertical work packages with one lead implementation owner, a
separate evidence owner, a defined machine/code integration verifier, and one
final Product Owner human gate after Final Seal, Post-seal Verification, and
`HUMAN_REQUIRED` materials are ready.

Pros:

- Each package maps to a user-visible outcome.
- Machine gates can fail before handoff packaging starts.
- A0 can integrate and verify after each package.
- Implementation, evidence, and final verification are separated.

Cons:

- Less parallel implementation.
- Requires more up-front contract and gate design.
- Some host and product changes must move through requested integration
  changes instead of shared ownership.

## Recommendation

Choose Option B.

P6 failed to reach acceptance because technical-layer completion did not equal
vertical product parity. P6-R1 should optimize for confidence, not worker
throughput.

## Work Package Ownership

Each work package has exactly one Lead Implementation Owner. Other required
layer changes move through `requestedIntegrationChange` and A0 sequencing.

| Work Package | findingIds | Lead Implementation Owner | Evidence Owner | Integration Verifier | Human Gate Owner |
| --- | --- | --- | --- | --- | --- |
| WP0 - Recovery Gate Bootstrap | `P6-F010`, `P6-F012` | A0 Recovery Gate Lead | Independent Read-only Gate Evidence Reviewer | Independent Contract And Code Reviewer | none |
| WP1 - State Correctness | `P6-F001`, `P6-F002` | P6R1 State Correctness Lead | P6R1 Evidence Lead | A0 | none |
| WP2 - Multi-source Acceptance Flow | `P6-F013` | P6R1 Multi-source Flow Lead | P6R1 Evidence Lead | A0 | none |
| WP3 - Interaction Evidence | `P6-F003`, `P6-F005` | P6R1 Interaction Evidence Lead | Independent Trace Evidence Reviewer | A0 | none |
| WP4 - Visual And Motion Review | `P6-F004`, `P6-F006`, `P6-F008` | P6R1 Visual And Motion Lead | P6R1 Evidence Lead | A0 | none |
| WP5 - macOS App Delivery | `P6-F007`, `P6-F009`, `P6-F011` | P6R1 macOS Delivery Lead | P6R1 Evidence Lead | A0 | none |

Finding primary closure is unique. Other packages may list a finding only under
`supportingFindingIds`; they must not become the primary closure owner.

Gate C is a machine checkpoint, not the final Product Owner human gate. WP4 and
WP5 do not create separate owner gates.

## Gate A - Runtime State Correctness

Validates completed work packages: WP0, WP1.

Finding IDs: `P6-F001`, `P6-F002`, `P6-F010`, `P6-F012`.

Machine entry gate:

- P6-R1 contract revision 3 passed micro-delta external contract review.
- WP0 defines failure-first gate taxonomy.
- Finding Ledger update format is defined.
- Final-head binding rule is defined.
- Reviewer product schema is defined.
- Minimal negative tests are specified before product fixes.

Machine exit gate:

- Loading and Empty are visibly and semantically distinct.
- Invalid clears stale canvas, metadata, ready state, parser state, and report.
- Recovery after invalid file is proven.
- Failure-first state tests pass.
- Finding Ledger is updated with before/after evidence and closure state.

Integration checkpoint:

- A0 verifies WP0 and WP1 on the integration head.

Stop condition:

- If Gate A fails, WP2-WP5 must not start.

## Gate B - Multi-source And Interaction Correctness

Validates completed work packages: WP2, WP3.

Finding IDs: `P6-F013`, `P6-F003`, `P6-F005`; supports future closure
evidence for `P6-F001`, `P6-F002`, and `P6-F007`.

Machine entry gate:

- Gate A passed on the integration head.
- Second SVGA, reference media, latest artifact, and interaction scenarios have
  failure-first tests.

Machine exit gate:

- Second SVGA loads and plays with real evidence.
- Reference media loads and plays with real evidence.
- Latest artifact scan, select, and load are proven.
- Web/Desktop interaction traces contain `stateBefore`, `action`, `stateAfter`,
  and `result`.
- Mutation tests fail when an action is skipped or context differs.

Integration checkpoint:

- A0 verifies multi-source and interaction evidence on the integration head.

Stop condition:

- If Gate B fails, WP4-WP5 must not start.

## Gate C - Visual, Motion And App Delivery

Validates completed work packages: WP4, WP5.

Finding IDs: `P6-F004`, `P6-F006`, `P6-F007`, `P6-F008`, `P6-F009`,
`P6-F011`.

Machine entry gate:

- Gate B passed on the integration head.
- Same state, viewport, fixture, motion trigger, and media context are required
  before visual or motion comparison is generated.

Machine exit gate:

- Same-state, same-viewport, same-fixture evidence is present.
- Responsive comparison cannot PASS with `comparedPixels=0`.
- Normal-motion frames prove real deltas where motion is expected.
- Independent product visual Reviewer returns category verdicts that cannot be
  contradicted by a generic PASS.
- Normal macOS App starts visibly without proof/smoke path.
- Owner App ZIP is bound to final head and visible review package.

Integration checkpoint:

- A0 verifies package, privacy, head binding, and App proof on the integration
  head; owner performs final product gate only after Final Seal, Post-seal
  Verification, and `HUMAN_REQUIRED` materials are ready.

Stop condition:

- If any required machine gate fails, no owner-acceptance Human Gate is
  generated.

## Finding Closure Rules

A finding can close only when all are true:

1. Real runtime evidence exists.
2. A corresponding regression or mutation test exists.
3. A later independent external review does not reproduce the issue.

Internal machine exits use `integrated_resolved_pending_external_review`.
Findings are not `externally_confirmed_closed` until later independent external
review confirms the issue is not reproduced.

## Process Rules For The P6-R1 Contract

These are approved current process rules for P6-R1. If this proposal conflicts
with `docs/loop/CURRENT_MILESTONE.md`, `docs/loop/CURRENT_MILESTONE.md` is the
highest authority.

1. Same finding appears two rounds: mandatory root-cause review.
2. Same finding appears three rounds: pause implementation and run
   retrospective.
3. Repair budget exhausted: postmortem before successor repair milestone.
4. Every external review updates the Finding Ledger.
5. New repair contract must include root-cause hypothesis, why prior fix
   failed, failing test, success stop condition, and failure stop condition.
6. Required machine gate failure means no owner-acceptance Human Gate.
7. One Lead Implementation Owner per vertical package.
8. Implementer, Evidence Owner, and Integration Verifier must be separated.
