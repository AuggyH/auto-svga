# Review: Isolated svga-web strict-CSP playback parity spike

## 1. Summary
- Built an isolated Electron prototype experiment for `svga-web@2.4.4`.
- Verified local vendored playback, synthetic SVGA smoke, inspection report rendering, and Motion Asset Audit panel rendering.
- Strict-CSP production readiness is still blocked: Chromium reports `script-src wasm-eval` from the vendored player bundle.

## 2. Git state
- Branch: `agent/codex/svga-web-strict-csp-spike`
- Implementation commit: `de3d883cacdbffd75a5e2239e792b11d89aca571`
- Review commit: `351c0ebd193beb85266555bdf2a1293601ffcf35`
- Commit before work: `5f13043`
- Working tree after delivery: clean
- Runtime/package artifacts after delivery: generated under ignored `.runtime/` and `.artifacts/`

## 3. Changed files
- `docs/svga-web-strict-csp-spike.md`
- `docs/decisions/ADR-009-svga-web-strict-csp-parity.md`
- `tools/electron-prototype/experiments/svga-web/`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Isolated spike only; no production player replacement | Done |
| 2 | Do not replace `svgaplayerweb@2.3.1` or main Web preview | Done |
| 3 | Use strict CSP without `unsafe-eval` | Done |
| 4 | Local-only vendored player asset | Done |
| 5 | Synthetic SVGA playback smoke | Done |
| 6 | Nonblank canvas smoke | Done |
| 7 | Inspection report smoke | Done |
| 8 | Motion Asset Audit read-only panel smoke | Done |
| 9 | Security config check | Done |
| 10 | Production readiness decision | Blocked by `wasm-eval` CSP violation |
| 11 | Root workflow regression check | Done |

## 5. Verification
Commands run and results:

```text
node --check main.cjs
node --check preload.cjs
node --check server.mjs
node --check scripts/prepare-runtime.mjs
node --check web/prototype.js
```

Result: passed.

```text
npm run spike:svga-web:test
```

Result: passed, 3 tests / 0 failures.

```text
npm run spike:svga-web:smoke
```

Result: expected blocked state. Local page, local-only loading, playback, nonblank canvas, inspection report, audit panel, lifecycle cleanup all passed. `noCspViolation=false` because Chromium reported `script-src wasm-eval`.

```text
npm run spike:svga-web:package:mac
npm run spike:svga-web:package:win
```

Result: package structure generated for macOS arm64 and Windows x64.

```text
.artifacts/AutoSVGASvgaWebSpike-darwin-arm64/AutoSVGASvgaWebSpike.app/Contents/MacOS/AutoSVGASvgaWebSpike --smoke
```

Result: same expected blocked state as source smoke; playback/report/audit passed, strict-CSP no-violation failed on `wasm-eval`.

```text
npm test
```

Result: passed, 155 tests / 0 failures.

```text
git diff --check
```

Result: passed.

## 6. Output inspection
- Vendored player: `svga-web@2.4.4`, MIT.
- Vendored bundle hash: `6235bc9802e76dd517343123ec730d25e02c4d476b66b81ef26befe7881f3c50`.
- Static scan: zero `eval(` and zero `Function(`.
- Runtime CSP: strict CSP has no `unsafe-eval`, but player bundle triggers Chromium `wasm-eval`.
- Package size measurement:
  - vendor: 200 KiB
  - runtime copy: 768 KiB
  - macOS package directory: 299892 KiB
  - Windows package directory: 363348 KiB

## 7. Risks
- `svga-web@2.4.4` is not production-approved while `wasm-eval` is required.
- Playback parity was validated only with a synthetic fixture, not a broad SVGA corpus.
- Windows runtime smoke was not run on Windows; only package structure was generated locally.
- Electron remains prototype-only and must not replace the browser workflow.

## 8. Next steps
- Choose one bounded next step: evaluate a no-wasm player build/path, isolate a `wasm-eval` security decision, or keep production desktop frozen and continue browser workflow.

## 9. Commit
- Implementation commit: `de3d883cacdbffd75a5e2239e792b11d89aca571`
- Review commit: `351c0ebd193beb85266555bdf2a1293601ffcf35`
- Branch: `agent/codex/svga-web-strict-csp-spike`
- Tag: none
- Working tree after delivery: clean
