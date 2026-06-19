# Review: Internal Electron trial parity audit

## 1. Summary

Ran controlled macOS internal trial validation against 8 real local avatar-frame
SVGA samples. Added a bounded parity audit harness, internal trial user guide,
feedback template, and real-sample parity summary.

No real SVGA, PNG, screenshots, recordings, or absolute sample paths were
committed.

## 2. Git state

- Branch: `agent/codex/macos-internal-electron-trial`
- Implementation commit: `d8c7c310795429d4eac998ce75073eb708a41053`
- Previous package implementation commit confirmed: `d9e1515a8433be84057d401ab893b1c1d1a08801`
- Artifacts: generated under ignored `.artifacts/internal-trial/`

## 3. Changed files

- `docs/internal-electron-trial-package.md`
- `docs/internal-electron-trial-real-sample-parity.md`
- `docs/internal-electron-trial-user-guide.md`
- `docs/templates/internal-electron-trial-feedback.template.md`
- `docs/reviews/2026-06-19-codex-macos-internal-electron-trial.md`
- `tools/electron-prototype/experiments/svga-web/README.md`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/server.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-real-sample-parity-audit.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/audit.html`
- `tools/electron-prototype/experiments/svga-web/web/audit.js`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Confirm prior delivery state | Done |
| Correct strict-CSP wording to restricted CSP with internal-only wasm exception | Done |
| Run real local SVGA parity matrix | Done |
| Do not commit real assets or absolute sample paths | Done |
| Record blocking / major / minor / none / inconclusive counts | Done |
| Add internal trial user guide | Done |
| Add issue feedback template | Done |
| Recheck security, privacy, temp cleanup, and browser rollback | Done |
| Preserve exporter, main Web player, CLI, browser import / drag-drop / comparison | Done |

## 5. Verification

```text
node --check Electron prototype files
Result: pass

npm run spike:svga-web:test
Result: pass, 5 tests / 0 failed

AUTO_SVGA_REAL_SAMPLE_ROOT=<external sample dir> npm run internal:trial:parity
Result: pass, 8 real samples, blocking 0, major 0, minor 0, none 8, inconclusive 0

npm run spike:svga-web:smoke
Result: pass

npm test
Result: pass, 155 tests / 0 failed

Web preview local server smoke
Result: pass, page 200, API 200

npm run internal:trial:package:mac
Result: pass

Packaged .app --smoke
Result: pass

Manifest validation
Result: pass

Temp cleanup smoke
Result: pass

git diff --check
Result: pass
```

## 6. Parity

- Samples: 8
- Coverage: basic small, 300-size, sequence-heavy, sweep/glow-heavy,
  particle-heavy, mask/matte candidate, imageKey candidate, large legacy
- Browser baseline: local vendored `svgaplayerweb@2.3.1`, matching the current
  browser workflow player family
- Electron candidate: isolated `svga-web@2.4.4`
- Blocking: 0
- Major: 0
- Minor: 0
- None: 8
- Inconclusive: 0

Automated checks covered load success, first nonblank frame, playback start,
loop metadata, nonblank canvas, inspection report, Motion Asset Audit panel,
and local-only resource loading. Pixel-level and detailed visual parity remain
manual checks.

## 7. Artifacts

- App: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64/AutoSVGAInternalPrototype.app`
- Zip: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/AutoSVGAInternalPrototype-darwin-arm64.zip`
- Manifest: `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/internal-trial-manifest.json`
- Package size: `286206161` bytes
- Archive size: `118496331` bytes
- SHA-256: `a3eefe8626ee81e9dac0b5c6b54f0f66a4a9cd2fccf27555793d18cfa2a09d98`
- Manifest build commit: `d8c7c310795429d4eac998ce75073eb708a41053`
- Production approved: `false`

## 8. Regression

- SVGA exporter: not touched
- Main Web preview player implementation: not touched
- CLI default flow: not touched
- Browser import, drag-drop, comparison: not touched
- Root default scripts: not changed
- Browser rollback: `npm run local:preview`

## 9. Security and privacy

- Electron candidate uses restricted CSP with internal-only `wasm-unsafe-eval`
  exception.
- Generic `unsafe-eval` is not present in the candidate path.
- Baseline `svgaplayerweb@2.3.1` audit page uses `unsafe-eval` only to model
  the current browser player family; it is not a desktop security baseline.
- Remote navigation, new windows, permission requests, telemetry, arbitrary file
  serving, and renderer filesystem access remain blocked.
- Runtime logs redact local paths.
- Temp directories were cleaned after source and packaged smoke.

## 10. Risks

- `wasm-unsafe-eval` still blocks production desktop security approval.
- App remains unsigned and not notarized.
- Windows runtime remains unverified.
- Real-sample audit is automated smoke-level parity, not pixel-level visual
  acceptance.
- Browser baseline parity uses local vendored `svgaplayerweb@2.3.1`; the current
  Web page still loads CDN scripts in normal browser use.

## 11. Next steps

- Run a small human visual review using the generated internal package.
- Record visual differences with the feedback template.
- Keep production desktop frozen until the wasm exception has an approved
  replacement or stricter production boundary.
