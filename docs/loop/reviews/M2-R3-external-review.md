# M2-R3 External Review

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: `afdb0d3d39d3743ce6c3efc5c5b722e2c26f817c`

## Blocking Findings

1. `HUMAN_REQUIRED` only redacts `changes.patch`; safe-path tracked,
   committed, staged, or untracked files can still leak full secret content
   through `files/` snapshots.
2. `loop-budget-check` verifies only `repairRound`; it still trusts
   `LOOP_STATE.consecutiveNoProgressRounds` and cannot detect historical
   under-reporting.
3. `nextRepairAllowed` uses `<=` for no-progress budget and can allow another
   repair when the frozen no-progress limit has already been reached.
4. `LOOP_STATE.md` has machine `Next Action: external_review`, but its human
   next-action section still asks the agent to generate a candidate, run review,
   and seal a packet.
5. Packet output paths must explicitly validate the milestone ID and final
   path containment under `.artifacts/loop-handoff` before any recursive
   removal or output creation.

## Repair Scope

This review requires loop infrastructure repair only. It does not require any
product judgment, product runtime change, SVGA exporter change, Web Player
change, Electron boundary change, dependency change, or asset change.
