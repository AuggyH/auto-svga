# Review: P6 A5 macOS package scaffold

## Summary

Prepared an isolated macOS arm64 internal app packaging scaffold for the P6
desktop product surface. This is not final packaged App acceptance.

## Git state

- Branch: `agent/codex/p6-a5-macos-package`
- Base commit: `d16fb380c0ff82b9aca3af58b0335708e0b0ef73`
- Final packaged App acceptance owner: Integration Coordinator

## Changed files

- `docs/internal-electron-trial-package.md`
- `docs/reviews/2026-06-22-codex-p6-a5-macos-package.md`
- `tools/electron-prototype/experiments/svga-web/README.md`
- `tools/electron-prototype/experiments/svga-web/package.json`
- `tools/electron-prototype/experiments/svga-web/packaging/macos/Info.plist`
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement checks

| Requirement | Status |
|---|---|
| Work on assigned branch only | Done |
| No root `package.json` edit | Done |
| No loop state/history/milestone edit | Done |
| No main Web Preview player edit | Done |
| No exporter or CLI default-flow edit | Done |
| macOS arm64 internal package metadata | Done |
| Unsigned and unnotarized metadata | Done |
| `.svga` document type metadata | Done |
| Proof manifest fields | Done |
| Privacy audit boundaries | Done |
| Final App acceptance not claimed | Done |

## Verification

Commands run and results:

```text
node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs
Result: pass

node --check tools/electron-prototype/experiments/svga-web/scripts/package-internal-trial.mjs
Result: pass

cd tools/electron-prototype/experiments/svga-web && npm run internal:trial:proof:mac
Result: pass; privacyAuditPassed=true; finalPackagedAppAcceptanceOwner=Integration Coordinator

cd tools/electron-prototype/experiments/svga-web && npm run spike:svga-web:test
Result: pass; 17 tests / 0 failed

cd tools/electron-prototype/experiments/svga-web && npm run internal:trial:package:mac
Result: pass; generated ignored .app, .zip, internal-trial-manifest.json, and macos-package-proof.json

plutil -p .../AutoSVGAInternalPrototype.app/Contents/Info.plist
Result: pass; internal flags, local.auto-svga.internal-prototype, and .svga document type present

git diff --check
Result: pass

git status --short
Result: pre-commit changes matched the expected A5 file scope
```

## Risks

- The scaffold is unsigned and unnotarized by design.
- `wasm-unsafe-eval` remains an internal prototype exception.
- Real packaged App smoke and final acceptance remain Integration Coordinator work.
- A root script was not added; integration may request one later.

## Next steps

Integration Coordinator should run the final macOS package smoke, inspect
`macos-package-proof.json`, and decide whether to add a root package script.
