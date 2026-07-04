# Short-Term UI/UX Preview Fact Hierarchy Review

## Summary

Adjusted the Preview overview facts toward the Owner-confirmed visual direction: lighter hierarchy, less table-like framing, label-before-value reading order, and default production-spec thresholds hidden from the main preview surface.

This is a focused UI/UX slice. It does not add new product text or new product scope.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base HEAD before this slice: `4db8e30a uiux: align compare surface with canvas direction`
- Scope: UI/UX lane, Preview overview fact hierarchy and S4 proof wording

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-render-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/scripts/build-short-term-acceptance-matrix.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Default Preview no longer renders production-spec target thresholds in overview fact cells.
- Fact cells now show label, value, and a lightweight status only when needed.
- Warning/fail overview statuses map to `可优化`, matching the Owner preview direction.
- S4 smoke proof now checks:
  - actual values are visible,
  - target thresholds are hidden by default,
  - optimization status is visible when applicable,
  - no separate production-spec module is exposed.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, 31/31.
- `npm run desktop:smoke` passed.
- `git diff --check` passed.

## Risks

- This does not yet complete the full Preview high-fidelity pass. Asset rows, imageKey rows, tab density, and foreground desktop validation remain.
- Real foreground desktop validation is still required with production SVGA files before visual acceptance.

## Next Steps

- Continue polishing Preview information rows, imageKey replacement rows, and asset list density under the same no-extra-copy rule.
- Validate in the foreground desktop client with multiple files from `/Users/huangtengxin/Downloads/auto-svga测试物料`.
