# ASV-QA-20260708-006 Launch Window Display Bounds

## Summary

Fixed the short-term macOS launch-window sizing policy so the launch surface preserves its compact dimensions when moved across runtime-detected displays. Workbench sizing is still applied only after the app enters a loaded non-launch view.

## Git State

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Fix implementation commit: `5527d0235e707d0cceb7d8ff1705040052c51f40`
- Existing unrelated dirty files were present before this report and were not included in the fix commit.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/short-term-window-bounds-policy.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/quality/reports/ASV-QA-20260708-006-fix.md`
- `docs/quality/evidence/ASV-QA-20260708-006/callback-evidence.json`

## Requirement Checks

- Runtime display metadata is used; no display name, primary/external role, coordinate sign, or scale factor is hardcoded.
- Launch dimensions are preserved during move/resize/display-metrics changes unless the user explicitly resizes the launch window.
- Workbench dimensions are still applied for loaded non-launch views.
- Empty failed state without a source file remains launch-sized.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs` passed.
- `node --check tools/electron-prototype/experiments/svga-web/short-term-window-bounds-policy.cjs` passed.
- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs` passed.
- `npm run desktop:short-term:design-system-check` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` passed, 34 tests.
- `npm run desktop:smoke` passed.
- `npm run desktop:p2:normal-proof` launched but exited non-zero due existing `auditPanel=false` in the aggregate normal proof; not used as the 006 pass gate.

## Risks And Next Steps

- QA still needs a refreshed owner-used local stable app at `/Users/huangtengxin/Applications/Auto SVGA.app` containing `5527d0235e707d0cceb7d8ff1705040052c51f40` or a descendant before regression.
- Product Owner's exact manual pointer-drag path was not reproduced in this lane; the fix is guarded by code-level deterministic bounds proof and Electron event coverage.

## Project Retrospective

- For desktop window bugs, keep launch/workbench/window-mode state in the host, not only in renderer view transitions.
- Cross-display behavior should be tested against abstract workArea rectangles and event paths so the test does not encode the owner's current monitor arrangement.

## Token Usage

- Source: unavailable.
- Estimate: not recorded.
