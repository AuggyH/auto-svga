# Validation Summary

Command results:

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-text-model.mjs`: PASS
- Focused combined `svga-web-experiment.test.mjs` pattern: PASS 5/5
- `npm run test:all`: PASS 542/542
- `npm run desktop:short-term:design-system-check`: PASS
- `git diff --check`: PASS
- Strict `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` parse: PASS 192 rows
- Package/lock changed-path scan: PASS, no changed package manifests or lockfiles
- Media/archive changed-path scan: PASS, no changed media/archive files

Environment-limited commands:

- `node --test tools/electron-prototype/experiments/svga-web/tests/*.test.mjs`: 147/149. The two failures require missing local `@electron/asar` for package-proof fixtures.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: stopped before tests because `scripts/prepare-runtime.mjs` reported missing runtime dependency `long`.

No command launched Electron or Auto SVGA.
