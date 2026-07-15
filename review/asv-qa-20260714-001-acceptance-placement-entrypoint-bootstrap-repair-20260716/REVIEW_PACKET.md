# Review Packet

## Scope

Repair the acceptance-display startup proof path after Permit093 showed installed build
`5019ec4725f7af077b82b5108d60543bafd1717a` could exit with no proof and no target process.

## Root Cause Hypothesis

The 5019 proof writer was still installed after local module imports and top-level initialization. A packaged
entrypoint failure in that zone could exit before the app reached `app.whenReady().catch(...)`, leaving QA with
only an empty launch log.

## Change Summary

- `main.cjs` now installs a minimal acceptance-startup fatal guard before the first local require.
- The guard writes `acceptance-startup-placement-proof.json` with `status:"rejected"`, `phase:"bootstrap"`,
  stable reason, execution id, requested display id, early runtime instance id, and privacy flags.
- The guard is released after the ordinary `app.whenReady().then(createExperimentWindow).catch(...)` chain is
  installed, keeping runtime behavior narrow.
- The placement test now asserts the writer and fatal handlers appear before local module loading and do not depend
  on late product artifact state.

## Validation Summary

See `VALIDATION_SUMMARY.json`.

## Nonclaims

This packet does not claim installed QA, product matrix pass, foreground success, packaging readiness, Product Owner
acceptance, support, distribution, or release readiness.
