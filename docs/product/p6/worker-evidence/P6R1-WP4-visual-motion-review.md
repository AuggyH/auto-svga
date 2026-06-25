# P6-R1 WP4 Visual And Motion Review Evidence

Date: 2026-06-25
Worker: P6R1-WP4-Visual-Motion-Review
Base commit: 33bb4c7d8fae3e866b87ddc9468b4f09a396c3f8

## Failure-First Baseline

Before repair, targeted probes showed WP4 evidence could still false-pass two
required Gate C risks:

- Responsive visual comparison with mismatched `900 x 720` vs `1440 x 900`
  viewport context and `comparedPixels: 0` returned `stateFalsePass: true`.
- Normal-motion evidence with identical Web `start`, `mid`, and `end` frame
  hashes returned `motionFalsePass: true`.

The reviewer support path already rejected verdict-shaped P6 evidence requests,
but it did not expose a named WP4 consistency check for the specific generic
PASS over category review-required risk.

## Repair Summary

- Strict state comparison now requires nonzero pixel comparison coverage.
- Strict state comparison now rejects explicit Web/Desktop viewport, DPR, mode,
  panel, or modal context mismatch.
- State comparison generation writes the Web/Desktop context it used.
- Strict motion evidence now verifies that Web and Desktop normal-motion
  `start`, `mid`, and `end` frame hashes are all present and distinct.
- Motion evidence generation no longer treats reduced-motion CSS as proof that
  normal-motion Web frames changed.
- Reviewer support now has a named `reviewer-generic-pass-consistent` check
  that fails if a generic PASS is paired with category verdicts that still
  require review.

## Post-Repair Proof

The same visual and motion false-pass probes now return:

- `stateFalsePassAfterRepair: false`
- `motionFalsePassAfterRepair: false`

Mutation tests also cover:

- inconsistent viewport plus zero-pixel visual comparison coverage
- identical normal-motion `start`/`mid`/`end` frame hashes
- generic reviewer PASS over a `HUMAN_REQUIRED` category verdict

## Validation

- `npm install --no-package-lock` passed to restore local ignored dependencies.
- `npm run build` passed.
- `node --check tools/p6/runtime-scenarios/strict-evidence.mjs tools/p6/runtime-scenarios/state-evidence.mjs tools/p6/parity-runner.mjs tools/p6/parity-mutation-tests.mjs` passed.
- `node --test tools/p6/parity-mutation-tests.mjs` passed, 27/27.

## Notes

- The first mutation test attempt failed before business assertions because
  local `node_modules` was absent (`fast-png` missing).
- The second mutation test attempt failed before business assertions because
  local `dist/` was absent. Running `npm run build` generated the required
  ignored build output.
- Web Preview source-of-truth files, Electron product behavior, lifecycle
  files, Finding Ledger, exporter output, CLI default flow, dependencies, and
  lockfiles were not changed.
- P6-F004, P6-F006, and P6-F008 remain open; this worker does not update the
  Finding Ledger or lifecycle files.
