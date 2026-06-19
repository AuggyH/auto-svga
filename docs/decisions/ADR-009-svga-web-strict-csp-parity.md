# ADR-009: svga-web Strict-CSP Parity Decision

## Status

Accepted as a spike result. Not approved for production migration.

## Context

The previous player/CSP decision found that `svgaplayerweb@2.3.1` cannot meet the production desktop security baseline because it requires `unsafe-eval`. `svga-web@2.4.4` was approved only for one isolated strict-CSP playback parity spike because its published bundle has no static `eval(` or `Function(` matches and uses a static generated protobuf decoder.

## Decision

Keep `svga-web@2.4.4` isolated as a candidate only.

Do not replace the main Web preview player.
Do not approve it for production desktop.
Do not weaken the production CSP baseline.

## Evidence

The isolated Electron prototype verified:

- local page load
- local vendored player asset loading
- synthetic SVGA playback
- nonblank canvas smoke
- avatar-frame inspection report generation
- Motion Asset Audit read-only panel rendering

The same smoke also reported:

```text
script-src wasm-eval
```

The vendored `svga-web@2.4.4` bundle has no static `eval(` or `Function(` matches, but includes a `long.js` WebAssembly fast path:

```text
new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(...)))
```

That violates the current strict-CSP production baseline.

## Consequences

- Functional synthetic playback parity is promising but insufficient.
- Production Electron desktop remains blocked.
- Browser workflow remains the rollback baseline.
- Any future `svga-web` migration must be preceded by a bounded `wasm-eval` mitigation or security decision.
- Allowing `wasm-unsafe-eval` is not approved by this ADR.

## Non-Goals

- No production desktop client.
- No installer.
- No auto-update.
- No signing or notarization.
- No main Web preview player replacement.
- No SVGA exporter change.
- No CLI default flow change.
- No new format parser.
- No format conversion.

## Next Candidate Task

Run a bounded `wasm-eval` mitigation spike:

1. Confirm whether the `long.js` WebAssembly fast path can be disabled, removed, or replaced in the isolated candidate.
2. Re-run strict-CSP source and packaged smoke.
3. Keep the candidate isolated unless CSP and playback parity both pass.

