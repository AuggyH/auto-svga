# NQ1 Resume Instructions

Use the repository, not chat context, as the source of truth.

1. Check `git status --short --branch`.
2. Confirm the branch is `agent/codex/nq1-overnight-hardening`.
3. Read `docs/overnight/NQ1_STATE.json`.
4. Resume the first work package whose `status` is not `complete`, `partial`, or `blocked`.
5. Do not repeat completed work unless its recorded evidence is contradicted by current files or tests.
6. Append every new attempt to `docs/overnight/NQ1_HISTORY.jsonl`.
7. Do not auto-accept P4 and do not start P5.
8. Stop starting new work after `packagingStartTime`; package current evidence instead.

Rollback path:

- Return to the P4 final branch state at `fc5e953f6f96a4eb49776af6c5166bd2c2c4f4c4`.
- Keep browser workflow and `npm run local:preview` as rollback paths.
