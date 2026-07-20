# P6-R1: Genuine Runtime, Interaction, Visual And macOS App Parity Completion

Milestone ID: P6-R1
Title: Genuine Runtime, Interaction, Visual And macOS App Parity Completion
Status: frozen

contractRevision: 1
supersedesContractRevision: 0
contractRevisionReason: external_contract_review_1

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

## Immutable P6 Recovery Baseline

- P6 terminal reviewed head: `1977cbce7ffc53d215391468aeb5b20daf816f77`
- accepted postmortem head: `d430c1937a6deeab3fc358151e24b4699e45f506`
- P6-R1 milestone start commit: `d430c1937a6deeab3fc358151e24b4699e45f506`
- Web source-of-truth commit:
  `dbab38fc7fc3cad09f6305775467422ded63318c`
- Web Preview source-of-truth files:
  - `tools/svga-player-preview/index.html`
  - `tools/svga-player-preview/styles.css`
  - `tools/svga-player-preview/main.js`
  - `tools/svga-player-preview/inspection-report-view.mjs`
  - `tools/svga-player-preview/server.mjs`
  - `tools/shared/product-tokens.css`
- parity inventory Markdown path:
  `docs/product/P6_WEB_FEATURE_INVENTORY.md`
- parity contract JSON path:
  `docs/product/P6_WEB_PARITY_CONTRACT.json`
- shared Product Shell path:
  `tools/shared/product-frontend/product-shell.html`
- shared Product App path:
  `tools/shared/product-frontend/product-app.mjs`
- shared core CSS path:
  `tools/shared/product-frontend/product-styles.css`
- state-machine path:
  `tools/p6/runtime-scenarios/state-evidence.mjs`
- motion-definition path:
  `docs/product/P6_WEB_PARITY_CONTRACT.json`
- frozen baseline snapshot:
  `docs/loop/contracts/P6-R1_BASELINE.json`
- archived revision 0 contract:
  `docs/loop/contracts/P6-R1-contract-v0.md`

Baseline item counts from `docs/product/P6_WEB_PARITY_CONTRACT.json` are
immutable minimums for P6-R1:

| item set | required count |
| --- | ---: |
| regions | 20 |
| features | 33 |
| interactions | 10 |
| states | 22 |
| motions | 9 |

P6-R1 may add true omissions discovered later. It must not delete, shrink,
make optional, or make unreachable any baseline item.

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
regression or mutation tests, and independent integration review.

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

## Formal Acceptance Criteria

The following IDs are frozen for P6-R1. They must not be renamed, removed,
softened, or treated as optional during implementation.

| ID | criterion | required evidence |
| --- | --- | --- |
| P6-R1-AC-01 | Contract Lineage And P6 Archive | P6 terminal head, accepted postmortem head, revision lineage, v0 archive, and revision 1 package are present and hash-bound. |
| P6-R1-AC-02 | Immutable Web Source Of Truth | Required Web parity inventory, item IDs, counts, source files, and source hashes are preserved or increased only by true omissions. |
| P6-R1-AC-03 | Finding Ledger Integrity | P6-F001 through P6-F013 have primary owners, resolution stage, evidence refs, and no silent closure. |
| P6-R1-AC-04 | Recovery Gate Bootstrap | WP0 defines failure-first gates, machine/human split, final-head binding, and negative-test contracts before product changes. |
| P6-R1-AC-05 | Runtime State Correctness | Empty, Loading, Loaded, Invalid, and Recovery states are visibly and semantically distinct with stale state cleared. |
| P6-R1-AC-06 | Multi-source Acceptance | Second SVGA, reference media, latest artifact, synchronization, and cleanup work end to end. |
| P6-R1-AC-07 | Real Interaction Evidence | Interactions include before state, real DOM/native action, after state, focus/result, and mutation protection. |
| P6-R1-AC-08 | Comparable Visual Machine Evidence | Visual comparison uses same state, viewport, fixture, and context; impossible or zero-pixel comparisons fail. |
| P6-R1-AC-09 | Genuine Motion Evidence | Motion evidence proves trigger, start/mid/end, geometry/style delta, and reduced-motion behavior where applicable. |
| P6-R1-AC-10 | Independent Product Review | Product visual/motion review is independent from implementation and cannot be replaced by generic packet PASS. |
| P6-R1-AC-11 | Visible Normal macOS App | Normal macOS App launch and representative workflows are proven outside proof-only paths. |
| P6-R1-AC-12 | Full P6 Regression | Complete P6 required inventory regression passes on the final integration head. |
| P6-R1-AC-13 | Final-head, Privacy And Portable Handoff | Review ZIP, App ZIP when present, manifest, privacy audit, and owner-visible paths bind to the same final head. |
| P6-R1-AC-14 | Independent Validation And Seal | Two loop validations, Reviewer A, Reviewer B, post-seal verifier, and source workspace clean state are recorded. |
| P6-R1-AC-15 | Scope Discipline | No Phase 2, editor expansion, format conversion, export workbench, dependency expansion, or production release work starts. |

## Work Package Order

P6-R1 executes strictly in this order:

1. WP0
2. WP0 Integration Checkpoint
3. WP1
4. Gate A
5. WP2
6. WP2 Integration Checkpoint
7. WP3
8. Gate B
9. WP4
10. WP4 Integration Checkpoint
11. WP5
12. Gate C
13. Final Validation
14. Reviewer A
15. Reviewer B
16. Owner Human Gate

Rules:

1. The previous work package must pass before the next lead package starts.
2. At most one Lead Implementation Worker may run at a time.
3. One independent Evidence Worker or read-only Reviewer may run in parallel.
4. Web server, Electron, App, screenshot, motion, loop validation, and seal
   runs are A0-serial.
5. P6-R1 must not be re-sliced by technical layer for throughput.

## Work Packages

Each work package has one Lead Implementation Owner. Other layers may be
requested through `requestedIntegrationChange`, but they do not become
co-leads. Product Owner is never the machine Integration Verifier.

| Work Package | findingIds | Lead Implementation Owner | Evidence Owner | Integration Verifier | Human Gate Owner |
| --- | --- | --- | --- | --- | --- |
| WP0 - Recovery Gate Bootstrap | `P6-F010`, `P6-F012` | A0 Recovery Gate Lead | Independent Read-only Gate Evidence Reviewer | Independent Contract And Code Reviewer | none |
| WP1 - State Correctness | `P6-F001`, `P6-F002` | P6R1 State Correctness Lead | P6R1 Evidence Lead | A0 | none |
| WP2 - Multi-source Acceptance Flow | `P6-F013` | P6R1 Multi-source Flow Lead | P6R1 Evidence Lead | A0 | none |
| WP3 - Interaction Evidence | `P6-F003`, `P6-F005` | P6R1 Interaction Evidence Lead | Independent Trace Evidence Reviewer | A0 | none |
| WP4 - Visual And Motion Review | `P6-F004`, `P6-F006`, `P6-F008` | P6R1 Visual And Motion Lead | P6R1 Evidence Lead | A0 | none |
| WP5 - macOS App Delivery | `P6-F007`, `P6-F009`, `P6-F011` | P6R1 macOS Delivery Lead | P6R1 Evidence Lead | A0 | none |

Gate C has the only final Human Gate Owner: Product Owner.

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
- formal Worker creation or restoration;
- product evidence generation beyond contract checks.

WP0 is A0-serial. A0 may produce the WP0 implementation but must not approve
its own evidence. WP0 must pass before WP1 Worker creation or restoration.

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

WP4 does not create a separate Product Owner gate.

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

WP5 does not create a separate Product Owner gate.

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

- P6-R1 contract revision 1 external review passed.
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

terminalCheck:

- WP0 failure-first validation passes.
- WP1 failure-first baseline fails first, then passes after repair.
- State runtime evidence passes.
- Independent integration review passes.
- Finding Ledger records current evidence and resolution stage.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0
stopCondition: Gate A failure blocks WP2-WP5.
allowedNextPackages: WP2 only after Gate A passes.

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
- Interaction trace fails when `stateBefore`, real action, `stateAfter`, focus,
  or visible result is missing.

terminalCheck:

- Gate A passed.
- WP2/WP3 failure-first baselines fail first.
- Second/reference/latest real runtime flows pass.
- Interaction traces include real before/action/after/focus/result.
- Mutation tests pass.
- Independent integration review passes.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0
stopCondition: Gate B failure blocks WP4-WP5.
allowedNextPackages: WP4 only after Gate B passes.

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

terminalCheck:

- Gate B passed.
- Visual/motion failure-first baseline fails first.
- Comparable visual machine evidence passes.
- Genuine motion evidence passes.
- Normal App evidence passes.
- Required Independent Evidence Reviewers pass:
  - Independent Visual Product Reviewer
  - Independent Code/Security Reviewer
- Owner materials are complete.

evidenceOwner: P6R1 Evidence Lead
integrationVerifier: A0
stopCondition: Gate C failure blocks owner-acceptance packet generation.
allowedNextPackages: none

## P6-R1 Final Validation

1. All `P6-R1-AC-01` through `P6-R1-AC-15` have explicit evidence mapping.
2. Gate A, Gate B, and Gate C machine checks pass.
3. Complete P6 required inventory regression passes.
4. `git --literal-pathspecs diff --check <base>..<final-head>` passes.
5. `npm run loop:validate` passes twice at final head.
6. Reviewer A independently returns PASS.
7. Reviewer B product categories all return PASS.
8. Post-seal verifier passes.
9. Review ZIP and App ZIP pass manifest and privacy verification.
10. Source workspace is clean.
11. Only then may the final Owner Human Gate be requested.

## Completion Gates

P6-R1 is not complete until all are true:

- contractRevision 1 passed external contract review.
- WP0, WP1, WP2, WP3, WP4, and WP5 completed in order.
- Gate A, Gate B, and Gate C all passed.
- `P6-F001` through `P6-F013` all reached
  `integrated_resolved_pending_external_review` or, after final external
  review, `externally_confirmed_closed`.
- P6 baseline required items have not decreased.
- All machine ACs pass.
- Reviewer A and Reviewer B pass.
- Normal App proof passes.
- Final-head binding passes.
- Privacy and manifest checks pass.
- Owner Review ZIP and App ZIP actually exist when App ZIP is in scope.
- Phase 2 is not started.
- Final packet is `HUMAN_REQUIRED`, waiting for the single Product Owner Gate.

## Finding Resolution Stages

Finding formal closure still requires:

1. real runtime evidence;
2. regression or mutation test;
3. later independent external review that does not reproduce the issue.

`resolutionStage` values:

- `unresolved`
- `implementing`
- `machine_resolved_pending_integration`
- `integrated_resolved_pending_external_review`
- `externally_confirmed_closed`
- `regressed`

Rules:

1. `currentStatus` may remain `open` before external confirmation.
2. Gate machine exit uses `integrated_resolved_pending_external_review`.
3. Internal Reviewers must not mark findings `closed`.
4. Final P6-R1 packet must distinguish machine resolved, pending external
   confirmation, and externally closed.
5. Owner final acceptance and external review must both pass before
   `externally_confirmed_closed` is written.
6. WP0 must define and validate these fields in the Finding Ledger.

## Repair Budget Semantics

- Gate-internal Implement / Validate / Review / Repair loops do not increment
  `repairRound`.
- Gate-local loops use `gateCycle` or `workPackageCycle`.
- Only a P6-R1 terminal packet that receives formal external review result
  `REPAIR_REQUIRED` may create `repair-1`, `repair-2`, and so on.
- `maxRepairRounds=4` is unchanged.
- Protocol, packaging, or internal test failures must not consume external
  repair budget.
- Required Gate failures continue inside the current Gate or stop at the
  stopCondition. They do not enter Owner Human Gate.

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

Product Owner judges only, once at Gate C final Owner Human Gate:

- Web/Desktop overall visual and use experience;
- motion feel;
- daily workflow usability;
- macOS App double-click experience.

Human Gate must not replace machine behavior checks.

## Contract Review Gate

Current state: `contract_frozen`.

Next action: `external_contract_review`.

WP0 is not started. No formal implementation Worker is running. Phase 2 is not
started. P6-R1 implementation may start only after contract revision 1 passes
external contract review and the owner authorizes WP0.
