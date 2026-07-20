# Review: Client Baseline And Concurrency Governance

## Summary

- Established the short-term macOS app at
  `/Users/huangtengxin/Applications/Auto SVGA.app` as the current
  owner-visible client baseline for QA and version progression.
- Clarified that historical Workbench v1, Web Preview, dev Electron windows,
  `.artifacts` packages, and Windows clients are not current-stage standards
  unless the Product Owner explicitly names them.
- Added a desktop-client coordination protocol for foreground leases,
  concurrent client instance identity, serialization, and baseline-drift gates.
- Updated repo-local skills so future worker processes see the same baseline
  and foreground coordination rules at task start.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Pre-existing unrelated dirty files were present before this task and were not
  staged here.

## Changed Files

- `AGENTS.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`
- `codex-skills/auto-svga-client-ready/SKILL.md`
- `codex-skills/auto-svga-ui-stability/SKILL.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Multi-process foreground conflict: addressed through foreground lease rules,
  process/window/path identity checks, second-display preference, and
  serialization when identity is ambiguous.
- Multiple client instances: allowed only when each worker records distinct app
  path, PID/process identity, window, display/workspace, task context, and
  evidence label.
- Current client consensus: `~/Applications/Auto SVGA.app` is the current
  owner-used short-term macOS client baseline.
- Historical surface exclusion: Workbench v1, Web Preview, dev Electron,
  `.artifacts`, and Windows are supplemental or historical unless explicitly
  requested.
- Baseline drift: promotion must stop if the installed owner app appears to
  contain behavior absent from source, docs, reviews, manifests, or evidence.

## Verification

- `git diff --check` passed for staged files.
- Staged retrospective ledger parses as JSONL.
- No production image/video/SVGA/design assets were staged.
- Runtime tests were not run because this was a documentation and process
  governance update.

## Risks And Next Steps

- This is a process contract, not an executable lock manager. A future release
  or tooling task may add a small lease/probe script if manual review/handoff
  records are not enough.
- QA and release lanes should continue integrating their existing worktree
  changes separately; this task did not claim or clean up their dirty files.

## Project Retrospective

- The project needs separate terms for owner local stable, candidate client,
  worker instance, foreground lease, and baseline drift. Without those terms,
  parallel agents can produce valid-looking evidence against the wrong app.
- The installed owner client is evidence and version baseline, not a PRD
  replacement. If it diverges from source or docs, stop and reconcile instead
  of silently overwriting it.

## Token Usage

- Exact Codex token count unavailable in this session.
