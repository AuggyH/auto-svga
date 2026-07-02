# Playback Facade Guard Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Hardened the short-term Workbench facade so playback failure and recovery transitions only mutate facade workflow state inside the valid playback-abnormal flow. Direct facade calls outside that flow now keep the original state instead of creating a misleading `playback` workflow.

## Git State

- Base before task: `7a920b45`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-workbench-facade.ts`
- `src/tests/short-term-workbench-facade.test.ts`

## Requirement Checks

- Preserves dirty output when real playback abnormal recovery occurs.
- Keeps launch and normal preview states unchanged when playback recovery/reporting is called out of flow.
- Prevents facade-level workflow status from advertising playback work without an active file or playback abnormal state.
- Leaves host-layer playback guards unchanged.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-workbench-facade.test.js` failed before the implementation because launch-state playback reporting changed `activeWorkflow.kind` to `playback`.
- `npm run build && node --test dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-host-actions.test.js` (55 tests)
- `npm run test:all` (397 tests)

## Risks

- Low. The guard only affects invalid direct facade transitions; valid playback abnormal recovery continues to update workflow state and preserve active output.

## Next Steps

- Run full test and loop validation after commit.
