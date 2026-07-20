# Short-term UI/UX WP6AB Command State DOM Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Continued the short-term macOS client UI/UX componentization pass by moving
command-state DOM application out of the app entry file and into the short-term
DOM state module.

The app entry still builds the command state and synchronizes the native menu
snapshot. The DOM state module now owns applying command enabled/disabled
states and the Play/Pause button label.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: `docs/product/PRODUCT_ROADMAP.md` remains the sole PRD
  authority. No PRD-owned files were changed.
- UI/UX authority: follows `DESIGN.md` and the short-term UI/UX redesign
  execution plan by keeping page-state DOM behavior in the DOM state layer.
- Scope boundary: no command availability rules, labels, menu states,
  shortcuts, or interactions were changed.
- Menu boundary: native menu synchronization remains in the app entry because it
  crosses into the Electron host bridge.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `git diff --check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

Result: all checks passed.

## Notes

- New regression assertions keep command-state iteration and Play/Pause label
  DOM assignment out of `short-term-macos-app.mjs`.
- `setActionEnabled` remains exported because text-preview controls still use
  focused local enablement after runtime text rendering.
- `desktop:smoke` remains automated regression evidence only. It is not a
  substitute for future foreground macOS visual review using real production
  SVGA materials.

## Risks

- This slice improves structure only; it does not claim high-fidelity visual
  quality or final interaction acceptance.
- Command state is cleaner, but app-entry orchestration and smoke proof
  collection are still large and should be reduced carefully.

## Next Step

Continue WP6AB by looking for the next owner-visible DOM responsibility that can
move behind a component/module boundary without changing product scope.
