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
```

## Boundary

- strict CSP: `script-src 'self'`, no `unsafe-eval`
- local vendored player asset only
- synthetic SVGA fixture copied from the parent prototype runtime
- existing avatar-frame inspection report service reused from built `dist`
- no user assets committed
- no production dependency or default runtime change

Remove this experiment by deleting `tools/electron-prototype/experiments/svga-web/`.
