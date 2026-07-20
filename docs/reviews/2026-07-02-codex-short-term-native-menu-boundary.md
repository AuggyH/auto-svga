# Short-Term Native Menu Boundary Review

## Summary

Removed deferred Workbench/P6 entries from the Electron native application
menu while preserving the hidden validation and evidence code paths.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Scope: macOS native menu product-surface boundary
- Unrelated local product-doc and research changes were not touched.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Short-term PRD boundary: no menu entry exposes deferred sequence-frame repair
  or export-acceptance mode.
- Host action boundary: removed deferred menu action IDs from host-visible menu
  action metadata.
- Non-goal: did not remove internal prototype proof validators or historical
  evidence handlers.

## Verification

- Failure-first check: desktop experiment test failed while the old `序列` /
  `修复闪帧并另存...` menu remained exposed.
- Passing check:
  `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`

## Risks

- The renderer still contains historical/prototype surfaces for evidence and
  lineage tests; this review only closes native menu exposure for the
  short-term product boundary.
