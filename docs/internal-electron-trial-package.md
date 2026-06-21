# macOS Internal Electron Trial Package

This package is an internal prototype only. It is not a production client, not
an installer, and not approved for external distribution.

## Build

```bash
cd tools/electron-prototype/experiments/svga-web
npm run internal:trial:proof:mac
npm run internal:trial:package:mac
```

Outputs are written under the ignored artifact directory:

```text
tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/
```

Expected files:

- `AutoSVGAInternalPrototype-darwin-arm64/AutoSVGAInternalPrototype.app`
- `AutoSVGAInternalPrototype-darwin-arm64.zip`
- `macos-package-proof.json`
- `internal-trial-manifest.json`

The manifest records:

- build commit
- platform and architecture
- player package and version
- final CSP
- security flags
- `.svga` document type metadata
- privacy audit result
- package and archive sizes
- archive SHA-256
- proof manifest path
- known risks
- rollback command
- `productionApproved: false`

## Scope

Supported for internal testing:

1. Open a local client window.
2. Load a local vendored player.
3. Select a local SVGA file through the browser file input.
4. Drag a local SVGA file into the player area.
5. Play SVGA.
6. Render the inspection report.
7. Render the Motion Asset Audit read-only panel.
8. Run offline without CDN assets.

Not supported:

1. Production installer.
2. Auto-update.
3. Signing or notarization completion claims.
4. External-user distribution.
5. Format conversion.
6. Export workbench.
7. Automatic repair.
8. New format parsers.

## Security Boundary

The internal trial follows ADR-011:

- local vendored assets only
- macOS bundle metadata from
  `tools/electron-prototype/experiments/svga-web/packaging/macos/Info.plist`
- no remote scripts
- no remote navigation or new windows
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- minimal preload bridge
- validated smoke IPC
- no arbitrary filesystem access
- no arbitrary static directory serving
- no telemetry
- no user asset upload
- no persisted absolute paths
- session/temp cleanup on normal exit
- log redaction
- visible "internal prototype, not production" labeling

The final policy is a restricted CSP with an internal-only WebAssembly execution
exception required by `svga-web@2.4.4`:

```text
script-src 'self' 'wasm-unsafe-eval'
```

Generic `unsafe-eval` remains prohibited.

## Rollback

Use the stable browser workflow:

```bash
npm run local:preview
```

Remove the internal trial artifacts:

```bash
rm -rf tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial
```

Remove the isolated experiment code if needed:

```bash
rm -rf tools/electron-prototype/experiments/svga-web
```

## Current Limits

- macOS arm64 only.
- Unsigned and not notarized.
- Final packaged App acceptance is owned by Integration Coordinator.
- Windows runtime not verified.
- `wasm-unsafe-eval` remains an internal prototype exception only.
- Playback parity is smoke-level, not full corpus parity.
