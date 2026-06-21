# svga-web Strict-CSP Experiment

This is an isolated playback/security spike for `svga-web@2.4.4`. It does not
replace the current Web preview player, the existing `svgaplayerweb@2.3.1`
prototype, or any root script.

## Commands

```bash
npm run spike:svga-web:test
npm run spike:svga-web:smoke
npm run spike:svga-web:package:mac
npm run spike:svga-web:package:win
npm run internal:trial:package:mac
```

## Boundary

- restricted CSP: `script-src 'self' 'wasm-unsafe-eval'`, no generic
  `unsafe-eval`
- local vendored player asset only
- synthetic SVGA fixture copied from the parent prototype runtime
- existing avatar-frame inspection report service reused from built `dist`
- no user assets committed
- no production dependency or default runtime change
- internal trial artifacts are written to ignored `.artifacts/internal-trial/`
- internal trial package is unsigned, not notarized, and not production-approved
- `host-adapter-contract.cjs` is the Electron host boundary for later shared
  frontend adoption. It owns the secure BrowserWindow defaults, allowed IPC
  channel names, and local-only URL checks. The sandboxed preload mirrors that
  narrow bridge without importing local modules, so `sandbox: true` remains
  active.
- New shared frontend code should prefer `window.autoSvgaElectronHost`. The
  existing `window.autoSvgaPrototype` bridge remains as a compatibility alias
  for this isolated experiment.

Remove this experiment by deleting `tools/electron-prototype/experiments/svga-web/`.
