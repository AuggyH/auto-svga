# Acceptance Placement Bootstrap Proof Repair

Date: 2026-07-16
Branch: `codex/0.2-acceptance-placement-bootstrap-proof-20260716`
Base: `02cacf279d2a5b047b526f0d10241560681cec87`

## Summary

Permit090 showed the installed app could exit before QA observed a process or the
required `acceptance-startup-placement-proof.json`. The repaired source keeps
the accepted placement proof contract, but now also writes a bounded rejected
proof for inexact acceptance placement and a bootstrap rejected proof when the
acceptance launch fails before product input.

This is source-only. No Electron, Auto SVGA, Finder, foreground, install,
Packaging, QA, or owner material was used.

## Root Cause

The previous acceptance proof path only wrote an artifact when placement was
fully accepted. Rejected placement and early startup failures returned or threw
without a durable artifact. `main.cjs` also loaded the new proof helper through
a top-level `require`, so any module-load failure in the packaged app could exit
before the app-ready catch and before proof writing. The package proof closure
did not bind `acceptance-startup-placement-proof.cjs`, leaving this startup
authority outside package/source drift validation.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Lazy-loads the acceptance proof writer instead of requiring it at module
    top level.
  - Writes a bounded bootstrap rejected proof on acceptance startup failure.
  - Treats written-but-rejected proof as fail-closed before renderer load.
- `tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`
  - Writes rejected proofs with exact stable reason, redacted product identity,
    and `passed=false` when acceptance placement is unsafe or inexact.
- `tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`
  - Adds the proof helper to the packaged window-placement source closure and
    authority list.
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`
  - Adds rejected-proof artifact coverage and static bootstrap-safe load order
    assertions.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds package-closure regression for missing proof helper.

## Failure-First Evidence

- Old proof writer returned rejected in memory for bad bounds without writing a
  QA-readable artifact.
- Old `main.cjs` had a top-level proof-helper require before the safe startup
  boundary.
- Old package proof closure did not include
  `acceptance-startup-placement-proof.cjs`, so a missing packaged helper would
  not fail the package proof.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/acceptance-startup-placement-proof.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/scripts/macos-package-proof.mjs`: PASS
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`: PASS 10/10
- `env NODE_PATH=/Users/huangtengxin/.codex/worktrees/d657/auto-svga/tools/electron-prototype/node_modules node --test --test-name-pattern "macOS internal package scaffold|macOS package proof rejects missing or stale" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 2/2
- `node --test --test-name-pattern "native picker|picker|open file|open/cancel|Cancel|chooser|file picker|host-owned intake|unsupported extension|picker exception" tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`: PASS 8/8
- `node --test --test-name-pattern "native picker|picker|open file|open/cancel|Cancel|chooser|file picker|host-owned intake|unsupported extension|picker exception|0\\.2 installed file-open" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 6/6
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement-store.test.mjs`: PASS 9/9
- `npm run build`: PASS
- `npm run test:all`: PASS 538/538
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS
- `git diff --check`: PASS
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl` strict parse: PASS
- package/lockfile changed-path scan: PASS, no output
- media/archive changed-path scan: PASS, no output

The package proof focused test used a read-only `NODE_PATH` pointing at the
hash-matched `d657` dependency tree because this worktree lacks
`@electron/asar`; package.json, package-lock.json, and svga-web package.json
hashes matched exactly before use. No install/download/symlink overlay was
performed.

Additional optional full svga-web source-suite attempt:
`env NODE_PATH=/Users/huangtengxin/.codex/worktrees/d657/auto-svga/tools/electron-prototype/node_modules npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
stopped during `scripts/prepare-runtime.mjs` because this worktree still lacks
local runtime dependency `long`. It did not launch Electron and is not claimed
as PASS.

## Product Diff

Product diff SHA-256 over the touched startup/proof/package/test files:
`cdd1c9756df2e9007e4d478d98668d0f55ec1b3a60015d9e5d3ac949dbb72603`.

## Boundaries

- No Electron or Auto SVGA launch.
- No foreground, Finder, screenshots, Swift/AppKit/CGWindow helper, or
  approval wrapper.
- No installed app mutation, package, promotion, QA route, Code Review route,
  owner material mutation, save/export/conversion claim, Product Owner
  acceptance, support, distribution, or release claim.

## Next Gate

PM/A0 should independently review this source handoff and route Code Review if
accepted. A rebuilt installed candidate is still required before QA can rerun
the placement proof gate; Permit090 is consumed and not reusable.
