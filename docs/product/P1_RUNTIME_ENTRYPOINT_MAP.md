# P1 Runtime Entrypoint Map

Milestone: P1 - Electron Desktop Mainline Baseline

## Summary

The canonical desktop product entrypoint is the repository-root command:

```bash
npm run desktop:dev
```

It resolves to the `svga-web` Electron runtime and must display:

```text
Auto SVGA Desktop — Internal Baseline
```

Legacy Electron spike pages are retained for historical testing only and must
not be presented as the product mainline.

## Entrypoints

| command | package script | Electron main file | preload file | renderer entry | window title | document title | runtime purpose | canonical / legacy | user-facing / test-only | local player implementation | expected UI fingerprint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `npm run desktop:dev` | root `desktop:dev` -> `tools/electron-prototype/experiments/svga-web` `desktop:dev` | `tools/electron-prototype/experiments/svga-web/main.cjs` | `tools/electron-prototype/experiments/svga-web/preload.cjs` | `tools/electron-prototype/experiments/svga-web/web/index.html` + `web/prototype.js` + `web/styles.css` | `Auto SVGA Desktop — Internal Baseline` | `Auto SVGA Desktop — Internal Baseline` | Ordinary local desktop baseline | canonical | user-facing internal baseline | vendored `svga-web@2.4.4` | header `Auto SVGA Desktop — Internal Baseline`; player section `SVGA 播放输出`; local file chooser; report panel |
| `npm run desktop:smoke` | root `desktop:smoke` -> `tools/electron-prototype/experiments/svga-web` `desktop:smoke` | same as canonical | same as canonical | same as canonical, with `?mode=smoke&artifacts=1` | `Auto SVGA Desktop — Internal Baseline` | `Auto SVGA Desktop — Internal Baseline` | Deterministic smoke and artifact capture | canonical | test-only automation | vendored `svga-web@2.4.4` | same DOM, CSS, player, loading pipeline, cleanup pipeline, and report pipeline as normal mode |
| `npm --prefix tools/electron-prototype run spike:electron:smoke` | `tools/electron-prototype` `spike:electron:smoke` | `tools/electron-prototype/main.cjs` | none for product baseline | `tools/electron-prototype/web/index.html` + `web/prototype.js` | legacy spike title | `Legacy Electron Spike — not product mainline` | historical Electron spike | legacy | test-only | legacy spike player path | explicit `Legacy Electron Spike — not product mainline` label |
| `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:smoke` | experiment `spike:svga-web:smoke` | `tools/electron-prototype/experiments/svga-web/main.cjs` | same as canonical | same as canonical, with `?mode=smoke` | `Auto SVGA Desktop — Internal Baseline` | `Auto SVGA Desktop — Internal Baseline` | isolated player/security smoke | canonical runtime code, test-only command | test-only | vendored `svga-web@2.4.4` | same canonical identity without product artifact capture |

## Runtime Identity Evidence

Product smoke writes:

- `.artifacts/product/P1/runtime-identity.json`
- `.artifacts/product/P1/normal-smoke-parity.json`

The parity file must prove normal and smoke share:

- Electron main entry
- preload entry
- renderer entry
- renderer asset hashes
- product identity
- player package
- CSP
- loading pipeline identity
- cleanup pipeline identity

Only mode, query parameters, deterministic fixture selection, artifact capture,
and process cleanup are allowed to differ.
