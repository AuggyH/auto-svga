# Desktop Shell Feasibility for Auto SVGA Workbench

Date: 2026-06-19
Status: Feasibility conclusion. No desktop dependency or runtime integration is approved by this document.

## 1. Scope

This spike evaluates how the current local Web preview and inspection host could
be placed inside a distributable desktop shell. It does not implement a desktop
application, installer, updater, signing flow, or new motion-format capability.

The bounded desktop MVP would only:

- open the existing Web preview;
- select or drag a local SVGA file;
- play the existing SVGA preview;
- display the existing inspection report;
- display the read-only Motion Asset Audit panel;
- keep inspection local, offline, deterministic, and explainable.

It would not add multi-format parsing, conversion, an export workbench,
automatic repair, cloud sync, accounts, automatic updates, or a production
installer release.

## 2. Current architecture findings

### Reusable core

The inspection path is already split at a useful host boundary:

- `src/workbench/inspection-service.ts` consumes `MotionAssetSource` and a
  format adapter without Node, DOM, Canvas, browser, or filesystem APIs.
- `src/workbench/avatar-frame-inspection-report.ts` composes deterministic
  report, audit, memory, sequence, and policy metadata without UI logic.
- Audit presentation and localization contracts are host-neutral and can be
  rendered by Web, macOS, or Windows hosts.
- `src/hosts/avatar-frame-inspection.ts` is an explicit Node composition root
  for protobuf inspection, PNG alpha analysis, and hashing.

The Web renderer does not recalculate inspection findings. It sends bytes to a
host endpoint and renders the returned report, so business logic has not leaked
into the Web UI.

### Host-specific boundaries

The current validation page depends on a Node host:

- `tools/svga-player-preview/server.mjs` serves static files, discovers
  repository artifacts, reads the filesystem, and exposes the inspection API.
- The server imports `dist/hosts/avatar-frame-inspection.js`; a current, clean
  TypeScript build is therefore a runtime prerequisite for inspection.
- `src/workbench/svga/node-protobuf-inspector.ts` uses Node zlib and resolves
  `proto/svga.proto` from the filesystem.
- `tools/svga-player-preview/inspection-report-view.mjs` imports compiled
  workbench modules from `dist/`.
- The Web page currently loads `pako` and `svgaplayerweb` from jsDelivr. This
  prevents a truthful offline desktop claim until those approved browser assets
  are packaged locally.

The current server is a development host, not a package-ready security
boundary. Its repository-root scanning and broad static-file assumptions must
not be carried unchanged into a distributed application.

## 3. Options

| Option | Fit with current code | Main benefit | Main cost | Conclusion |
|---|---|---|---|---|
| Electron | High | Existing TypeScript, Node host, HTTP bridge, and browser UI transfer with the least initial rewrite | Bundles Chromium and Node; security and package size need active control | Recommended for one isolated desktop MVP prototype |
| Tauri 2 | Medium | Smaller shell potential and explicit capability model | Rust toolchain, system WebView differences, and a new command/sidecar bridge increase migration and test work | Defer until the host API is stable and cross-WebView playback is proven |
| Local server + external browser | Current baseline | Lowest engineering risk and remains useful for development | Weak distribution, lifecycle, permissions, and diagnostics experience | Keep as the stable fallback, not the final client shell |
| Other lightweight shells | Unproven | May reduce shell footprint | Adds another bridge and ecosystem without a demonstrated advantage for the current Node stack | Do not pursue in the MVP spike |

Package-size claims must be measured with a real prototype. This document does
not infer an installed size from npm package metadata.

## 4. Recommendation

Use Electron for the next **isolated feasibility prototype**, subject to a
separate dependency and license approval task. This is not approval to add
Electron to the production dependency graph.

Electron is the shortest path because the current host already uses Node HTTP,
filesystem, zlib, protobuf, and compiled TypeScript modules. The prototype can
preserve the known-good Web playback path while proving desktop lifecycle and
file-access boundaries. Tauri should be reconsidered after the renderer-to-host
contract is narrow and stable; at that point package-size savings can be weighed
against Rust bridge maintenance and platform WebView playback parity.

The existing local-server/browser workflow remains the rollback and development
baseline throughout the prototype.

## 5. Proposed desktop MVP boundary

```text
Desktop main process
  app lifecycle | loopback server lifecycle | file picker | logs | cache cleanup
          |
          | narrow, typed host boundary
          v
Node inspection host
  SvgaFormatAdapter | protobuf inspector | PNG alpha analyzer | report service
          |
          | structured report only
          v
Sandboxed renderer
  existing Web preview | SVGA playback | read-only inspection and audit views
```

Renderer rules:

1. Disable direct Node access in the renderer.
2. Use context isolation and a narrow preload/IPC contract if IPC is added.
3. Do not expose raw filesystem APIs, arbitrary paths, shell execution, or the
   complete Node environment to Web code.
4. Keep inspection, hashing, protobuf loading, and PNG analysis host-side.
5. Keep report rendering read-only and driven by the existing contracts.

### Local server decision

Retain a loopback HTTP server for the first prototype because it preserves the
current player loading and report request behavior with the smallest regression
surface. The desktop main process must own server startup, an ephemeral port,
readiness, shutdown, and failure reporting. It must bind only to loopback.

The packaged host must serve a dedicated application asset root, not the whole
repository. Artifact discovery should become an explicit user-selected
workspace boundary. A later task may replace the inspection HTTP endpoint with
a typed IPC bridge, but that migration is not required to prove the first shell.

## 6. Required architecture changes before a prototype can be called offline

1. Vendor approved `pako` and `svgaplayerweb` browser assets locally after
   license and redistribution review; remove runtime CDN dependence.
2. Define a clean desktop build that packages the Web assets, required `dist/`
   modules, and `proto/svga.proto` together.
3. Make a clean build mandatory before packaging so stale `dist` cannot shadow
   TypeScript source changes.
4. Replace repository-root scanning with explicit workspace or file selection.
5. Add a narrow file-access contract. The renderer should receive bytes,
   approved file tokens, or structured results rather than unrestricted paths.
6. Add application-owned log, cache, and temporary-directory policies.
7. Preserve the external-browser workflow as a rollback path during migration.

## 7. Client-readiness assessment

### macOS

- The current TypeScript and Node inspection code can run locally in an
  Electron host without a platform service.
- Distribution will eventually require code signing, hardened-runtime review,
  notarization, and a deliberate file-access entitlement strategy.
- Drag/drop and file selection must use user-authorized files; no broad disk
  crawling should be introduced.

### Windows

- The same Node host composition is reusable, but path handling must remain
  based on `path` and file URLs rather than POSIX string assumptions.
- Distribution will eventually require code signing and SmartScreen reputation
  planning.
- System WebView variability is a larger Tauri concern and must be tested with
  real SVGA playback before choosing it for size reasons.

### Offline behavior and privacy

- Inspection, alpha analysis, hashing, audit, and report generation are already
  local and deterministic.
- The current CDN scripts are the only identified blocker to an offline Web
  payload and must be packaged locally before an offline claim.
- User SVGA files, embedded images, reports, paths, and logs must never leave the
  device. No AI, model, telemetry, or network analysis service is required.

### Filesystem, cache, and temporary data

- Filesystem access stays in the desktop host.
- Cache and temporary files should use application-specific system directories,
  have size limits, and be cleaned on startup/normal shutdown with recovery for
  interrupted sessions.
- The first MVP should avoid persistent copies of user assets unless the user
  explicitly saves a workspace.

### Logs and diagnostics

- Add rotating local logs with path and user-content redaction.
- Record shell startup, local-server readiness, report errors, and player load
  failures without embedding source bytes.
- Provide an explicit user action to export diagnostics in a later task; do not
  upload logs automatically.

### Dependencies and distribution

- No desktop or native dependency is added by this spike.
- Current inspected runtime dependencies are `fast-png` (MIT) and `protobufjs`
  (BSD-3-Clause); a desktop package must preserve their notices.
- Electron/Tauri licenses, transitive dependencies, packaged size, native
  modules, and redistribution terms require a dedicated bounded spike before
  adoption.
- Exact package and installer sizes remain unknown until measured from a real
  macOS and Windows prototype.

## 8. Risk register

| Risk | Impact | Required mitigation |
|---|---|---|
| CDN playback assets | Desktop is not offline | Vendor approved assets and test playback without network |
| Stale `dist` | Source and packaged behavior diverge | Clean build in packaging pipeline; package generated output from that build only |
| Broad local server root | Unintended local file exposure | Dedicated static root, explicit workspace grants, loopback-only binding |
| Renderer Node access | Local file and code-execution exposure | Sandboxed renderer, context isolation, narrow bridge |
| Electron package size | Larger download and disk footprint | Measure prototype; package only required assets; reconsider Tauri after parity evidence |
| System WebView variation in Tauri | Playback differs across macOS/Windows | Real-player smoke matrix before adoption |
| Cache/temp growth | Disk usage and privacy residue | App-owned paths, quotas, cleanup, no implicit permanent copies |
| Weak diagnostics | Desktop failures become opaque | Local rotating logs, redaction, explicit diagnostic export |
| Signing/notarization | Release friction or trust warnings | Treat as a later release workstream, not part of shell MVP |

## 9. Recommended next task

Run a bounded **Electron dependency, security, and package-size spike** without
changing the stable Web or CLI flows. It should package local playback assets,
start the existing server on an ephemeral loopback port, open one sandboxed
window, inspect one synthetic SVGA fixture, measure macOS/Windows package size,
and document licenses. The prototype must remain isolated until playback,
offline, security, and cleanup checks pass.

Primary references for that spike:

- Electron process model: <https://www.electronjs.org/docs/latest/tutorial/process-model>
- Electron security guidance: <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron context isolation: <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- Tauri process model: <https://v2.tauri.app/concept/process-model/>
- Tauri capabilities: <https://v2.tauri.app/security/capabilities/>
- Tauri prerequisites: <https://v2.tauri.app/start/prerequisites/>
