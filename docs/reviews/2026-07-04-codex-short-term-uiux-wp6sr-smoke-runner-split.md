# Short-Term UI/UX WP6SR Smoke Runner Split Review

## Summary

This UI/UX checkpoint moves the short-term smoke/proof orchestration out of the app entry file into a dedicated smoke runner module.

The change is behavior-preserving for normal owner-visible use. It does not alter visible UI, product scope, copy, menu actions, keyboard shortcuts, save-state behavior, or user workflows. The smoke runner remains an internal verification path triggered only by `mode=smoke`; the app entry now only installs the runner with the runtime callbacks it needs.

## Git State

- Base before this slice: `a5a6386d uiux: split short-term replaceable surface`
- Working branch: `agent/codex/svga-workbench-v1-autonomous`
- Product/PRD files: not modified

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
  - New internal smoke runner module.
  - Owns proof capture orchestration, fixture loading, smoke-only interaction probes, and smoke-result reporting.
  - Reuses the existing smoke proof model, API client invalid probe, byte hashing helper, playback prototype hook, and app runtime callbacks.
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Removes smoke proof imports and the inline smoke runner body.
  - Installs the smoke runner through a small callback object.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Updates structural assertions so smoke proof orchestration is owned by the smoke runner, not the app entry.

## Requirement Checks

- Touched PRD IDs: automated verification path only; no owner-visible scope changed.
- Owner-visible product scope: unchanged.
- Visible text/copy: unchanged.
- Product documentation ownership: no PM-owned PRD or product docs changed.
- Normal launch path: unchanged.
- Smoke launch path: still gated by `mode=smoke`.
- Additional explanatory labels/statuses: not introduced.
- Componentization direction: improved by separating internal verification orchestration from owner-visible app assembly.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs` passed.
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:short-term:design-system-check` passed.
- `git diff --check` passed before the final review file add; rerun before handoff/commit.

## Evidence Boundary

This checkpoint proves implementation structure and automated regression only. It does not claim final UI/UX visual or real-use interaction acceptance.

Foreground macOS desktop-client review remains required for UI/UX acceptance, using native menu bar/titlebar/window chrome and multiple real production SVGA files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.

## Risks

- The smoke runner is still intentionally large because this slice moved the verification path without rewriting its scenario internals.
- The app entry still owns app-shell workflow composition such as file open/load, mode switching, general compare entry, and preview render composition.

## Next Steps

1. Audit the remaining app entry responsibilities and decide which are shell assembly versus surface-level workflow ownership.
2. Add a final structure completion review before entering visual polish.
3. Run foreground macOS review before making any visual or interaction acceptance claim.
