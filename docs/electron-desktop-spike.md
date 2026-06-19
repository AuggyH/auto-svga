# Bounded Electron Desktop Spike

Date: 2026-06-19
Status: Electron is conditionally suitable for an isolated prototype. It is not
approved as a production dependency or default runtime.

## 1. Scope and outcome

This spike measured Electron installation and minimal package size, checked its
security boundary, and audited the current Web preview's offline blockers. The
experiment ran in a disposable directory outside the repository. No Electron
package, desktop entry point, package script, lockfile, or runtime code was
added to Auto SVGA.

Outcome:

- **Proceed only to an isolated prototype** if the conditions in this document
  are accepted.
- Keep the current local-server/browser workflow as the stable rollback.
- Do not connect Electron to the CLI, exporter, Web preview default flow, or
  production report contract.
- Do not call the desktop path offline until the current CDN assets are vendored
  and the full preview passes a network-disabled smoke test.

## 2. Reproducible measurement profile

Environment:

- macOS 15.5, arm64
- Node.js 22.22.3
- npm 10.9.8, used only in the disposable spike because `pnpm` and Corepack
  were unavailable in the current shell
- measurement date: 2026-06-19

Exact spike dependencies:

| Package | Version | Scope | License | Repository impact |
|---|---:|---|---|---|
| `electron` | 42.4.1 | disposable spike dev dependency | MIT | none |
| `@electron/packager` | 20.0.1 | disposable spike dev dependency | BSD-2-Clause | none |

The temporary dependency tree contained 52 unique packages. License metadata
was present for every package:

- MIT: 36
- BSD-2-Clause: 4
- Apache-2.0: 2
- BlueOak-1.0.0: 5
- ISC: 5

`npm audit --audit-level=high --omit=optional` reported zero known
vulnerabilities at measurement time. This is point-in-time evidence, not a
long-term security guarantee.

Removal path: delete the disposable spike directory. The repository has no
Electron dependency or generated desktop artifact to remove.

## 3. Package-size measurements

The measured application contained one local HTML file, one main-process file,
and one minimal preload bridge. It did not contain the Auto SVGA Web preview,
inspection host, `dist`, protobuf schema, or vendored player assets.

| Measurement | Result |
|---|---:|
| temporary `node_modules` install | 322.18 MiB |
| downloaded Electron runtime | 292.26 MiB |
| macOS arm64 unpacked app | 292.16 MiB |
| macOS arm64 compressed zip | 114.93 MiB |
| Windows x64 unpacked app | 354.13 MiB |
| Windows x64 compressed zip | 141.10 MiB |

Verification:

- The packaged macOS arm64 executable loaded local HTML and exited cleanly in
  hidden smoke mode with exit code 0.
- The Windows x64 artifact was emitted as a valid PE32+ GUI executable, but it
  was not executed on Windows. Windows runtime behavior remains unverified.
- A real Auto SVGA package will be larger because it must include the preview,
  compiled host modules, protobuf schema, player assets, notices, logs, and
  packaging metadata.

Distribution impact is material. Electron remains reasonable for an internal
or early MVP prototype, but installer size must be treated as an explicit
product tradeoff. No final macOS or Windows download-size claim can be made from
this empty-shell measurement.

## 4. Required security boundary

Every prototype window must explicitly set:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  preload: approvedPreloadPath
}
```

Additional requirements:

1. Load only packaged local content. Remote pages, remote scripts, and arbitrary
   navigation are forbidden.
2. Deny new windows and unexpected navigation.
3. Use a restrictive CSP with `default-src 'self'`, `script-src 'self'`, no
   plugins, no remote origins, and only the exact loopback origin needed by the
   host.
4. Expose one method per approved preload action through `contextBridge`.
   Never expose raw `ipcRenderer`, filesystem, shell, process execution, or a
   generic channel dispatcher.
5. Validate the sender, payload type, size, and operation for every IPC request.
6. Deny permission requests by default.
7. Do not call `shell.openExternal` with untrusted content.
8. Keep DevTools disabled in distributable builds unless explicitly enabled by
   a diagnostic mode.

The disposable smoke used all listed window flags, a local-only CSP, a frozen
preload object, denied new windows, and blocked navigation. It did not expose a
file dialog or production IPC implementation.

## 5. Local server and filesystem boundary

### First isolated prototype

Retain the existing Node HTTP host for the first prototype to preserve current
playback and report behavior, with these changes isolated to the prototype:

- bind only to `127.0.0.1` on an ephemeral port;
- let the main process own startup, readiness, shutdown, and crash recovery;
- serve a dedicated packaged static root, never the repository root;
- use a per-session unguessable token for privileged report requests;
- retain request-size limits and reject non-loopback clients;
- expose the selected origin to CSP rather than allowing arbitrary network
  access.

The browser workflow and its current server remain unchanged outside the
prototype.

### Local files

- Preserve browser drag/drop behavior.
- A future Electron file dialog must run in the main process.
- The renderer should receive approved bytes, a short-lived opaque file token,
  or a structured report. It must not receive unrestricted filesystem access.
- Host paths must use platform path APIs and must not be persisted into report
  JSON. User-facing reports keep relative or display-only names.
- Workspace scanning requires explicit user selection; no implicit disk or home
  directory scan is permitted.

## 6. Offline assets

The current preview loads two pinned scripts from jsDelivr:

| Current asset | Pinned version | License | Downloaded browser file |
|---|---:|---|---:|
| `pako` | 2.1.0 | MIT and Zlib | 46,859 bytes |
| `svgaplayerweb` | 2.3.1 | Apache-2.0 | 123,583 bytes |

Combined browser payload: 170,442 bytes. The exact files were downloaded and
hashed during the spike but were not committed. A future prototype must vendor
approved copies, preserve notices, pin integrity hashes, and load them only from
the packaged application.

Minimum offline smoke acceptance:

1. Disable network access before launching the packaged app.
2. Load the complete existing preview without external requests.
3. Select and drag a synthetic local SVGA fixture.
4. Play the SVGA through the existing player implementation.
5. Display the specification report and read-only Motion Asset Audit panel.
6. Confirm no console error and no attempted remote request.

This spike proved only that Electron can load a minimal packaged local page.
The full Auto SVGA offline smoke is **not yet passed** because the repository's
Web preview still references CDN scripts.

## 7. Build and stale-output policy

The inspection endpoint imports compiled modules from `dist`, and the report
view also imports compiled workbench modules. A desktop package must therefore:

1. start from a clean checkout;
2. run the normal TypeScript build immediately before packaging;
3. package only `dist` produced by that build;
4. include `proto/svga.proto` at a deterministic packaged location;
5. fail packaging when source is newer than required build output;
6. record an application build identifier in diagnostics.

The prototype must not make stale repository `dist` an implicit source of
truth.

## 8. Logs, cache, privacy, and crash behavior

- No telemetry or remote crash upload by default.
- Logs remain local in the platform application log directory.
- Redact home directories, absolute asset paths, file names where unnecessary,
  report payloads, embedded image keys that contain user data, and source bytes.
- Record only lifecycle, host readiness, request identifiers, bounded error
  codes, player load status, and build identifiers.
- Cache and temporary files use application-owned platform directories with a
  quota and cleanup on startup and normal shutdown.
- Interrupted sessions must be recoverable without retaining user assets
  indefinitely.
- Diagnostic export must be an explicit user action and should show what will
  be included before writing a bundle.

All current inspection and audit logic remains local and deterministic. No AI,
model, telemetry, multimodal, or network analysis service is needed.

## 9. Platform and release risks

### macOS

- The measured arm64 shell runs locally.
- Hardened runtime, signing, notarization, entitlements, quarantine behavior,
  and Intel/universal packaging remain untested and outside this spike.

### Windows

- A Windows x64 package can be produced from macOS, but execution, drag/drop,
  path handling, Defender, and SmartScreen behavior require a real Windows host.
- Code signing and installer behavior remain outside this spike.

### Shared risks

- Electron increases download and disk size substantially.
- Browser engine/security updates become an application maintenance duty.
- Loopback lifecycle, CSP origin handling, file tokens, cache cleanup, and log
  redaction require dedicated tests before distribution.
- Player and inspection parity must be demonstrated with synthetic fixtures;
  binary packaging alone does not prove visual playback.

## 10. Rollback and decision

Rollback remains immediate because the repository has no Electron dependency or
entry point. The current `npm test`, CLI, exporter, local server, and browser
preview continue to operate independently.

Decision: **conditionally approve Electron for one isolated prototype only**.
Do not approve it as a production dependency, default command, installer, or
release target. The isolated prototype must pass full offline playback, report,
security-boundary, cache cleanup, macOS, Windows, and measured package checks
before any mainline integration proposal.

## 11. Primary references

- Electron security checklist: <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron context isolation: <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- Electron sandboxing: <https://www.electronjs.org/docs/latest/tutorial/sandbox>
- Electron process model: <https://www.electronjs.org/docs/latest/tutorial/process-model>
- Electron npm metadata: <https://www.npmjs.com/package/electron/v/42.4.1>
- Electron Packager npm metadata: <https://www.npmjs.com/package/@electron/packager/v/20.0.1>
