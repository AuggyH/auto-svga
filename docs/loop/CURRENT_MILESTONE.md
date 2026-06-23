# P6-R1: Genuine Runtime, Interaction, Visual And macOS App Parity Completion

Milestone ID: P6-R1
Title: Genuine Runtime, Interaction, Visual And macOS App Parity Completion
Status: frozen

milestoneStartCommit: `d430c1937a6deeab3fc358151e24b4699e45f506`
Branch: `agent/codex/p6-r1-contract`
Previous milestone: `docs/loop/milestones/P6-web-preview-full-parity.md`
Previous milestone outcome: `NOT_ACCEPTED`
Previous engineering outcome: `REPAIR_BUDGET_EXHAUSTED`

maxRepairRounds: 4
maxConsecutiveNoProgressRounds: 1

repairRound: 0
phase2Started: false
wp0Started: false

## Objective

Close the legacy P6 findings through failure-first, vertical user-flow work
without changing the Web Preview source of truth, reducing required inventory,
or starting Phase 2 functionality.

P6-R1 must complete trustworthy Web/Desktop function, state, interaction,
motion, and macOS App evidence for the accepted P6 recovery plan.

## Primary Root Cause

P6 was implemented and verified by technical layers rather than vertical user
flows, while pass-oriented evidence and late integration allowed incomplete
runtime behavior to reach terminal handoff.

## Why Prior Repairs Failed

Prior repairs often fixed the latest report symptom or evidence format without
first establishing a failure-first end-to-end test and a single owner for the
complete user journey.

## Success Stop Condition

All findings assigned to the current Gate have real runtime evidence,
regression or mutation tests, and an independent integration review.

## Failure Stop Condition

Any required Gate check remains failed or untrusted; dependent Gates do not
start and no owner-acceptance packet is generated.

## Product Boundary

Allowed:

- Finding Ledger update rules.
- Failure-first gate taxonomy.
- Machine vs human gate schema.
- Reviewer product schema.
- Final-head binding rules.
- Minimal negative-test contracts.
- Runtime state correctness repair after Gate A begins.
- Multi-source acceptance repair after Gate B begins.
- Interaction, visual, motion, and macOS App delivery repair only after their
  dependent Gates allow them.

Prohibited:

- starting WP0 before P6-R1 contract review passes;
- modifying product route or reducing Web parity requirements;
- deleting required inventory or changing required items to optional;
- starting SVGA asset optimization;
- restoring P3-P5 default editing UI;
- adding editor features;
- adding third-party dependencies;
- using public network, credentials, production services, real user assets, AI,
  external models, multimodal services, or network analysis;
- signing, notarizing, releasing, publishing, deploying, pushing, or merging;
- letting evidence generators produce Reviewer verdicts;
- entering owner product acceptance while a required machine Gate is failed or
  untrusted.

## Work Packages

Each work package has one Lead Implementation Owner. Other layers may be
requested through `requestedIntegrationChange`, but they do not become
co-leads. Product Owner is never the machine Integration Verifier.

| Work Package | findingIds | Lead Implementation Owner | Evidence Owner | Integration Verifier | Human Gate Owner |
| --- | --- | --- | --- | --- | --- |
| WP0 - Recovery Gate Bootstrap | `P6-F010`, `P6-F012` | P6R1 Recovery Gate Lead | P6R1 Evidence Lead | Independent Contract Reviewer | none |
| WP1 - State Correctness | `P6-F001`, `P6-F002` | P6R1 State Correctness Lead | P6R1 Evidence Lead | A0 | none |
| WP2 - Multi-source Acceptance Flow | `P6-F013` | P6R1 Multi-source Flow Lead | P6R1 Evidence Lead | A0 | none |
| WP3 - Interaction Evidence | `P6-F003`, `P6-F005` | P6R1 Interaction Evidence Lead | Independent Trace Evidence Reviewer | A0 | none |
| WP4 - Visual And Motion Review | `P6-F004`, `P6-F006`, `P6-F008` | P6R1 Visual And Motion Lead | P6R1 Evidence Lead | Independent Visual/Code Reviewer | Product Owner |
| WP5 - macOS App Delivery | `P6-F007`, `P6-F009`, `P6-F011` | P6R1 macOS Delivery Lead | P6R1 Evidence Lead | A0 | Product Owner |

## WP0 - Recovery Gate Bootstrap

Finding IDs:

- `P6-F010`
- `P6-F012`

Allowed:

- Finding Ledger running rules.
- Failure-first gate taxonomy.
- Machine vs human gate schema.
- Reviewer product schema.
- Final-head binding rule.
- Minimal negative-test contract.

Prohibited:

- product runtime changes;
- Web or Electron UI changes;
- worker creation;
- product evidence generation beyond contract checks.

## WP1 - State Correctness

Finding IDs:

- `P6-F001`
- `P6-F002`

User flow:

`Empty -> Loading -> Loaded -> Invalid -> Recovery`

## WP2 - Multi-source Acceptance Flow

Finding IDs:

- `P6-F013`

User flow:

- second SVGA
- reference media
- latest artifact
- synchronized playback
- cleanup

## WP3 - Interaction Evidence

Finding IDs:

- `P6-F003`
- `P6-F005`

User flow:

`before -> real DOM/native action -> after -> visible result`

## WP4 - Visual And Motion Review

Finding IDs:

- `P6-F004`
- `P6-F006`
- `P6-F008`

Scope:

- same state
- same viewport
- same fixture
- geometry and computed-style machine proof
- real motion trigger
- independent product visual Reviewer
- Owner visual gate

## WP5 - macOS App Delivery

Finding IDs:

- `P6-F007`
- `P6-F009`
- `P6-F011`

Scope:

- visible normal launch
- File > Open
- representative real App workflows
- App ZIP
- final-head binding
- privacy
- owner-visible handoff

## Gate A - Runtime State Correctness

Packages:

- WP0
- WP1

Finding IDs:

- `P6-F001`
- `P6-F002`
- `P6-F010`
- `P6-F012`

machineEntryGate:

- P6-R1 contract review passed.
- WP0 is authorized to start.
- Finding Ledger update format is defined.
- Machine vs human gate taxonomy is defined.
- Reviewer product schema is defined.
- Final-head binding rule is defined.

requiredFailureFirstTests:

- Loading vs Empty fails when Loading shows Empty CTA or indistinct geometry.
- Invalid-after-loaded fails when stale canvas, player, metadata, report, ready
  status, or parser state remains visible.
- Gate taxonomy fails when machine failure enters owner-acceptance Human Gate.

machineExitGate:

- Loading and Empty are visibly and semantically distinct.
- Invalid clears stale state.
- Recovery after invalid file is proven.
- Failure-first tests pass.
- Finding Ledger records current evidence and status.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0
stopCondition: Gate A failure blocks WP2-WP5.
allowedNextPackages: WP2, WP3 only after Gate A passes.

## Gate B - Multi-source And Interaction Correctness

Packages:

- WP2
- WP3

Finding IDs:

- `P6-F013`
- `P6-F003`
- `P6-F005`

machineEntryGate:

- Gate A passed on the integration head.
- WP2 and WP3 failure-first tests exist and fail on the current baseline.

requiredFailureFirstTests:

- Second SVGA proof fails when bytes, decode, playback, sync, or cleanup is
  missing.
- Reference media proof fails when load, playback, sync, or cleanup is missing.
- Latest artifact proof fails when scan, select, load, playback, or cleanup is
  missing.
- Interaction trace fails when `stateBefore`, real action, `stateAfter`, or
  visible result is missing.

machineExitGate:

- Second SVGA works end to end.
- Reference media works end to end.
- Latest artifact works end to end.
- Web/Desktop interaction trace is complete.
- Mutation tests catch skipped action or mismatched context.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0
stopCondition: Gate B failure blocks WP4-WP5.
allowedNextPackages: WP4, WP5 only after Gate B passes.

## Gate C - Visual, Motion And App Delivery

Packages:

- WP4
- WP5

Finding IDs:

- `P6-F004`
- `P6-F006`
- `P6-F007`
- `P6-F008`
- `P6-F009`
- `P6-F011`

machineEntryGate:

- Gate B passed on the integration head.
- Same state, viewport, fixture, motion trigger, and media context are required
  before comparison artifacts are generated.

requiredFailureFirstTests:

- Responsive comparison fails with inconsistent viewport or `comparedPixels=0`.
- Normal-motion proof fails when expected start/mid/end frames are identical.
- Reviewer generic verdict fails if category product verdicts require review.
- Normal App proof fails when launched through proof/smoke-only path.
- Handoff fails when final head, App ZIP, manifest, privacy audit, and review
  packet do not bind to the same source head.

machineExitGate:

- Same-state, same-viewport, same-fixture visual evidence exists.
- Motion evidence proves trigger and geometry/style deltas where expected.
- Independent visual/product Reviewer returns non-contradictory verdicts.
- Normal macOS App starts visibly and completes representative workflow.
- App ZIP and owner-visible handoff are final-head bound and privacy clean.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0 or Independent Visual/Code Reviewer as assigned
stopCondition: Gate C failure blocks owner-acceptance packet generation.
allowedNextPackages: none

## Failure-first Rules

Every work package must:

1. read target findings from `docs/retrospectives/P6_FINDING_LEDGER.json`;
2. create a test or validation scenario that fails on the current baseline;
3. record the failure reason;
4. have the Evidence Owner confirm the failure maps to the finding;
5. only then allow the Lead Implementation Owner to repair.

Forbidden:

- modify product first and add a guaranteed-pass test later;
- pass by changing report fields;
- pass by loosening thresholds;
- pass by deleting or renaming findings;
- use one generic screenshot to prove multiple flows.

## Machine Gate vs Human Gate

Machine must prove:

- file actually loaded;
- state before/after;
- stale state cleared;
- real interaction triggered;
- second/reference/latest workflows work;
- motion target, trigger, and parameters exist;
- DOM, geometry, and computed styles;
- ordinary App startup and exit;
- security, cleanup, and privacy;
- final-head binding.

Machine must not claim:

- pixel-perfect quality;
- motion taste;
- overall product acceptance.

Product Owner judges only:

- Web/Desktop overall visual and use experience;
- motion feel;
- daily workflow usability;
- macOS App double-click experience.

Human Gate must not replace machine behavior checks.

## Contract Review Gate

Current state: `contract_frozen`.

Next action: `external_contract_review`.

WP0 is not started. No formal implementation Worker is running. Phase 2 is not
started. P6-R1 implementation may start only after this frozen contract passes
external contract review and the owner authorizes WP0.
