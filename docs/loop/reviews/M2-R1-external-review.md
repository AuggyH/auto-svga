# M2-R1 External Review

externalOutcome: REPAIR_REQUIRED
reviewedHeadCommit: `df49afb8e19097d1228f1a40091835984da1022a`
recordedAt: `2026-06-20`

## Blocking Findings

1. `reviewer.toml` has a TOML syntax defect in the `must_check` array.
2. Terminal state and history are inconsistent: the generated packet reports `PASS`, but loop state/history still indicate work in progress.
3. Sensitive patch leakage remains possible because raw patch and snapshots are not fully gated by a safe path set before generation.
4. Reviewer verdict parsing is unstructured and can be affected by free text.
5. Validation and reviewer evidence are not strongly bound to the reviewed HEAD.
6. `HUMAN_REQUIRED` response can point to a placeholder instead of asking a concrete question.
7. Diff-check coverage uses the wrong range and can miss committed whitespace defects.

## Required Repair Direction

M2-R2 must harden terminal handoff trust before any product milestone continues.
The repair must preserve product runtime, SVGA behavior, Web preview behavior,
Electron prototype boundaries, examples, schemas, templates, and dependencies.
