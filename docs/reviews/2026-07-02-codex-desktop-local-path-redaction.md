# Desktop Local Path Redaction Review

## Summary

Tightened Electron desktop host redaction for local paths in logs, runtime
arguments, and visible-startup external-request proof aggregation.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Scope: desktop host privacy and NQ1 Save As safety matrix coverage
- Unrelated local product-doc changes were not touched by this task.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `src/tests/helpers/nq1-save-as-safety-matrix.ts`
- `src/tests/nq1-save-as-safety-matrix.test.ts`

## Requirement Checks

- P7 desktop-client preparation: improved path privacy in host diagnostics and
  proof metadata.
- S1/S16 privacy boundary: full local paths remain hidden in host-visible
  outputs.
- Non-goal: no UI shell wiring, product-scope expansion, exporter change, or
  playback behavior change.

## Verification

- Failure-first check: `node --test dist/tests/nq1-save-as-safety-matrix.test.js`
  failed before implementation with missing log/runtime redaction source checks.
- Passing targeted check: `npm run build && node --test dist/tests/nq1-save-as-safety-matrix.test.js`
- Passing desktop contract check:
  `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`

## Risks

- Regex-based path redaction remains conservative and may redact more than a
  perfect platform parser would, but this is safer for outward-facing logs and
  review metadata.
