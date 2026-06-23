# P6 Multi-Worker Assessment

This is a retrospective only. It does not start P6-R1.

## What Worked

- Visible Worktree workers improved traceability compared with ad hoc
  subagents.
- Independent branches gave A0 fixed commits to integrate.
- A1/A2/A3/A4/A5 specialization helped cover inventory, shared frontend,
  host integration, parity tooling, and packaging in parallel.
- Worker handoffs from R4 onward recorded base/head/integration commits,
  changed files, tests, assumptions, blockers, and requested integration
  changes.
- Repair 6 reused existing visible workers instead of recreating them.

## What Failed

- The split was by technical layer, not by vertical user journey.
- A1/A2/A3/A4/A5 could all pass while a user-visible flow still failed.
- Evidence work was not fully independent from implementation results.
- A0 integration checks improved in R5/R6 but happened after several repair
  budgets had already been spent.
- Worker PASS was repeatedly easier to confuse with milestone PASS.
- No single worker owned complete flows such as Empty -> Loading -> Loaded ->
  Invalid -> Recovery.
- The final tracked loop ledger did not fully follow the final packet head
  after post-terminal cleanup commits.

## Subagent vs Worktree Worker

| Work type | Use visible Worktree worker | Use short-lived subagent | A0 serial only |
| --- | --- | --- | --- |
| Product runtime implementation | Yes, if owned files are disjoint | No | For final integration |
| Evidence helper implementation | Yes, if separated from product owner | Only read-only audit | Final evidence generation |
| Visual review | No | Yes, read-only | Owner/A0 decision |
| Contract or protocol audit | Sometimes | Yes | Final protocol write |
| Electron/App smoke | No | No | Yes |
| Packaged App validation | No | No | Yes |
| Final screenshots/motion capture | No | No | Yes |
| Final review packet/seal | No | No | Yes |

## Recommended Worker Shape For P6-R1

Use vertical work packages instead of technical layers:

| Work package | Lead implementation owner | Evidence owner | Integration verifier | Human gate owner |
| --- | --- | --- | --- | --- |
| WP0 Recovery Gate Bootstrap | A0 Recovery Gate Lead | Independent Read-only Gate Evidence Reviewer | Independent Contract And Code Reviewer | none |
| WP1 State Correctness | P6R1 State Correctness Lead | P6R1 Evidence Lead | A0 | none |
| WP2 Multi-source Acceptance Flow | P6R1 Multi-source Flow Lead | P6R1 Evidence Lead | A0 | none |
| WP3 Interaction Evidence | P6R1 Interaction Evidence Lead | Independent Trace Evidence Reviewer | A0 | none |
| WP4 Visual And Motion Review | P6R1 Visual And Motion Lead | P6R1 Evidence Lead | A0 | none |
| WP5 macOS App Delivery | P6R1 macOS Delivery Lead | P6R1 Evidence Lead | A0 | none |

Implementation owner must not be the only evidence owner or the integration
verifier for the same package. Gate C has one final Product Owner human gate
after all machine gates pass; Product Owner does not perform machine
integration verification.

## Parallelism Limit

- At most one lead implementation Worktree worker at once for P6-R1.
- One independent Evidence Worker or read-only Reviewer may run in parallel.
- A0 may run read-only subagents in parallel for review/audit.
- Heavy Electron, Web server, packaged App, screenshots, motion capture,
  `loop:validate`, Reviewer A/B, and seal remain serial.

## Integration Timing

A0 must run an integration check after every vertical slice:

1. Merge fixed worker commit.
2. Run targeted machine gate for that slice.
3. Generate or update slice evidence.
4. Update finding ledger status.
5. Only then start the dependent slice.

Do not wait for all workers to finish before the first end-to-end check.

## R3 Reviewer Notes Incorporated

R3 found:

- formal visible Worktree workers were introduced only after early ambiguity;
- Worker PASS and milestone PASS were repeatedly conflated;
- registry and terminal readiness drifted from the reviewed head;
- final P6 packet binds to `1977cbc`, but tracked loop ledger entries stop at
  earlier terminal evidence heads.

These are process findings, not product fixes.
