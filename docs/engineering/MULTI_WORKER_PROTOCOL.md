# Multi-Worker Protocol

Date: 2026-06-22

This protocol applies to P6 and every later multi-worker milestone.

## Hard Rules

1. Formal implementation workers must be visible Codex project Worktree threads.
2. Background subagents are only allowed for:
   - read-only source exploration
   - temporary audits
   - Reviewer A
   - Reviewer B
   - short-lived issue localization
3. Subagents must not replace long-lived implementation workers such as Shared Frontend, Electron Host, Parity Evidence, or Packaging.
4. Before creating or resuming a worker, A0 must list project threads, identify existing workers, reuse matching threads, and avoid duplicates.
5. A0 must verify each worker thread is a worktree thread and owns an independent branch.
6. A0 is the only integration coordinator and global lifecycle writer.
7. Worker PASS does not imply milestone PASS.
8. Heavy Electron, Web server, packaged-App, final screenshot, final motion capture, loop validation, reviewer, and seal steps run serially under A0.
9. App and Electron debugging should run hidden, background, or non-foreground whenever possible. Do not pop windows over the owner unless manual visual acceptance explicitly requires it.

## Coordinator-Owned Files

Workers must not edit these files unless A0 explicitly assigns that edit to itself:

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- final handoff inputs

## Required Worker Discovery

Before any worker create or resume action, A0 must:

1. List recent project threads with the Codex thread list tool.
2. Search for the milestone and worker id.
3. Record any matching visible thread id.
4. Check the thread cwd is under a worktree path.
5. Check the worktree branch.
6. Reuse the existing thread when the role matches.
7. Create a new worktree thread only when no matching worker exists.

## Worker Context Packet

Every formal worker must receive a complete context packet before implementation:

- product objective
- frozen contract paths
- current integration base commit
- assigned branch
- owned files or directories
- prohibited files
- dependencies and ordering constraints
- acceptance criteria owned by the worker
- required tests
- required handoff format
- rule that the worker must not merge or modify terminal state

## Worker Handoff

Each worker must commit all worker changes, keep its workspace clean, and report:

- `baseCommit`
- `headCommit`
- `commits`
- `changedFiles`
- `tests`
- `assumptions`
- `blockers`
- `requestedIntegrationChanges`

Workers must not merge, write terminal state, generate final milestone packets, or claim milestone acceptance.

## Integration Rules

A0 must integrate one dependency layer at a time and run targeted checks after each layer. A0 must not wait until all workers finish before the first integration test.

A0 must not trust worker self-reported PASS. On a fixed integration HEAD, A0 must re-check:

- actual product behavior
- acceptance criteria
- evidence generation logic
- negative and mutation tests
- hard-coded PASS risks
- real user path leakage
- unapproved differences

## Evidence Ownership

Every milestone acceptance criterion must identify:

- implementation owner
- evidence owner
- integration verifier

The implementer must not be the final verifier for that criterion.

## Subagent Boundary

Subagents may produce findings or reviewer reports. They must not:

- own a long-lived branch
- own implementation scope
- replace visible Worktree threads
- merge worker results
- update loop terminal state
- generate final handoff packets

## Failure Handling

If a worker is detached, dirty, on the wrong branch, or has modified protected files:

1. Stop the worker.
2. Record the exact thread id, cwd, branch, head, and dirty paths.
3. Let A0 repair or reset the worktree.
4. Do not create a duplicate worker to hide the bad state.
