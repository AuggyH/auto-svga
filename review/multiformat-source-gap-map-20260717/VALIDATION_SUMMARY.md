# Validation Summary

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-source-gap-map.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
- `node --test --test-name-pattern "source gap map" tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 2/2
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`: PASS 5/5
- `node --test --test-name-pattern "source reopen clears stale|Apply completion cannot cross|image Apply completion" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 3/3
- `node tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-source-gap-map.cjs`: PASS, pre-commit SHA `92c61bea16fd32c1f4b7424781342fae6b402d3c1e5dc46254ad684a59be89e3`
- `npm run build`: PASS
- `npm run test:all`: PASS 542/542
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS

Hygiene checks are recorded in the final handoff after packet sealing.
