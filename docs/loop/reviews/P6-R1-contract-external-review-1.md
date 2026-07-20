# P6-R1 Contract External Review 1

externalOutcome: `CONTRACT_REPAIR_REQUIRED`
reviewedHeadCommit: `7fa2a7b34fde5dc48b185239c57daadef184f7b7`
reviewedContract: `docs/loop/CURRENT_MILESTONE.md`
reviewDate: 2026-06-23

## Blocking Findings

1. Contract lacks formal P6-R1 Acceptance Criteria IDs.
2. Contract lacks complete Required Validation and Completion Gates.
3. Contract lacks exact Web parity inventory files, item set, counts, and
   hashes.
4. Gate Work Package order could be interpreted as parallel.
5. WP0 Lead conflicts with "no Worker creation".
6. Finding closure rule conflicts with milestone-internal done state.
7. WP4/WP5 could create two Product Owner Human Gates.
8. Gate C Integration Verifier wording is not unique.
9. Recovery Proposal still says P6-R1 is not frozen.
10. Contract package lacks lifecycle files and exact source diff.
11. `repairRound` vs Gate-internal repair loops is not defined.

## Required Repair Scope

- Archive the reviewed contract byte-exact as
  `docs/loop/contracts/P6-R1-contract-v0.md`.
- Freeze `docs/loop/CURRENT_MILESTONE.md` as contract revision 1.
- Add immutable P6 recovery baseline metadata and
  `docs/loop/contracts/P6-R1_BASELINE.json`.
- Add formal `P6-R1-AC-01` through `P6-R1-AC-15`.
- Add Required Validation, Completion Gates, strict WP order, WP0 ownership,
  Finding resolution stages, single Gate C Product Owner Gate, Gate C verifier,
  and repair budget semantics.
- Update recovery documents that still describe P6-R1 as not frozen.
- Generate a new owner-visible contract review ZIP with exact diff, lifecycle
  files, manifest, privacy audit, and no product/test/tool/dependency changes.

## Non-scope

- WP0 remains not started.
- Phase 2 remains not started.
- No formal implementation Worker is created or restored.
- No product runtime, Web/Electron UI, tests, tools, package, dependency, App,
  or parity implementation changes are allowed.
