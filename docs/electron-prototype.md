# Isolated Electron Prototype

Date: 2026-06-19
Status: Runtime parity spike passed on macOS arm64. Production approval remains blocked.

## 1. Scope

The prototype proves that an isolated Electron host can run the current local
SVGA player assets, inspect a synthetic SVGA through the existing report
service, and render the read-only Motion Asset Audit panel without changing the
browser workflow.

It is not a production desktop client, default command, installer, updater,
signed build, notarized build, export workbench, converter, or new format
implementation.

## 2. Isolation boundary

All prototype files live under `tools/electron-prototype/` with a dedicated
`package.json` and `package-lock.json`. The root package scripts and dependency
graph are unchanged.

Explicit commands:

```bash
cd tools/electron-prototype
npm install
npm run spike:electron:test
npm run spike:electron:smoke
npm run spike:electron:package:mac
npm run spike:electron:package:win
```

Generated paths are ignored:

- `node_modules/`
- `.runtime/`
- `.artifacts/`

`spike:electron:prepare` runs the root TypeScript build, copies the resulting
`dist`, `proto/svga.proto`, and the existing read-only inspection renderer into
`.runtime`, verifies vendor hashes, and generates a 300 x 300 synthetic SVGA.
No user asset is committed.

## 3. Reused and isolated behavior

Reused unchanged:

- `dist/hosts/avatar-frame-inspection.js` and its host-neutral inspection
  primitives;
- the existing `inspection-report-view.mjs` read-only renderer;
- the current pinned pako and SVGAPlayer-Web versions;
- the standard `proto/svga.proto` contract.

Prototype-specific:

- Electron main/preload lifecycle;
- dedicated loopback server and static allowlist;
- synthetic fixture generation;
- local vendor copies and notices;
- minimal parity page and smoke IPC;
- temporary cache and session cleanup.

The primary Web preview, its layout, player implementation, import, drag/drop,
comparison behavior, and server remain unchanged.

## 4. Offline player assets

The prototype vendors only its own copies:

| Asset | Version | License | Bytes | SHA-256 |
|---|---:|---|---:|---|
| pako | 2.1.0 | MIT and Zlib | 46,859 | `ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907` |
| SVGAPlayer-Web | 2.3.1 | Apache-2.0 | 123,583 | `3e8cb9a59e17a9b0861298eacc4beba79895ebd7178d97669687af07212509b6` |

Source links, notices, and license copies are in
`tools/electron-prototype/vendor/NOTICE.md`. Runtime preparation rejects a hash
mismatch. The prototype page contains no CDN URL, and Electron cancels every
network request outside its own loopback origin.

## 5. Synthetic SVGA and report parity

The preparation script creates a 16,941-byte SVGA with:

- 300 x 300 canvas;
- 24 FPS;
- 24 frames;
- one generated 80 x 80 RGBA PNG resource;
- one moving sprite.

The fixture is generated under ignored `.runtime/fixture/`. Smoke verification
requires all of the following:

- local page loaded;
- SVGA parser/player started;
- player canvas contains visible pixels;
- inspection report contract version 1 returned;
- Motion Asset Audit presentation rendered;
- all browser resources use the loopback origin.

Source-mode and packaged macOS smoke both returned all six fields as `true`.
The report contains an in-memory display name and does not persist an absolute
path.

## 6. Security boundary

Enabled explicitly:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- denied permission requests;
- denied new windows;
- denied navigation outside the current origin;
- one narrow preload method for smoke result reporting;
- validated IPC sender and payload;
- randomized report token;
- loopback-only ephemeral server;
- dedicated static route allowlist;
- no telemetry or remote crash upload.

Filesystem, protobuf inspection, PNG analysis, hashing, report generation, and
fixture access remain host-side. The renderer receives local HTTP bytes and a
structured report, not filesystem authority.

### CSP blocker

SVGAPlayer-Web 2.3.1 contains one dynamic `eval` path. A strict
`script-src 'self'` policy prevented parsing. The isolated prototype therefore
uses `script-src 'self' 'unsafe-eval'` while still forbidding remote content.
Electron correctly emits its insecure-CSP warning in source-mode smoke.

This exception is a **production blocker**. It must not be silently carried into
a distributable client. A follow-up must evaluate a CSP-compatible local player
build, a maintained replacement, or a narrower isolated playback process before
production approval.

## 7. Dependencies and audit

| Dependency | Version | Scope | License |
|---|---:|---|---|
| Electron | 42.4.1 | prototype dev dependency | MIT |
| `@electron/packager` | 20.0.1 | prototype dev dependency | BSD-2-Clause |
| fast-png | 8.0.0 | prototype host runtime | MIT |
| protobufjs | 8.6.4 | prototype host runtime | BSD-3-Clause |

`protobufjs` was raised from the initially tested 8.5.0 to 8.6.4 because npm
reported GHSA-f38q-mgvj-vph7 against 8.5.0. The final prototype audit reports
zero known vulnerabilities. The root dependency declaration and lockfile were
not changed. The root pnpm installation still resolves `protobufjs` 8.5.0;
reviewing that advisory belongs to a separate dependency-maintenance task so
this prototype does not alter the protected CLI/export dependency graph.

Removal: delete `tools/electron-prototype/`. No root dependency or default
script requires rollback.

## 8. Package-size measurement

Measured on macOS 15.5 arm64 with Node.js 22.22.3:

| Measurement | Result |
|---|---:|
| prototype `node_modules` | 327.08 MiB |
| prepared runtime | 0.75 MiB |
| vendored player assets and notices | 0.19 MiB |
| macOS arm64 package | 297.30 MiB unpacked / 116.06 MiB compressed |
| Windows x64 package | 359.27 MiB unpacked / 142.22 MiB compressed |

The macOS packaged app passed the full six-field smoke. The Windows artifact is
a valid PE32+ x64 executable but was not run on Windows. These are prototype
measurements, not installer or production download sizes.

## 9. Local server, cache, logs, and privacy

- The main process owns server startup, readiness, ephemeral port, and shutdown.
- Static routes are limited to prototype Web files, vendor assets, prepared
  `dist`, the shared report renderer, and the synthetic fixture.
- Report POST requires a randomized token and retains the existing 25 MiB limit.
- Electron user/session data is redirected to a per-process temporary directory
  and removed at exit.
- Prototype diagnostics are console-only and redact common local absolute-path
  forms. No user bytes or report payloads are logged.
- No analytics, telemetry, AI service, model, multimodal service, or external
  network analysis is used.

An actual client still needs rotating local logs, interrupted-session cleanup,
quota tests, and explicit diagnostic export design.

## 10. Platform status and rollback

### macOS

- Source and packaged arm64 smoke: passed.
- Signing, notarization, hardened runtime, Intel/universal builds: not run.

### Windows

- x64 package structure: produced.
- Native playback, paths, drag/drop, Defender, SmartScreen, signing: not run.

### Rollback

The browser workflow remains independent. Removing
`tools/electron-prototype/`, this document, ADR-007, and the associated review
fully removes the prototype without changing root scripts or dependencies.

## 11. Decision and blockers

The isolated runtime parity experiment passed on macOS. Electron is still not
approved for production or default use.

Production blockers:

1. SVGAPlayer-Web requires CSP `unsafe-eval`.
2. Windows native runtime parity is unverified.
3. macOS signing/notarization and Windows signing are unverified.
4. Package size needs product acceptance.
5. Persistent cache, logs, crash recovery, and file-dialog boundaries are not
   production hardened.
6. No installer or update policy exists.

The next task should be a bounded player-CSP compatibility decision. Do not add
installer or production shell work until the `unsafe-eval` blocker has an
accepted resolution.
