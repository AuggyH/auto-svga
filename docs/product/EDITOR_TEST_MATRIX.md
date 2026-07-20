# Editor Test Matrix

Purpose: keep the bounded SVGA image-resource editor testable without relying
on chat history, manual screenshots, or hidden local state.

## Protected Flows

| flow | primary evidence | command |
| --- | --- | --- |
| Resource discovery | stable resource keys, dimensions, hashes, usage counts | `node --test dist/tests/svga-image-resource-editor.test.js` |
| Single-resource edit | P3 replace, preview, Save As invariants | `node --test dist/tests/svga-image-resource-editor.test.js` |
| Multi-resource edit | P4 per-resource replacement and untouched-resource integrity | `node --test dist/tests/svga-image-resource-editor.test.js` |
| Undo / redo / save point | deterministic state machine and edit history | `node --test dist/tests/nq1-history-model.test.js dist/tests/svga-image-edit-history.test.js` |
| Async race and failure handling | stale preview, failed preview, save rejection, rollback | `node --test dist/tests/nq1-async-race.test.js` |
| Save As safety | path redaction, same-source and case-alias rejection, IPC boundary | `node --test dist/tests/nq1-save-as-safety-matrix.test.js` |
| Multi-resource round trip | synthetic fixtures with 1/2/3/5/10/25 resources | `node --test dist/tests/nq1-round-trip-matrix.test.js` |
| Cleanup lifecycle | server, runtime, player, session, object lifecycle | `node --test dist/tests/nq1-cleanup-stress.test.js` |
| Accessibility semantics | keyboard, labels, focus, error text, report folding | `node --test dist/tests/nq1-accessibility-audit.test.js` |
| Electron prototype smoke | isolated local player, report, audit, security boundary | `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test` |

## NQ1 Repeat Stability

`npm run nq1:flake-stability` performs:

1. Core targeted tests 5 times.
2. Isolated Electron / svga-web smoke 3 times.
3. Multi-resource round-trip subset 3 times.

It writes:

` .artifacts/product/NQ1/flake-stability-report.json`

The report is ignored runtime evidence, not a committed product artifact.

## Determinism Rules

- Use synthetic fixtures only.
- Use seeded fixture generation.
- Use OS-assigned loopback ports.
- Wait on readiness conditions instead of arbitrary sleeps.
- Keep Electron smoke sequential.
- Clean scoped `.runtime` directories before preparing a new runtime.
- Do not persist user absolute paths in reports, logs, or upload packets.
- Do not weaken unknown-field fail-closed behavior for convenience.

## Manual Coverage Still Required

- Pixel-perfect visual parity.
- Screen-reader output.
- Real Windows path behavior.
- Long-running renderer memory pressure.
- Real user asset acceptance.

These are documented gaps, not implicit pass conditions.
