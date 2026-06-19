# ADR-010: Electron Player `wasm-eval` Boundary

Date: 2026-06-19

Status: accepted as a security boundary; production desktop remains blocked

## Context

Two Electron player candidates have now been tested in isolated prototype work:

- `svgaplayerweb@2.3.1`: blocked by `unsafe-eval` from dynamic protobuf
  reflection/code generation.
- `svga-web@2.4.4`: synthetic playback, nonblank canvas, inspection report,
  Motion Asset Audit panel, and macOS packaged smoke passed, but Chromium
  reported `script-src wasm-eval`.

Neither candidate is approved as a production desktop player baseline.

## Decision

Do not approve `wasm-eval` as a production desktop CSP baseline.

`wasm-eval` may be evaluated only as a bounded internal prototype exception.
It must not be used to claim production desktop readiness, installer readiness,
signing readiness, notarization readiness, or release readiness.

Production desktop shell work remains frozen until one of these is true:

1. A no-eval/no-wasm-eval player path passes playback parity and strict CSP.
2. A separate security review explicitly accepts a narrower desktop runtime
   exception for a non-production internal trial.
3. The project chooses to continue with the browser workflow and defer desktop
   packaging.

## Candidate Status

| Candidate | Current evidence | Status |
|---|---|---|
| `svgaplayerweb@2.3.1` | Existing Web player works, but Electron strict CSP is blocked by `unsafe-eval` | Prototype-only; production blocked |
| `svga-web@2.4.4` | Synthetic playback/report/audit smoke passed; no static `eval(` or `Function(`; runtime triggers `wasm-eval` | Candidate-only; production blocked |

## Strategy Assessment

### Strategy A: strict CSP absolute

No `unsafe-eval` and no `wasm-eval` allowed.

- Security risk: lowest.
- Offline behavior: unchanged; local vendored assets can still be used.
- Playback parity: blocked until a player passes strict CSP.
- Maintenance cost: moderate; requires no-wasm player path or renderer decision.
- Package impact: no additional production package growth.
- macOS risk: lowest security posture, but desktop delivery remains blocked.
- Windows risk: same as macOS; no runtime exception to validate.
- Privacy and local file exposure: lowest; no CSP relaxation.
- Rollback: browser workflow remains stable.

### Strategy B: internal prototype exception

Allow `wasm-eval` only in an isolated local player view for internal prototype
testing.

- Security risk: medium. Dynamic WebAssembly compilation remains a CSP
  exception even without remote code loading.
- Offline behavior: acceptable only with vendored local player assets.
- Playback parity: can continue corpus testing with `svga-web@2.4.4`.
- Maintenance cost: moderate; the exception must stay documented and isolated.
- Package impact: same Electron package-size risk as the current prototype.
- macOS risk: acceptable only for source/package smoke and internal trials.
- Windows risk: requires separate Windows runtime smoke before any broader
  trial.
- Privacy and local file exposure: acceptable only if remote navigation,
  remote scripts, arbitrary file serving, telemetry, and absolute path
  persistence remain prohibited.
- Rollback: browser workflow must remain the default.

Mandatory boundaries for this exception:

1. Local vendored player only.
2. No remote navigation.
3. No remote scripts.
4. No arbitrary file serving.
5. Narrow preload bridge.
6. Validated IPC.
7. No telemetry.
8. No persisted absolute paths.
9. No production release claim.
10. No installer, signing, notarization, auto-update, or release packaging claim.

### Strategy C: continue no-wasm/no-eval player search

Do not accept `wasm-eval`; continue searching, patching, or building a safer
playback path before desktop distribution.

- Security risk: low if strict CSP is preserved.
- Offline behavior: depends on the future candidate, but must remain local.
- Playback parity: unknown until candidate testing.
- Maintenance cost: highest; may require patching a player or building a
  bounded renderer.
- Package impact: unknown until candidate is selected.
- macOS risk: deferred until candidate exists.
- Windows risk: deferred until candidate exists.
- Privacy and local file exposure: remains bounded by future host design.
- Rollback: browser workflow remains stable.

## Production Boundary

`wasm-eval` is not a production baseline.

Do not proceed to installer, signing, notarization, auto-update, production
packaging, or desktop release while the selected player requires `unsafe-eval`
or `wasm-eval`.

## Runtime Scope

This decision does not change:

- root package scripts or dependencies;
- SVGA exporter behavior;
- Web preview player implementation;
- CLI default flow;
- import, drag-drop, or comparison behavior;
- Motion Asset Audit contracts;
- report JSON contracts.

## Client Assessment

- macOS: internal prototype can continue only under explicit exception
  boundaries; production blocked.
- Windows: package structure evidence is insufficient; runtime smoke required
  before internal trial expansion.
- CSP: strict production baseline remains no `unsafe-eval` and no `wasm-eval`.
- Offline behavior: required; player assets must stay vendored for prototypes.
- Local files: host boundary must avoid arbitrary file serving and persisted
  absolute paths.
- Privacy: no telemetry and no external upload.
- Distribution: production distribution remains blocked.
- Rollback: current browser workflow remains the stable path.

## Next Task

Choose one bounded follow-up:

1. Try a no-wasm/no-eval `svga-web` build or patch in isolation.
2. Run a formal internal-prototype exception review for `wasm-eval`.
3. Freeze desktop playback work and continue improving the browser workflow.
