# Multi-format Runtime Discriminator Environment Repair

## Summary

Prepared a corrected task-owned runtime-discriminator App environment for
ASV-QA-20260711-001 / ASV-REQ-20260709-003. The repair is diagnostic-only: it
does not change product open/playback behavior and does not launch GUI.

## Git State

- Branch: `codex/0.2-installed-open-runtime-discriminator-20260713`
- Base/head before this repair: `9e99f750de6d089a641d02565584e215aa4cf142`
- Known untracked residue preserved: `.pnpm-store/`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-trace-app-preflight.test.mjs`
- `docs/quality/reports/ASV-QA-20260711-001-permit-021-diagnostic-environment-repair.md`
- `docs/reviews/2026-07-13-codex-multiformat-runtime-discriminator-env-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Evidence

The prior Permit 021 crash is now bound as failure-first evidence:
`/Users/huangtengxin/Library/Logs/DiagnosticReports/Auto SVGA-2026-07-13-051700.ips`
records PID `74271`, bundle id
`local.auto-svga.multiformat-trace.runtime-discriminator-018`, and
`EXC_BREAKPOINT` / `SIGTRAP` before JS `main_started`.

The rebuilt temp App is:
`/private/tmp/Auto SVGA Multi-format Trace 018.app`.

Static preflight passes with:

- main bundle id:
  `local.auto-svga.multiformat-trace.runtime-discriminator-018`
- four Helper bundle ids:
  `local.auto-svga.multiformat-trace.runtime-discriminator-018.helper`
- `app.asar` SHA-256:
  `76a47f9189f695189b9fb40d13ec5b9799b6315d09714f64645299f2108dac7a`
- synthetic Lottie SHA-256:
  `35f605b53f31b3f7eb40c5ff335b822d998ca5967340f565e6ef1c28bab71354`
- `app.asar` header hash:
  `c0dc006d9bc3253aa01d6e1f50941da039b3824d79aea39f9b0e8bfe2f41f49b`

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-trace-app-preflight.test.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs`
- `node tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`
- `node tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs "/private/tmp/Auto SVGA Multi-format Trace 018.app"`

The task used temporary dependency symlink overlays only; all overlay links were
removed after packaging and verified missing. No dependency install or download
occurred.

## Boundaries

No product source fix, GUI launch, installed-app mutation, package promotion,
CR, QA route, production material, foreground evidence, or support/release
claim was performed.

## Next Gate

Request a fresh PM foreground/runtime permit only for:

1. plain task-owned App startup to prove `main_started`;
2. one synthetic file delivery in the same zero-retry session only if
   `main_started` is present.

Stop before A-D repair until startup trace is positive.

## Retrospective

- Repeated installed/packaged symptoms need an environment-validity check
  before product-chain debugging.
- For Electron packages, post-hoc main bundle id changes are not equivalent to
  package-time identity changes because Helper bundle ids can remain stale.
- Token usage: unavailable in current runtime.
