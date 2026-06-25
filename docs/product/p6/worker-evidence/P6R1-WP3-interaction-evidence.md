# P6-R1 WP3 Interaction Evidence

Date: 2026-06-25
Worker: P6R1-WP3-Interaction-Evidence
Base commit: 1fbcbeae61266028ad8a1463aa591f7666f00924

## Failure-First Baseline

Before repair, the strict interaction validator accepted a trace that could
pass without WP3 interaction proof fields:

- missing `stateBefore`
- missing `realAction`
- missing `stateAfter`
- missing `focusOrVisibleResult`
- missing strict mutation binding fields

The baseline probe returned:

- `failureFirstBaseline`: `CURRENT_VALIDATOR_FALSE_PASS`
- `reportPassed`: `true`

This reproduced the P6-F003/P6-F005 risk: artifact-shaped evidence could pass
without proving the required user-flow shape.

## Repair Summary

- Desktop smoke action capture now records each interaction as:
  `stateBefore -> realAction -> stateAfter -> focusOrVisibleResult`.
- Electron main binds accepted desktop interaction traces to the current git
  head and product artifact catalog digest before writing
  `desktop-interaction-trace.source.json`.
- Strict runtime evidence validation now requires action before/action/after
  fields plus trace-level mutation protection.
- WP3 mutation tests fail when before state, real action, after state,
  focus/result, head binding, or artifact binding is missing.

## Post-Repair Proof

The same missing-field probe now fails:

- `afterRepair`: `MISSING_WP3_FIELDS_REJECTED`
- `reportPassed`: `false`
- failures include missing `stateBefore`, `realAction`, `stateAfter`, and
  `focusOrVisibleResult` for both Web and Desktop traces.

## Validation

- `node --check tools/shared/product-frontend/product-app.mjs` passed.
- `node --check tools/p6/runtime-scenarios/strict-evidence.mjs` passed.
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs` passed.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs` passed.
- `npm run build` passed.
- `node --test tools/p6/parity-mutation-tests.mjs` passed, 24/24.
- `node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs` passed, 13/13.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:prepare` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` passed, 20/20.

## Notes

- The first mutation test attempt failed because local dependencies were absent
  (`fast-png` missing). `npm install --no-package-lock` restored local
  `node_modules` without changing the lockfile.
- The second mutation test attempt failed because `dist/` was absent. Running
  `npm run build` generated the required local ignored build output.
- A foreground full product smoke/App run was not performed by this worker to
  avoid disrupting the active desktop session. A0 still owns serial Gate B and
  later App-visible verification.
- P6-F003 and P6-F005 remain open; this worker does not update the Finding
  Ledger or lifecycle files.
