# Repair Health Protocol

Status: active after owner approval of the P6 postmortem repair.

Scope: this protocol is intentionally small. It governs repair-loop health,
finding recurrence, and successor repair milestone design. It does not replace
`docs/loop/AUTONOMOUS_PROTOCOL.md`, `docs/loop/HANDOFF_CONTRACT.md`, the
Multi-Worker Protocol, or Agent Routing Governance.

## Rules

1. Every external review must update the active Finding Ledger.
2. The same finding in two consecutive review rounds requires a root-cause
   review before another repair.
3. The same finding in three review rounds pauses implementation and requires
   a retrospective.
4. Exhausted repair budget requires a postmortem before a successor repair
   milestone.
5. A required machine-gate failure forbids an owner-acceptance Human Gate.
6. Every vertical work package has one Lead Implementation Owner, a separate
   Evidence Owner, and an A0 or independent Integration Verifier.
7. A repair contract must state its root-cause hypothesis, why the prior fix
   failed, a failure-first test, success stop condition, and failure stop
   condition.

## Finding Ledger Update

After each external review, update the active Finding Ledger before another
repair begins. The update must record:

- finding id
- reviewed round
- reviewed head
- external outcome
- current status
- latest evidence
- attempted fix
- why the fix did or did not close the finding
- primary recovery work package when a successor milestone is designed

Do not mark a finding closed unless all are true:

1. real runtime evidence exists;
2. a corresponding regression or mutation test exists;
3. a later independent external review does not reproduce the finding.

## Recurrence Stops

Two consecutive appearances of the same finding require a written root-cause
review before another repair prompt.

Three appearances of the same finding stop implementation and require a
retrospective.

When repair budget is exhausted, do not create another repair round. Complete a
postmortem and owner-approved successor contract first.

## Gate Separation

Machine gates prove behavior and evidence. Human gates judge product
experience.

If a required machine gate fails or is untrusted, do not produce an
owner-acceptance Human Gate. Use technical review language instead.

The Product Owner may own visual or App experience acceptance, but the Product
Owner is not the machine Integration Verifier.

## Vertical Work Package Ownership

Each vertical work package has exactly one Lead Implementation Owner.

The Lead Implementation Owner may request changes from other layers through
`requestedIntegrationChange`, but those layers do not become co-leads.

Evidence Owner and Integration Verifier must be separate from the Lead
Implementation Owner. Integration Verifier must be A0 or an independent
machine/code reviewer.

## Repair Contract Minimum

Every repair contract must include:

1. root-cause hypothesis;
2. why the prior fix failed;
3. failure-first test or validation scenario;
4. success stop condition;
5. failure stop condition.

Do not begin implementation until these fields are present.
