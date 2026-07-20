# Review: Bounded Electron Dependency and Security Spike

## 1. Summary

- Mainline: P7 client readiness + P1 infrastructure.
- Measured Electron dependency, license, security, offline-asset, and package
  boundaries in a disposable directory outside the repository.
- Conditionally approved Electron only for one future isolated prototype.
- Electron remains unapproved as a production dependency, default runtime,
  installer, or release target.

## 2. Git state

- Branch: `agent/codex/electron-dependency-security-spike`
- Previous delivery commit: `e705f38ca3a4bd12553f7d31dae4d13a64b824a3`
- Working tree after previous delivery: clean
- Implementation commit: `32fec2e2615e756ee00a47da7ac3c001eb2742bb`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `docs/electron-desktop-spike.md`
- `docs/decisions/ADR-006-electron-spike-boundary.md`
- `docs/reviews/2026-06-19-codex-electron-dependency-security-spike.md`

## 4. Spike evidence

| Evidence | Result |
|---|---|
| Electron | `42.4.1`, MIT, disposable dev dependency |
| Electron Packager | `20.0.1`, BSD-2-Clause, disposable dev dependency |
| Transitive metadata | 52 unique packages, no missing license metadata |
| Dependency audit | 0 known vulnerabilities at measurement time |
| Temporary install | 322.18 MiB |
| macOS arm64 package | 292.16 MiB unpacked / 114.93 MiB compressed |
| Windows x64 package | 354.13 MiB unpacked / 141.10 MiB compressed |
| macOS local-page smoke | PASS, exit code 0 |
| Windows runtime smoke | Not run; package structure only |
| Full Auto SVGA offline smoke | Not passed; CDN assets remain in current Web page |

Current CDN assets were measured but not committed:

- `pako@2.1.0`: 46,859 bytes, MIT and Zlib.
- `svgaplayerweb@2.3.1`: 123,583 bytes, Apache-2.0.

## 5. Verification

```text
npm test
PASS: 155 tests, 0 failures

node --check tools/svga-player-preview/main.js
PASS

node --check tools/svga-player-preview/server.mjs
PASS

local Web preview HTTP smoke on 127.0.0.1:4197
PASS: preview page and /api/latest-artifact returned successfully

disposable Electron package smoke
PASS: macOS arm64 local page loaded and process exited 0

git diff --check
PASS
```

## 6. Regression and drift

- Root `package.json` and lockfile: not touched.
- SVGA exporter and output bytes: not touched.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag/drop, and comparison: not touched.
- Motion Asset Audit and report contracts: not touched.
- No desktop app, installer, updater, signing, new parser, conversion, export
  workbench, or automatic optimization was added.
- No AI, external model, multimodal, telemetry, or network analysis service was
  used.

## 7. Client readiness

- Required security baseline: isolated context, disabled Node integration,
  sandboxed renderer, restrictive CSP, local content only, narrow preload APIs,
  validated IPC, denied navigation/windows/permissions.
- First prototype may retain an ephemeral loopback server owned by the main
  process, but it must use a dedicated static root and session authorization.
- Filesystem access stays host-side; reports do not persist absolute paths.
- CDN player scripts must be vendored with notices and integrity pins before
  full offline acceptance.
- macOS empty-shell smoke passed. Windows execution, signing, SmartScreen,
  macOS notarization, universal builds, cache cleanup, and real-player parity
  remain unverified.
- The browser workflow remains the stable rollback.

## 8. Dependencies and cleanup

- Repository dependencies added: none.
- Spike dependencies were installed only in a temporary directory and removed
  after measurement.
- Removal path for the spike was deletion of that disposable directory; no
  repository cleanup is required.

## 9. Risks and next step

- Electron package size is material and requires explicit product acceptance.
- A successful empty-shell smoke does not prove SVGA playback or report parity.
- Full offline behavior remains blocked by CDN player assets.
- Next single task: isolated Electron prototype with locally vendored player
  assets, synthetic SVGA playback/report smoke, strict preload/loopback boundary,
  and native macOS plus Windows validation.

## 10. Commit and delivery state

- Implementation commit: `32fec2e2615e756ee00a47da7ac3c001eb2742bb`
- Branch: `agent/codex/electron-dependency-security-spike`
- Working tree after delivery: clean
