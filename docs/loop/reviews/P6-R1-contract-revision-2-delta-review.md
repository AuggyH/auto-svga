# P6-R1 Contract Revision 2 Delta Review

reviewType: `delta_only_contract_review`
baseHead: `1323e8872ee569c0604bc4e33fac73e81a07f7c7`
contractRevision: 2
repairRoundConsumed: false
wp0Started: false
phase2Started: false

## Delta Scope

This revision repairs only execution blockers in the frozen P6-R1 contract.
It does not start WP0, add product implementation, change tests, change tools,
change dependencies, change packaging implementation, or start Phase 2.

## Execution Blocker Mapping

1. Final Validation / Reviewer / Seal cycle
   - Fixed by making Final Validation an A0 machine validation step.
   - Reviewer A, Reviewer B, final seal, post-seal verification, terminal
     `HUMAN_REQUIRED`, and Product Owner Gate now run in that order.
   - No step requires evidence from a later step.

2. Gate and Work Package boundary ambiguity
   - Fixed by defining work packages as implementation/evidence producers.
   - Gate A validates completed WP0/WP1.
   - Gate B validates completed WP2/WP3.
   - Gate C validates completed WP4/WP5.
   - Work packages are not simultaneously before and inside the same Gate.

3. Baseline hash ambiguity
   - Fixed by upgrading `P6-R1_BASELINE.json` to schema version 2.
   - `webSourceOfTruthHashes` are immutable unless the owner approves a new
     Web source-of-truth revision.
   - `milestoneStartReferenceHashes` are record-only and may change inside
     authorized work packages with evidence and final-head binding.

## State Semantics

- Contract review repair increments `contractRevision`, not `repairRound`.
- Gate/work-package machine failure returns to the affected package or Gate.
- Product Owner Human Gate rejection returns to the affected Gate.
- Final independent product external review `REPAIR_REQUIRED` increments
  `repairRound`.

## Required End State

- `contractRevision: 2`
- `repairRound: 0`
- `wp0Started: false`
- `phase2Started: false`
- `Next Action: external_contract_review`
