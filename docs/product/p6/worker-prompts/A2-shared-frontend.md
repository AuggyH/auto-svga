# A2 Worker Prompt: Shared Frontend

Branch: `agent/codex/p6-a2-shared-frontend`
Base: integration HEAD after A1 has been integrated
Role: independent worker. Do not merge.

## Dependency

Before A1 is integrated, A2 may only do read-only audit and migration planning.

Do not modify shared frontend product source until the Integration Coordinator confirms A1 is integrated.

## Scope

Extract or establish a shared Web/Electron product frontend driven by the A1 Web parity contract.

## Must Not Edit

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`

## Tasks

1. Preserve Web behavior.
2. Share product page source between Web and Electron.
3. Share core CSS, design tokens, product state machine, player controls, inspection display, Motion Asset Audit display, and motion definitions.
4. Keep host-specific behavior behind adapters.
5. Hide P3-P5 editor incubation from the default product surface.
6. Add targeted source-sharing checks.

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
