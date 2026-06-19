# ADR-006: Electron Spike Boundary

Date: 2026-06-19

## Status

Electron is conditionally approved for one isolated prototype. It is not
approved as a production dependency, default runtime, installer, or release
target.

## Context

ADR-005 selected Electron as the lowest-migration-risk desktop-shell candidate
for measurement. The bounded dependency spike measured Electron 42.4.1 and
`@electron/packager` 20.0.1 outside the repository, packaged minimal macOS arm64
and Windows x64 shells, and ran the macOS shell successfully.

The minimal shell measured approximately 292 MiB unpacked / 115 MiB compressed
on macOS arm64 and 354 MiB unpacked / 141 MiB compressed on Windows x64. The
current Auto SVGA Web preview still loads `pako` and `svgaplayerweb` from a CDN,
so full offline behavior has not been demonstrated.

## Decision

1. Permit a future Electron implementation only under an isolated prototype
   boundary with explicit scripts and no default-flow integration.
2. Keep `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
   `webSecurity: true`, and `allowRunningInsecureContent: false` mandatory.
3. Allow only packaged local content and a narrow `contextBridge` API. Deny
   remote content, unexpected navigation, new windows, and generic IPC access.
4. Keep filesystem, protobuf, PNG analysis, hashing, report generation, logs,
   and cache management in the host process.
5. Retain a loopback-only, ephemeral local server for the first prototype to
   preserve Web playback behavior. Serve only a dedicated packaged root.
6. Vendor the pinned player scripts locally with license notices and integrity
   checks before any offline acceptance claim.
7. Require a clean TypeScript build and deterministic inclusion of `dist` and
   `proto/svga.proto` before packaging.
8. Keep the current browser workflow as the stable rollback and do not alter
   the default CLI, exporter, playback, import, drag/drop, or comparison flows.
9. Require native macOS and Windows smoke evidence before proposing mainline
   integration.
10. Require a new decision before Electron can become a production dependency
    or distribution target.

## Consequences

- The next prototype can test real Auto SVGA behavior without committing to a
  desktop release architecture.
- Package size is accepted only as a measured prototype cost, not as a final
  product decision.
- The repository remains free of Electron dependencies after this spike.
- Full offline status remains blocked by CDN player assets.
- Signing, notarization, installers, updates, crash upload, and production
  distribution remain out of scope.

## Rejected alternatives

### Add Electron directly to the root project

Rejected because it would enlarge the normal dependency graph and blur the
rollback boundary before offline playback and cross-platform behavior are
proven.

### Treat the successful macOS empty-shell smoke as desktop acceptance

Rejected because it does not exercise the actual player, report host, local
assets, Windows runtime, cache policy, or user-file boundary.

### Keep CDN scripts in a packaged desktop application

Rejected because it breaks offline operation, adds supply-chain and availability
risk, and allows remote runtime content into a privileged application context.
