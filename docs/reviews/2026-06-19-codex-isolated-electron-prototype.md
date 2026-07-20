# Review: Isolated Electron prototype with local player assets and SVGA inspection smoke

## 1. Summary

- Mainline: P7 client readiness + P1 infrastructure.
- Added an isolated Electron prototype under `tools/electron-prototype/`; root scripts, dependencies, and browser workflow remain unchanged.
- Verified local vendored SVGA playback, inspection report generation, and read-only Motion Asset Audit rendering with a generated synthetic fixture.
- Electron remains a prototype only. It is not a production dependency, default runtime, installer, or release target.

## 2. Git state

- Branch: `agent/codex/electron-isolated-prototype`
- Commit before work: `d083cbe38ef6e5d07ef0731b0d4f24e503472f35`
- Implementation commit: `898a9140ac04c3f5c9e26d6453756d3a26c0bdfb`
- Working tree after delivery: clean

## 3. Changed files

- `tools/electron-prototype/`: isolated package, secure host/preload, dedicated static server, generated fixture preparation, Web surface, tests, and vendored assets.
- `docs/electron-prototype.md`: scope, security, offline behavior, dependency and package-size evidence, client assessment, rollback, and blockers.
- `docs/decisions/ADR-007-isolated-electron-prototype.md`: prototype result and production constraints.

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Isolated non-default Electron prototype | Done |
| Local `pako` and `svgaplayerweb` with versions, licenses, hashes, notices | Done |
| Synthetic SVGA playback and nonblank canvas smoke | Done |
| Inspection report and Motion Asset Audit panel smoke | Done |
| Offline/local-only resource policy | Done |
| Electron security flags and narrow preload/IPC boundary | Done |
| macOS source and packaged runtime smoke | Done |
| Windows runtime smoke | Not run; package structure only |
| Installer, update, signing, notarization, production release | Not done by design |

## 5. Verification

- Prototype tests: `npm run spike:electron:test` - 3 passed, 0 failed.
- Source Electron smoke: all six signals passed: page, playback, nonblank canvas, inspection, audit panel, local-only loading.
- Packaged macOS arm64 smoke: same six signals passed.
- Root regression: `npm test` - 155 passed, 0 failed.
- Web checks: existing preview JavaScript syntax and local server smoke passed.
- Security checks: `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`, remote navigation/windows/permissions blocked.
- Dependency audit: isolated prototype reports 0 known vulnerabilities.
- Staged diff and whitespace checks passed; no real SVGA/PNG/GIF/video asset was committed.

## 6. Dependency and package evidence

- Electron 42.4.1, MIT, prototype dev dependency.
- `@electron/packager` 20.0.1, BSD-2-Clause, prototype dev dependency.
- `fast-png` 8.0.0, MIT, prototype host runtime.
- `protobufjs` 8.6.4, BSD-3-Clause, prototype host runtime.
- Installed prototype dependencies: 327.08 MiB.
- macOS arm64 package: 297.30 MiB unpacked / 116.06 MiB compressed.
- Windows x64 package: 359.27 MiB unpacked / 142.22 MiB compressed; runtime not executed.
- Removal: delete `tools/electron-prototype/`; no root dependency or default script rollback is needed.

## 7. Regression and drift

- Not touched: SVGA exporter, Web player implementation, CLI default flow, import, drag-drop, comparison, report contract, and root package scripts.
- Browser workflow remains the rollback path.
- No AI, external model, multimodal capability, telemetry, or network analysis service was added.
- Generated fixture, runtime copies, dependencies, and packages are ignored and not committed.

## 8. Client assessment and risks

- macOS: isolated source and packaged arm64 runtime verified offline with local assets.
- Windows: package generated and identified as PE32+ x86-64; native runtime parity remains unverified.
- Privacy: reports do not persist absolute paths; logs redact common local paths; telemetry is disabled.
- Filesystem/cache: host boundary is explicit; session data uses a per-process temporary directory and is removed on exit.
- Primary blocker: `svgaplayerweb@2.3.1` requires CSP `unsafe-eval`; this is not an acceptable production baseline.
- Root pnpm currently resolves `protobufjs` 8.5.0; its advisory review is deferred to a separate dependency-maintenance task to avoid changing protected CLI/export paths here.
- Signing, notarization, installer/update policy, persistent diagnostics, and product acceptance of package size remain open.

## 9. Next step

- Run a bounded player/CSP compatibility decision before any installer or production shell work.

## 10. Commit

- Commit: `898a9140ac04c3f5c9e26d6453756d3a26c0bdfb`
- Branch: `agent/codex/electron-isolated-prototype`
- Tag: none
