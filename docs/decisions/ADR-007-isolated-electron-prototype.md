# ADR-007: Isolated Electron Prototype Result

Date: 2026-06-19

## Status

The isolated macOS runtime parity spike passed. Production desktop integration
remains rejected pending the listed blockers.

## Context

ADR-006 allowed one isolated Electron prototype. The implementation uses a
dedicated package, local player assets, a synthetic SVGA, a loopback-only host,
existing inspection/report services, and the existing read-only audit renderer.

Source-mode and packaged macOS arm64 smoke verified local page loading, visible
SVGA playback, inspection report generation, Motion Asset Audit rendering, and
local-only resource requests. Windows x64 packaging succeeded but was not run.

SVGAPlayer-Web 2.3.1 requires dynamic `eval`. Strict CSP blocked the player, so
the isolated prototype uses `script-src 'self' 'unsafe-eval'`. Electron emits a
security warning for this policy.

## Decision

1. Keep the prototype isolated under `tools/electron-prototype/`.
2. Do not add Electron to the root dependency graph or default scripts.
3. Preserve the browser workflow as the stable production and rollback path.
4. Accept the prototype's local vendored player assets and synthetic fixture
   only for desktop feasibility testing.
5. Keep renderer Node integration disabled, context isolation and sandboxing
   enabled, IPC narrow and validated, navigation blocked, and the host loopback
   only.
6. Treat CSP `unsafe-eval` as a production blocker, not an accepted desktop
   security baseline.
7. Do not begin installer, updater, signing, notarization, or production shell
   work before a player-CSP compatibility decision.
8. Require native Windows playback/report smoke before any cross-platform
   support claim.

## Consequences

- Electron can reproduce the minimum Auto SVGA inspection experience locally
  on macOS without CDN access.
- The existing inspection primitives and report presentation remain reusable in
  a desktop host.
- Package size remains high: approximately 116 MiB compressed on macOS arm64
  and 142 MiB compressed for the generated Windows x64 package.
- Production approval is blocked by player CSP, Windows runtime evidence,
  signing/distribution, and operational hardening.
- Removing the prototype does not require reverting root package or runtime
  changes.

## Rejected alternatives

### Relax CSP without recording a blocker

Rejected because local-only assets reduce exposure but do not make dynamic code
evaluation a suitable production default.

### Replace the current browser workflow now

Rejected because the prototype is evidence, not a release-quality client.

### Continue directly to installer work

Rejected because player security and native Windows parity are unresolved.
