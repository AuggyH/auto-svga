# P6-R1 WP5 App Delivery Evidence

Date: 2026-06-25
Worker: P6R1-WP5-App-Delivery
Base commit: 180350e021df823980ed0ec62d8df3be8fa4feee

## Failure-First Baseline

Before repair, targeted WP5 probes showed App delivery evidence could still
false-pass required Gate C risks:

- Normal App proof with a proof/smoke launch target and `--p2-normal-proof`
  launch command returned `packaged-app-launch: pass`.
- Owner handoff support had no callable owner-visible manifest binding check
  for same-head Review ZIP, App ZIP, privacy audit, and visible material
  entries.
- Final packaging gate checked sealed packet and parity report heads, but not
  normal App proof, internal trial manifest, or macOS package proof heads.

Environment setup notes before the business probe:

- The first mutation test run failed because local ignored dependencies were
  absent (`fast-png` missing).
- After `npm install --no-package-lock`, the next run failed because ignored
  `dist/` output was absent.
- `npm run build` restored local `dist/`; the existing mutation tests then
  passed 27/27 before the WP5 failure-first probes were added.

## Repair Summary

- Normal App proof validation now rejects proof-only and smoke-only launch
  targets or launch commands, including `AUTO_SVGA_P2_NORMAL_PROOF`,
  `--p2-normal-proof`, `--smoke`, smoke query modes, and `npm run desktop:dev`
  proof paths.
- Final packaging gate now binds normal App proof, internal trial manifest, and
  macOS package proof source heads to the current Git head when those App
  delivery materials are present.
- Final owner handoff generation now requires the normal App proof, internal
  trial manifest, and macOS package proof files before building owner-visible
  materials.
- Owner-visible manifest validation now requires same-head binding, zero-finding
  privacy audit, Review ZIP entry/hash binding, App ZIP entry/hash binding, and
  required visible companions.

## Post-Repair Proof

The same WP5 probes now pass:

- Proof/smoke-flavored App launch evidence fails `normal-app-proof-flags`.
- Stale App proof, internal trial manifest, and macOS package proof heads fail
  the final packaging gate.
- Owner-visible manifest drift fails when the reviewed head, Review ZIP, App
  ZIP, privacy audit, or required visible entries are missing or mismatched.

## Validation

- `npm install --no-package-lock` passed to restore local ignored dependencies.
- `npm run build` passed.
- `node --check tools/p6/parity-runner.mjs` passed.
- `node --test tools/p6/parity-mutation-tests.mjs` passed, 28/28.
- `node --check tools/p6/build-p6-owner-handoff.mjs` passed.
- `node --test tools/p6-owner-handoff-package.test.mjs` passed, 12/12.
- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:prepare` passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` passed, 20/20.
- `git diff --check` passed.

## Notes

- This worker did not run final seal, Product Owner Human Gate, signing,
  notarization, release, push, or merge.
- Web Preview source-of-truth files, browser behavior, exporter output bytes,
  CLI default flow, root package scripts, lifecycle files, and Finding Ledger
  were not changed.
- P6-F007, P6-F009, and P6-F011 remain open; this worker does not close
  findings or update lifecycle state.
