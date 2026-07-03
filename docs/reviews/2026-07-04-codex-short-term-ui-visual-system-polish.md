# Short-Term UI Visual System Polish Review

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Polished the short-term macOS client UI without changing product logic. The
work focused on token-backed visual hierarchy for surfaces, controls, rows,
fact cells, and launch-page structure.

No PM-owned PRD or product scope documents were changed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-launch-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Kept short-term UI inside the current S1-S16 scope.
- Preserved the existing two-column file/spec fact grid and did not reduce its
  information density.
- Did not introduce new product actions, states, labels, helper copy, or
  feature scope.
- Removed two launch-page helper notes that were not required by the current
  product docs.
- Added token-backed surface, row, control, fact-cell, and menu shadow tokens
  instead of adding raw visual values to component CSS.
- Kept visible dynamic DOM generation inside approved renderer modules.
- Added tests for the new visual-system token trace and for launch-page
  stretch behavior.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm run desktop:smoke`
- `git diff --check`

Observed results:

- Design-system check passed.
- svga-web experiment tests passed: 30/30.
- Desktop smoke passed.
- CSS raw dimension debt did not increase; component-layer raw dimension count
  is now below its guard limit.

## Visual Evidence Note

Desktop smoke reported `shortTermScreenshots: true`, but current PNG artifacts
under the internal-trial package did not refresh after the latest source edits.
Therefore, those screenshots must be treated as stale automated regression
artifacts, not as visual acceptance evidence.

Per Owner direction, final UI/UX acceptance still requires foreground desktop
client screenshots with real production SVGA files and macOS window chrome.

## Risks / Follow-Up

- This is a visual-system polish slice, not final high-fidelity acceptance.
- Foreground App validation is still required after rebuilding or launching the
  current source in a real desktop window.
- The stale screenshot behavior should be investigated separately if automated
  visual artifacts are expected to reflect every source UI change.
