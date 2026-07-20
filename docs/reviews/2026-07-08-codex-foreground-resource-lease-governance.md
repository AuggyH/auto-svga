# Review: Foreground Resource Lease Governance

## Summary

- Expanded foreground coordination from Auto SVGA client instances to all
  shared macOS foreground resources.
- Defined one global active foreground input lease for keyboard, mouse, menu
  bar, modal dialog, file dialog, app focus, and clipboard control.
- Added explicit coverage for Finder, Open/Save dialogs, After Effects, browser
  windows, system prompts, Dock/Launchpad, screenshots, display/workspace, and
  clipboard-changing operations.
- Updated AEB planning so After Effects foreground work cannot interrupt QA,
  UI/UX, short-term implementation, or release packaging work.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Pre-existing unrelated dirty files were present before this task and were not
  staged here.

## Changed Files

- `AGENTS.md`
- `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`
- `codex-skills/auto-svga-client-ready/SKILL.md`
- `codex-skills/auto-svga-ui-stability/SKILL.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Multi-process foreground conflict: addressed as a global foreground input
  lease, not only a client-window rule.
- Finder/Open dialog operations: covered as serialized shared resources.
- AEB / After Effects operations: covered, including AE app/version, project,
  composition, Render Queue, script/plugin dialogs, and handoff evidence.
- Clipboard collisions: covered as global mutable state and serialized when
  changed.
- Deadlock prevention: leases must stay short, cannot be held during long
  background waits, and ambiguous foreground identity must wait, switch to
  non-foreground evidence, or route for coordination.

## Verification

- `git diff --check` passed for staged files.
- Staged retrospective ledger parses as JSONL.
- No production image/video/SVGA/design assets were staged.
- Runtime tests were not run because this was a documentation and process
  governance update.

## Risks And Next Steps

- This is still a process protocol. If contention continues, a future tooling
  task should add a small foreground lease helper or lock record so workers can
  check active leases mechanically.

## Project Retrospective

- The scarce resource is not only the Auto SVGA window. It is the global macOS
  foreground input channel: focus, keyboard, mouse, dialogs, menus, and
  clipboard. Treating this as one lease avoids A/B/C focus stealing and
  hard-to-debug automation failures.

## Token Usage

- Exact Codex token count unavailable in this session.
