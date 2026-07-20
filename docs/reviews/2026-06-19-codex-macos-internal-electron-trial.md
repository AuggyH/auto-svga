# Review: macOS internal Electron trial package

## 1. Summary

Built a bounded macOS arm64 unsigned internal Electron prototype package under ADR-011.

This is an internal prototype only. It is not a production desktop client, not an installer, not signed, not notarized, and not approved for external distribution.

## 2. Git state

- Branch: `agent/codex/macos-internal-electron-trial`
- Implementation commit: `d9e1515a8433be84057d401ab893b1c1d1a08801`
- Artifacts: generated under ignored `.artifacts/internal-trial/`
- Real user assets: not committed

## 3. Changed files

- `docs/internal-electron-trial-package.md`
- `tools/electron-prototype/experiments/svga-web/README.md`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `tools/electron-prototype/experiments/svga-web/server.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/prototype.js`
- `tools/electron-prototype/experiments/svga-web/web/styles.css`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| macOS arm64 unsigned internal prototype package | Done |
| Use isolated `svga-web@2.4.4` candidate | Done |
| Do not replace main Web preview player | Done |
| Do not change root default entry | Done |
| Do not touch exporter or CLI default flow | Done |
| Local-only vendored player and page assets | Done |
| Visible internal prototype / non-production / internal testing label | Done |
| File picker and drag-drop SVGA smoke | Done |
| Inspection report and Motion Asset Audit smoke | Done |
| No generic `unsafe-eval` | Done |
| Minimal `wasm-unsafe-eval` exception documented | Done |
| No DMG, signing, notarization, auto-update, or installer | Done |
| Do not commit binary artifact | Done |

## 5. Verification

Commands run and results:

```text
node --check tools/electron-prototype/experiments/svga-web/main.cjs
node --check tools/electron-prototype/experiments/svga-web/preload.cjs
node --check tools/electron-prototype/experiments/svga-web/server.mjs
node --check tools/electron-prototype/experiments/svga-web/web/prototype.js
node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs
Result: pass

npm run spike:svga-web:test
Result: pass, 4 tests / 0 failed

npm run spike:svga-web:smoke
Result: pass; local page, local-only loading, restricted CSP with internal-only wasm exception, playback, nonblank canvas, inspection report, Audit panel, file input, drag/drop, error file, lifecycle, cleanup

npm run internal:trial:package:mac
Result: pass; generated .app, .zip, and manifest

.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64/AutoSVGAInternalPrototype.app/Contents/MacOS/AutoSVGAInternalPrototype --smoke
Result: pass; packaged runtime smoke matched source smoke

node manifest validation
Result: pass; buildCommit, CSP, security flags, sizes, sha256, productionApproved=false

find /tmp -maxdepth 1 -type d -name 'auto-svga-svga-web-spike-*' -print
Result: pass; no stale runtime temp directory found

node --check tools/svga-player-preview/main.js
node --check tools/svga-player-preview/server.mjs
Result: pass

Web preview local server smoke
Result: pass; page 200, API 200, artifacts returned

npm test
Result: pass; 155 tests / 0 failed

git diff --check
Result: pass
```

## 6. Artifacts

- App: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64/AutoSVGAInternalPrototype.app`
- Zip: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64.zip`
- Manifest: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json`
- Package size: `286192128` bytes
- Archive size: `118494128` bytes
- SHA-256: `0d49cf474ca1d51ceef89f246f0696891946f3497a073742a0eb241aea4bd119`
- Manifest build commit: `d9e1515a8433be84057d401ab893b1c1d1a08801`
- Production approved: `false`

## 7. Security

- CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
- Generic `unsafe-eval`: not present
- `wasm-unsafe-eval`: present only for the `svga-web` candidate player path
- `contextIsolation`: `true`
- `nodeIntegration`: `false`
- `sandbox`: `true`
- Remote navigation: blocked
- New windows: blocked
- Permissions: denied
- Telemetry: not enabled
- Arbitrary file serving: not provided
- Absolute path persistence: not allowed by manifest and smoke checks

## 8. Regression

- SVGA exporter: not touched
- Main Web preview player implementation: not touched
- CLI default flow: not touched
- Browser import, drag-drop, comparison: not touched
- Root default scripts: not changed
- Browser workflow rollback: preserved via `npm run local:preview`

## 9. Dependencies

- Existing isolated dependency: `electron@42.4.1`, MIT, prototype scope
- Existing isolated player dependency: `svga-web@2.4.4`, MIT, candidate prototype scope
- No new root production dependency added
- Removal path: delete `tools/electron-prototype/experiments/svga-web/` and ignored `.artifacts/internal-trial/`

## 10. Risks

- `wasm-unsafe-eval` remains an internal prototype exception only, not a production desktop baseline.
- App is unsigned and not notarized; macOS Gatekeeper friction is expected.
- Windows runtime was not verified in this round.
- Smoke uses synthetic SVGA; this does not prove full player parity for all real-world SVGA assets.
- Electron emitted a Node deprecation warning during packaged smoke; it did not fail runtime smoke.

## 11. Next steps

- Run internal macOS trial with a small controlled set of real local SVGA samples.
- Record any playback parity issues against the browser workflow baseline.
- Keep production desktop release frozen until the `wasm-unsafe-eval` boundary is reviewed again.
