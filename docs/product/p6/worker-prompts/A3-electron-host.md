# A3 Worker Prompt: Electron Host

Branch: `agent/codex/p6-a3-electron-host`
Base: P6 base commit from `agent/codex/p6-integration`
Role: independent worker. Do not merge.

## Scope

Prepare Electron host integration boundaries that can later adopt the shared product frontend.

## Must Not Edit

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- main Web Preview player implementation
- SVGA exporter or CLI default flow

## Tasks

1. Define/prepare ElectronHostAdapter boundaries.
2. Preserve local-only security:
   - contextIsolation true
   - nodeIntegration false
   - sandbox true when current capability permits
   - narrow preload bridge
   - validated IPC
   - no remote navigation or new windows
   - no telemetry
   - no arbitrary filesystem or shell access
3. Prepare host-side file open, drag/drop boundary, Save As, and document type integration.
4. Do not bind to a final UI before A2 shared frontend is integrated.
5. Add targeted host security checks where possible.

## Output Contract

Commit all changes and leave the worker workspace clean.

Report:

- baseCommit
- headCommit
- commits
- changedFiles
- tests
- assumptions
- blockers
- requestedIntegrationChanges
