# Stale Open Facade Guard Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Closed a short-term Workbench facade consistency gap: stale open completion or failure results are now ignored before the facade mutates source bytes, recents, or active workflow state. This keeps the facade aligned with the app state model's existing stale-request guard.

## Git State

- Base before task: `6dbb1569`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-workbench-facade.ts`
- `src/tests/short-term-workbench-facade.test.ts`

## Requirement Checks

- Stale open completion cannot replace the current pending request's source bytes or source hash.
- Stale open completion cannot add the old file to recents.
- Stale open failure cannot overwrite the current active workflow with a failed old request.
- Host/session behavior remains unchanged; this only hardens the pure facade boundary.

## Verification

- `npm run build && node --test dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-host-actions.test.js dist/tests/short-term-host-session.test.js` (71 tests)
- `npm run test:all` (395 tests)

## Risks

- Low. The facade now returns the existing state unchanged when app state rejects a stale open result.

## Next Steps

- Run loop validation after commit.
