# Electron Editor Threat Model

Scope: NQ1-R1 evidence for the isolated Electron SVGA editor prototype.

## Assets

- Local SVGA files selected or dropped by the user.
- Generated inspection reports and edited SVGA bytes.
- Temporary runtime files under the prototype session root.
- Local logs and smoke-test artifacts.

## Trust Boundaries

- Renderer: no direct filesystem module access.
- Preload bridge: narrow API surface, no arbitrary path reads or writes.
- Main process: owns file picker, Save As, temporary files, and local server
  lifecycle.
- Browser workflow: remains the rollback path and is not replaced by Electron.

## Required Controls

- `contextIsolation=true`.
- `nodeIntegration=false`.
- `sandbox=true` where the runtime supports it.
- Remote navigation and new windows blocked.
- Local vendored player assets only.
- No telemetry and no upload of user assets.
- Absolute paths redacted from logs and reports.
- Temporary files cleaned on normal exit and failure paths.

## NQ1-R1 Risk Status

- macOS internal prototype behavior has bounded smoke coverage.
- Windows runtime is not claimed; only pure path checks are allowed.
- `wasm-unsafe-eval` remains an internal prototype exception, not a production
  desktop baseline.
- P5 must not broaden filesystem, player, export, or network scope without a new
  milestone contract.
