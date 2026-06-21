# A4 Worker Prompt: Parity Test Framework

Branch: `agent/codex/p6-a4-parity-tests`
Base: P6 base commit from `agent/codex/p6-integration`
Role: independent worker. Do not merge.

## Scope

Build the parity test and report framework needed for P6. Do not claim parity pass before final integration evidence exists.

## Must Not Edit

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- production business logic outside test/report helpers

## Tasks

1. Define report schemas for:
   - feature parity
   - visual parity
   - interaction parity
   - state parity
   - motion parity
   - browser regression
   - desktop runtime proof
   - security audit
   - accessibility report
   - artifact index
2. Add deterministic validators for required counts and no silent inventory shrink.
3. Add helpers for artifact hash binding and manifest checks.
4. Prepare tests that can run after A1/A2/A3 are integrated.
5. If root package scripts are needed, request them in `requestedIntegrationChanges` only.

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
