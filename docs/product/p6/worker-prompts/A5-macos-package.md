# A5 Worker Prompt: macOS Packaging

Branch: `agent/codex/p6-a5-macos-package`
Base: P6 base commit from `agent/codex/p6-integration`
Role: independent worker. Do not merge.

## Scope

Prepare isolated macOS internal `.app` packaging for the P6 product surface.

## Must Not Edit

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- main Web Preview player implementation
- SVGA exporter or CLI default flow

## Tasks

1. Prepare no-dependency or isolated packaging scaffold for macOS arm64 internal app.
2. Ensure bundle metadata supports:
   - internal use only
   - unsigned
   - unnotarized
   - `.svga` document type
3. Prepare app proof manifest fields.
4. Prepare privacy and bundle audits:
   - no repo absolute path
   - no username
   - no CDN or public network dependency
   - no real user assets
5. Do not generate final P6 App acceptance. Final packaged App smoke is owned by Integration Coordinator.
6. If root package scripts are needed, request them in `requestedIntegrationChanges` only.

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
