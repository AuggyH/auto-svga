# ADR-011: Internal Electron Prototype Exception Review

Date: 2026-06-19

Status: accepted as an internal-trial boundary; not production approval

## Context

ADR-010 keeps `wasm-eval` out of the production desktop baseline. It also
allows a separate review to decide whether a tightly bounded internal Electron
prototype trial may proceed despite a player-level CSP exception.

Current player candidates:

- `svgaplayerweb@2.3.1`: requires `unsafe-eval`; prototype-only.
- `svga-web@2.4.4`: passes playback, inspection report, and Motion Asset Audit
  smoke in the isolated prototype, but triggers `wasm-eval`; candidate-only.

## Decision

An internal Electron prototype exception may be reviewed, but it is not a
production desktop approval.

The exception may only cover internal testing of:

1. Choosing or dragging a local SVGA.
2. SVGA playback.
3. Inspection report display.
4. Motion Asset Audit read-only display.

macOS is the first internal-trial target. Windows must stay unverified unless a
separate Windows runtime smoke passes.

## Required Runtime Boundaries

An internal trial package must satisfy all of these requirements:

1. Load only local vendored assets.
2. Block remote scripts.
3. Block remote navigation and new windows.
4. Use `contextIsolation: true`.
5. Use `nodeIntegration: false`.
6. Use `sandbox: true`.
7. Keep preload API minimal.
8. Strictly validate IPC parameters.
9. Provide no arbitrary filesystem access.
10. Provide no arbitrary static directory service.
11. Disable telemetry.
12. Upload no user assets.
13. Persist no absolute paths.
14. Clean temporary files on exit.
15. Redact logs.
16. Clearly label the package as "internal prototype, not production".

## Prohibited Scope

The internal exception cannot be used for:

1. Public or external-user distribution.
2. Production installer release.
3. Auto-update.
4. Signing or notarization completion claims.
5. Production security approval.
6. Format conversion.
7. Export workbench.
8. Automatic repair or optimization.
9. New format parser adoption.
10. Any AI, external model, multimodal, or network analysis service.

## Exit Conditions

Stop the internal trial and return to browser workflow if any of these occur:

1. Remote resource loading is observed.
2. IPC or file access crosses the approved boundary.
3. Temporary files cannot be cleaned.
4. Playback visibly diverges from the browser baseline.
5. User assets enter logs.
6. Absolute local paths enter logs or persisted reports.
7. Telemetry or external upload is introduced.

## Rollback

The stable rollback paths are:

1. Browser workflow through the existing Web preview.
2. Local launcher: `npm run local:preview`.

## Relationship to Recent Commits

- Launcher implementation: `52c00cc80f3561d3f9bd55606785106dc6dc1f49`.
- Launcher review: `9bf7296f4562d7c677092d7b716024a942dbc747`.
- `svga-web` spike implementation: `de3d883cacdbffd75a5e2239e792b11d89aca571`.
- `svga-web` spike review: `351c0ebd193beb85266555bdf2a1293601ffcf35`.
- ADR-010 decision: `2ddc80b452d81955467f2e4c4d8c254373e61db3`.
- ADR-010 review cleanup: `ffae8d655daf2a9e049644375b4acc553a2d3cbd`.

The current branch tip records the launcher line plus ADR-010/ADR-011 delivery
state. The separate `agent/codex/svga-web-strict-csp-spike` branch remains the
historical isolated playback spike branch.

## Verification Boundary

This ADR changes no runtime behavior, package scripts, dependencies, Web
preview code, exporter code, CLI default flow, import, drag-drop, or comparison
logic.
