# Review Packet

## Scope

Repair acceptance-display startup proof emission so installed QA can distinguish
accepted placement, rejected placement, and bootstrap/startup failure with a
bounded product artifact before any Open/chooser/product input.

## Source Changes

- `main.cjs` lazy-loads the placement proof helper, writes bootstrap rejected
  proof on acceptance startup failure, and fails closed when proof status is not
  accepted.
- `acceptance-startup-placement-proof.cjs` writes rejected proof artifacts for
  unsafe/inexact placement instead of returning only an in-memory rejection.
- `macos-package-proof.mjs` binds the proof helper in the packaged
  window-placement source closure.
- Focused tests cover rejected-proof writing, bootstrap-safe load ordering, and
  missing packaged proof helper.

## Root Cause

The prior source wrote `acceptance-startup-placement-proof.json` only on fully
accepted placement. Any inexact placement, proof-helper load failure, or app
startup failure before product input could leave QA with only an empty launch
log and no process. The package proof closure also omitted the new proof helper.

## Validation Summary

- JS/CJS syntax: PASS
- Placement proof focused tests: PASS 10/10
- Package proof focused tests: PASS 2/2 with read-only hash-matched dependency
  tree for `@electron/asar`
- Picker/control preservation: PASS 14/14 across focused conformance and
  installed-file-open source tests
- Placement store: PASS 9/9
- `npm run build`: PASS
- `npm run test:all`: PASS 538/538
- Design-system check: PASS
- Hygiene: `git diff --check`, strict JSONL parse, package/lockfile scan, and
  media/archive scan PASS

Optional full svga-web source suite was attempted but not claimed: it stopped
during `prepare-runtime.mjs` because local runtime dependency `long` is absent
in this worktree. No Electron launch occurred.

## Nonclaims

No Electron/Auto SVGA launch, foreground, Finder/dialog, installed mutation,
Packaging, QA, Code Review routing, Product Owner acceptance, support,
distribution, or release readiness is claimed.
