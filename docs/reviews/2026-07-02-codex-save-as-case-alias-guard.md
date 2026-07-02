# Save As Case Alias Guard Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Tightened the short-term host Save As guard so a target path that only differs from the opened source by path case is treated as the same source. This keeps the macOS Workbench from accidentally overwriting the current SVGA through a case-only alias while preserving the explicit Overwrite Save path.

## Git State

- Base before task: `5c2a20d0`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/workbench/short-term-host-actions.ts`
- `src/tests/short-term-host-actions.test.ts`

## Requirement Checks

- Save As still requires a distinct target path.
- Explicit Overwrite Save remains the supported overwrite action.
- Dirty output bytes are retained when unsafe Save As is blocked.
- Source bytes stay unchanged when the case-only Save As target is rejected.

## Verification

- Failure-first: `npm run build && node --test dist/tests/short-term-host-actions.test.js` failed before the implementation because the case-only Save As target completed.
- `npm run build && node --test dist/tests/short-term-host-actions.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-command-menu.test.js` (49 tests)

## Risks

- Low. The comparison is intentionally conservative for the macOS-first product boundary; users who want to modify the opened file should use Overwrite Save.

## Next Steps

- Run full test and loop validation after commit.
