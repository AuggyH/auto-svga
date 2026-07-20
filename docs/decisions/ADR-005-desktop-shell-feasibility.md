# ADR-005: Desktop Shell Feasibility Direction

Date: 2026-06-19

## Status

Accepted as a feasibility direction. No desktop framework or dependency is
approved for production by this decision.

## Context

Auto SVGA has a stable local Web preview, a Node inspection host, host-neutral
inspection primitives, and a read-only Motion Asset Audit presentation. A
desktop shell could improve local file access, lifecycle, diagnostics, and
distribution, but the current preview also depends on a development HTTP
server, compiled `dist` modules, repository artifact discovery, and CDN-loaded
player scripts.

The next step must preserve the existing SVGA playback and inspection behavior.
It must not turn desktop packaging into a rewrite of the player, exporter, CLI,
or workbench contracts.

## Decision

1. Use Electron as the preferred option for one isolated desktop MVP prototype.
2. Do not add Electron or any desktop dependency in the feasibility task.
3. Retain the loopback HTTP host in the first prototype to minimize playback
   regression risk. The desktop main process owns its lifecycle and ephemeral
   port.
4. Use a sandboxed renderer with no direct Node or filesystem access.
5. Keep protobuf inspection, PNG analysis, hashing, and report composition in
   the host process behind a narrow boundary.
6. Package approved player scripts locally before claiming offline behavior.
7. Package a clean `dist` build and `proto/svga.proto`; stale build output is a
   release-blocking risk.
8. Replace repository-root scanning with explicit user-selected files or
   workspaces in a packaged application.
9. Keep the local-server/external-browser workflow as the stable fallback.
10. Reconsider Tauri only after the host contract is stable and SVGA playback
    parity is demonstrated on macOS and Windows system WebViews.

## Consequences

- The first prototype can reuse the current Node inspection composition and Web
  renderer rather than duplicating report logic.
- Electron's package-size cost remains open and must be measured, not assumed.
- The initial loopback server preserves behavior but requires a dedicated
  static root, loopback-only binding, lifecycle control, and explicit file
  permissions.
- Offline delivery requires removing CDN runtime dependencies.
- macOS notarization, Windows signing, installers, and automatic updates remain
  outside the desktop MVP.
- No production support claim exists until a separate dependency, license,
  security, offline, playback, and package-size spike passes.

## Rejected or deferred alternatives

### Adopt Tauri first

Deferred because the current host is Node-based. Introducing a Rust bridge or
sidecar and relying on platform WebViews increases the first prototype's
integration and playback-parity surface. Tauri remains a valid later candidate
when package size becomes the dominant constraint.

### Continue only with an external browser

Retained as the development fallback but rejected as the final client direction
because it does not provide a coherent application lifecycle, controlled file
permissions, packaged offline assets, or user-facing diagnostics.

### Expose Node directly to the renderer

Rejected because it would collapse the existing host boundary and expose local
filesystem and execution capabilities to Web code.

### Rewrite inspection or playback for the shell

Rejected because the host-neutral inspection contracts and existing SVGA player
already provide the required MVP behavior. A rewrite would add risk without
proving desktop feasibility.
