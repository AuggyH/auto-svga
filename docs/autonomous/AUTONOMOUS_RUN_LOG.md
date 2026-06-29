# SVGA Workbench v1 Autonomous Run Log

## 2026-06-30

### Run Start

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Baseline commit: `545252838311233cc03ce2e5f917e53d43207589`
- Source branch baseline: `agent/codex/p6-r1-contract-r3`
- Baseline scope: 14 P6-R1 Workbench stabilization changes committed as
  `5452528` after `npm run loop:validate` passed on the equivalent dirty
  source tree.

### Phase 1 Baseline Check

- Command: `npm run desktop:smoke`
- Result: pass
- Evidence summary: Electron product smoke accepted local-only runtime, strict
  CSP, playback, nonblank canvas, inspection report, audit panel, file input,
  drag/drop, invalid file handling, player lifecycle, owner usability, and
  workbench region map.

### macOS Internal Package Check

- Command:
  `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
- Result: pass
- App ZIP:
  `tools/electron-prototype/experiments/svga-web/.artifacts/internal-trial/Auto SVGA-darwin-arm64.zip`
- SHA-256:
  `2292198bc136a9f49b805bc3844fadb7d8c7d3e8e9c31f442675172e47bc71a3`
- Size: `118688049` bytes
- Build commit: `545252838311233cc03ce2e5f917e53d43207589`
- Notes: unsigned, unnotarized, internal use only. Finder `.svga` association is
  not claimed.

### Package Proof Check

- Command:
  `node tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs --output /tmp/auto-svga-package-proof-check.json`
- Result: pass
- Evidence summary: branch and build commit bound to the autonomous branch;
  privacy audit passed; final packaged App acceptance remains outside this
  autonomous local proof.
