# A1 Worker Prompt: Web Baseline

Branch: `agent/codex/p6-a1-web-baseline`
Base: P6 base commit from `agent/codex/p6-integration`
Role: independent worker. Do not merge.

## Scope

Freeze the real Web Preview product baseline for P6.

## Must Not Edit

- `docs/loop/CURRENT_MILESTONE.md`
- `docs/loop/LOOP_STATE.md`
- `docs/loop/LOOP_HISTORY.jsonl`
- `AGENTS.md`
- root `package.json`
- business logic unrelated to baseline capture

## Tasks

1. Run the current Web Preview using approved synthetic fixtures.
2. Inventory every required Web region, feature, interaction, state, and UI motion.
3. Create:
   - `docs/product/P6_WEB_PRODUCT_BASELINE.md`
   - `docs/product/P6_WEB_FEATURE_INVENTORY.md`
   - `docs/product/P6_WEB_PARITY_CONTRACT.json`
4. Generate baseline artifacts under `.artifacts/product/P6/web-baseline/`.
5. Generate manifest files for DOM, computed styles, interaction trace, motion manifest, and artifact index.
6. Do not shrink inventory to make later parity easier.

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
