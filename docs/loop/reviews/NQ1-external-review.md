# NQ1 External Review

milestoneId: NQ1
externalOutcome: REPAIR_REQUIRED
reviewedHeadCommit: c745f1a67880bc5aabc2bc74265cdbf00cfac2ff
nextMilestone: NQ1-R1

## Summary

NQ1 completed useful engineering hardening, but the sealed handoff and several
hardening claims were not strong enough for final acceptance. Existing NQ1 work
must be preserved; the repair is additive.

## Findings

1. NQ1 started at 2026-06-20T20:39:40.564Z with hard deadline
   2026-06-21T04:09:40.564Z, but terminal state was reached at about 21:37,
   leaving planned time unused.
2. Reserve work packages A-E were not executed after the main queue completed
   early.
3. Async race coverage had only 7 scenarios; NQ1-R1 requires at least 100
   deterministic schedules with reproducible seed/schedule IDs.
4. Round-trip matrix had only 7 fixture-level cases; NQ1-R1 requires at least
   12 configuration cases and two Save As/reopen paths for supported cases.
5. Cleanup stress relied mostly on model/source checks; NQ1-R1 requires 30
   actual or semi-real lifecycle cycles with memory and resource trend data.
6. Performance baseline was helper-only and about 224 ms; NQ1-R1 requires a
   real operation matrix for resource counts 1, 3, 10, and 25.
7. Flake report labeled `electron-smoke` but actually ran
   `spike:svga-web:test`.
8. Acceptance evidence/upload filename used old head `3c2a8f`; final reviewed
   HEAD is `c745f1a`.
9. NQ1 upload ZIP `FINAL_RESPONSE.txt` contained a real local path/username.
10. NQ1 upload ZIP lacked `bundle-privacy-audit.json`.
11. Packet `MANIFEST.json` referenced `files/**`, but the upload ZIP lacked
    accurate matching entries and had no separate upload manifest.

## Repair Direction

Create NQ1-R1 as a bounded hardening completion and portable evidence repair
milestone. Do not reset, delete, rewrite, or hide existing NQ1 work.
