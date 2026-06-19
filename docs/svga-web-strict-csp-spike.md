# svga-web Strict-CSP Playback Parity Spike

## Summary

This spike evaluated `svga-web@2.4.4` as an isolated Electron prototype player candidate. It did not replace the current Web preview player, did not change the SVGA exporter, and did not change the CLI or Motion Asset Audit contracts.

Result: **functional synthetic playback parity passed, strict-CSP production acceptance failed**.

The candidate loads locally, plays the synthetic SVGA fixture, produces a nonblank canvas, generates the avatar-frame inspection report, and renders the read-only Motion Asset Audit panel. However, Chromium reports a CSP violation:

```text
script-src wasm-eval
```

The published `svga-web@2.4.4` bundle has no static `eval(` or `Function(` matches, but it contains a `long.js` WebAssembly fast path:

```text
new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(...)))
```

Under the current Electron security baseline, this means `svga-web@2.4.4` is **not approved** as a production desktop player.

## Scope

Changed only isolated spike assets under:

- `tools/electron-prototype/experiments/svga-web/`
- this document
- `docs/decisions/ADR-009-svga-web-strict-csp-parity.md`

Not touched:

- main Web preview player implementation
- SVGA exporter
- CLI default flow
- import, drag-drop, comparison
- report contract
- Motion Asset Audit logic

## Candidate

- Package: `svga-web`
- Version: `2.4.4`
- License: MIT
- Runtime dependencies declared by package: none
- Vendored candidate asset: `tools/electron-prototype/experiments/svga-web/vendor/svga-web-2.4.4.js`
- Vendored asset size: 195,169 bytes
- SHA-256: `6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50`
- Static scan: zero `eval(`, zero `Function(`

## Isolated Prototype

The spike adds an isolated Electron experiment with:

- strict CSP without `unsafe-eval`
- local vendored `svga-web` asset
- local synthetic SVGA fixture from the existing Electron prototype preparation flow
- local inspection report API boundary
- existing read-only Motion Asset Audit report renderer
- security checks for Electron shell settings

Security baseline:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- remote navigation blocked
- new windows blocked
- permission requests denied
- local-only server routes
- token-bound inspection report API

Current CSP:

```text
default-src 'self';
script-src 'self';
worker-src 'self' blob:;
style-src 'self';
img-src 'self' data: blob:;
media-src 'self' blob:;
connect-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none'
```

No `unsafe-eval` is present. `worker-src blob:` is required because `svga-web` creates a blob worker for parsing.

## Smoke Result

macOS source runtime:

| Check | Result |
| --- | --- |
| Local page load | Pass |
| Local-only player asset loading | Pass |
| Strict CSP without `unsafe-eval` | Pass |
| CSP violation free | Fail: `wasm-eval` |
| Synthetic SVGA playback | Pass |
| Nonblank canvas | Pass |
| Inspection report | Pass |
| Motion Asset Audit panel | Pass |
| Player lifecycle cleanup | Pass |

macOS packaged runtime:

| Check | Result |
| --- | --- |
| Local page load | Pass |
| Local-only player asset loading | Pass |
| Strict CSP without `unsafe-eval` | Pass |
| CSP violation free | Fail: `wasm-eval` |
| Synthetic SVGA playback | Pass |
| Nonblank canvas | Pass |
| Inspection report | Pass |
| Motion Asset Audit panel | Pass |
| Player lifecycle cleanup | Pass |

Windows package structure:

- Generated for structure and size measurement.
- Runtime smoke: **Not run** on this macOS host.

## Package Size Measurements

Approximate local measurements:

| Item | Size |
| --- | ---: |
| Vendored `svga-web` asset folder | 200 KiB |
| Experiment runtime subset | 768 KiB |
| macOS packaged app directory | 299,892 KiB |
| Windows packaged app directory | 363,348 KiB |
| Combined artifact directory | 663,240 KiB |

These sizes are prototype estimates, not release packaging targets.

## Parity Notes

API integration differences:

- `svga-web` uses ESM imports and explicit `Parser` / `Player` classes.
- Existing `svgaplayerweb` usage is global-script oriented in the older prototype.

Playback lifecycle differences:

- `svga-web` uses `parser.do(arrayBuffer)`, `player.mount(movie)`, `player.start()`, `pause()`, `resume()`, and `destroy()`.
- The spike verified start, pause, resume, and destroy on the synthetic fixture.

Canvas / DOM differences:

- `svga-web` renders to a canvas passed to `new Player(canvas)`.
- Nonblank output was verified with a canvas pixel smoke.

Event / callback differences:

- The spike did not validate rich timeline events.
- Only minimal lifecycle parity was tested.

Error handling differences:

- Decode and playback failures are caught and surfaced in the isolated page.
- The inspection report API returns structured errors without persisting absolute paths.

Asset loading differences:

- `svga-web` was loaded only from local vendored assets.
- No CDN runtime load is required in the isolated experiment.

Compatibility risks:

- `wasm-eval` CSP violation blocks production strict-CSP approval.
- The package appears unofficial and has single-maintainer risk.
- Broader SVGA corpus playback parity remains unverified.

## Security Assessment

Pass:

- No static `eval(` or `Function(` in vendored player asset.
- No remote CDN player loading.
- Electron isolation settings are enabled.
- Local report API uses a narrow token-bound host boundary.

Fail / blocker:

- Runtime CSP violation: `script-src wasm-eval`.
- Allowing `wasm-unsafe-eval` or equivalent is a separate security decision and is not approved by this spike.

## Client Readiness

macOS:

- Source and packaged runtime smoke both reproduced functional playback and report rendering.
- Both also reproduced the `wasm-eval` CSP violation.

Windows:

- Package structure was generated.
- Runtime was not executed on Windows in this round.

Offline behavior:

- Player asset is local.
- Synthetic SVGA and report code are local.
- No external CDN is needed for the spike.

Privacy:

- No telemetry.
- No external model or network analysis.
- Host-side report generation does not persist absolute paths.

Rollback:

- Remove `tools/electron-prototype/experiments/svga-web/`.
- Keep current browser workflow unchanged.
- Keep current `svgaplayerweb@2.3.1` prototype unchanged.

## Decision

`svga-web@2.4.4` is **not approved for production desktop replacement**.

It remains an isolated candidate only. Production Electron desktop remains blocked until one of these happens:

1. A bounded follow-up proves the `wasm-eval` path can be removed without weakening CSP.
2. A different SVGA player passes strict CSP and playback parity.
3. The desktop production route remains frozen and the browser workflow continues as the rollback baseline.

