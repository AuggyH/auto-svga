# P6-R1 Recovery Proposal

Status: proposal only. P6-R1 is not frozen or started.

## Correct Freeze Order

1. Owner approves this repaired postmortem and recovery proposal.
2. A P6-R1 contract is created and frozen.
3. P6-R1 starts with WP0 Recovery Gate Bootstrap.
4. WP0 must pass before WP1 begins.

No validation tooling or product runtime changes should happen before the
P6-R1 contract is frozen.

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
separate evidence owner, an A0 or independent machine/code integration
verifier, and a separate Product Owner human gate when applicable.

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
| WP0 - Recovery Gate Bootstrap | `P6-F010`, `P6-F012` | P6R1 Recovery Gate Lead | P6R1 Evidence Lead | Independent Contract Reviewer | none |
| WP1 - State Correctness | `P6-F001`, `P6-F002` | P6R1 State Correctness Lead | P6R1 Evidence Lead | A0 | none |
| WP2 - Multi-source Acceptance Flow | `P6-F013` | P6R1 Multi-source Flow Lead | P6R1 Evidence Lead | A0 | none |
| WP3 - Interaction Evidence | `P6-F003`, `P6-F005` | P6R1 Interaction Evidence Lead | Independent Trace Evidence Reviewer | A0 | none |
| WP4 - Visual And Motion Review | `P6-F004`, `P6-F006`, `P6-F008` | P6R1 Visual And Motion Lead | P6R1 Evidence Lead | Independent Visual/Code Reviewer | Product Owner |
| WP5 - macOS App Delivery | `P6-F007`, `P6-F009`, `P6-F011` | P6R1 macOS Delivery Lead | P6R1 Evidence Lead | A0 | Product Owner |

Finding primary closure is unique. Other packages may list a finding only under
`supportingFindingIds`; they must not become the primary closure owner.

## Gate A - Runtime State Correctness

Packages: WP0, WP1.

Finding IDs: `P6-F001`, `P6-F002`, `P6-F010`, `P6-F012`.

Machine entry gate:

- P6-R1 contract is frozen.
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

Packages: WP2, WP3.

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

Packages: WP4, WP5.

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
  head; owner performs final product gate only after machine gates pass.

Stop condition:

- If any required machine gate fails, no owner-acceptance Human Gate is
  generated.

## Finding Closure Rules

A finding can close only when all are true:

1. Real runtime evidence exists.
2. A corresponding regression or mutation test exists.
3. A later independent external review does not reproduce the issue.

`partially_closed` is allowed only when the ledger lists exact closed
sub-issues and still-open sub-issues.

## Process Rules For The P6-R1 Contract

These are recommendations for the future contract. Do not persist them to
`AGENTS.md` until the owner approves this repaired postmortem.

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
