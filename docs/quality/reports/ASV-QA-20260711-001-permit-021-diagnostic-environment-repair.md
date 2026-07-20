# ASV-QA-20260711-001 Permit 021 Diagnostic Environment Repair

## Status

`Permit Ready / Diagnostic Environment Repaired`.

This record is limited to the task-owned runtime-discriminator App environment.
It is not a product source fix, Code Review handoff, QA route, package
promotion, installed-app mutation, foreground run, or Lottie/VAP support claim.

## Source Binding

- Worktree: `/Users/huangtengxin/.codex/worktrees/116b/auto-svga`
- Branch: `codex/0.2-installed-open-runtime-discriminator-20260713`
- Source head: `9e99f750de6d089a641d02565584e215aa4cf142`
- Base product source under diagnosis: `94dc86f78e84e3ed8798f81d1556e5836d23621f`
- Prior QA fact-source: `77e5bde2e53e4f3ff406d3d199a439357a5d1556`
- Prior QA evidence SHA-256: `8341d2c3131d4664ed4fbadb920f01042af55fab310bdcc9dd4c6bbb403070fb`

## Failure-first Evidence Bound

The previous Permit 021 App did receive a LaunchServices startup but crashed
before JS `main_started`.

- Crash report: `/Users/huangtengxin/Library/Logs/DiagnosticReports/Auto SVGA-2026-07-13-051700.ips`
- Crashed PID: `74271`
- Bundle id: `local.auto-svga.multiformat-trace.runtime-discriminator-018`
- Process path: `/private/tmp/Auto SVGA Multi-format Trace 018.app/Contents/MacOS/Auto SVGA`
- Exception: `EXC_BREAKPOINT` / `SIGTRAP`
- Earliest missing phase: Electron native startup before JS trace init.

Static diagnosis showed the previous task-owned package had a post-hoc main
bundle id change while all four Electron Helper bundle ids still used
`local.auto-svga.internal-prototype.helper`. That mismatch is now guarded by a
failure-first preflight test.

## Repair

Added a compact diagnostic static preflight:

- `tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-trace-app-preflight.test.mjs`

The preflight checks:

- main bundle id equals `local.auto-svga.multiformat-trace.runtime-discriminator-018`;
- all four Electron Helper bundle ids equal
  `local.auto-svga.multiformat-trace.runtime-discriminator-018.helper`;
- `ElectronAsarIntegrity` matches the actual `app.asar` header hash;
- trace marker equals `runtime-discriminator-018`;
- no `com.apple.quarantine` xattr is present;
- critical app/executable/asar/marker/helper plist paths exist and are not
  symlinks.

Added a task-owned preparation script:

- `tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`

It rebuilds the temp App from source head `9e99f750` with both
`--app-bundle-id` and `--helper-bundle-id` set at packaging time, writes the
trace marker, creates the synthetic Lottie input, validates runtime closure,
and runs the static preflight.

## Rebuilt Task-owned App

- App: `/private/tmp/Auto SVGA Multi-format Trace 018.app`
- Bundle id: `local.auto-svga.multiformat-trace.runtime-discriminator-018`
- Helper bundle ids: four instances of
  `local.auto-svga.multiformat-trace.runtime-discriminator-018.helper`
- Trace marker:
  `/private/tmp/Auto SVGA Multi-format Trace 018.app/Contents/Resources/auto-svga-multiformat-trace-run-id`
- Trace run id: `runtime-discriminator-018`
- Expected trace:
  `/private/tmp/auto-svga-multiformat-trace-runtime-discriminator-018.jsonl`
- Synthetic Lottie:
  `/private/tmp/auto-svga-multiformat-trace-runtime-discriminator-018-lottie.json`

Hashes:

- `app.asar`: `76a47f9189f695189b9fb40d13ec5b9799b6315d09714f64645299f2108dac7a`
- synthetic Lottie:
  `35f605b53f31b3f7eb40c5ff335b822d998ca5967340f565e6ef1c28bab71354`
- rebuilt `Info.plist`:
  `17f7fc1124a3e534c55b7db55db1966d8bc4b578d7129342ceebc05a443683c2`
- `app.asar` header hash:
  `c0dc006d9bc3253aa01d6e1f50941da039b3824d79aea39f9b0e8bfe2f41f49b`

The `app.asar` hash intentionally remains the Permit 021 hash; only the
package-time bundle identity environment changed.

## Temporary Overlay Boundary

No dependency was installed or downloaded. The build used the established
temporary symlink-overlay pattern:

- current worktree `.pnpm` provided `long@5.3.2`, `fflate@0.8.3`, and
  `iobuffer@6.0.1`;
- worktree `d657` provided `tools/electron-prototype/node_modules` after
  `tools/electron-prototype/package.json` and
  `tools/electron-prototype/experiments/svga-web/package.json` hashes matched
  the current worktree;
- the four overlay symlinks were removed after packaging;
- postcheck showed all four overlay paths missing again.

## Verification

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-trace-app-preflight.test.mjs` 2/2
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs` 3/3
- `node tools/electron-prototype/experiments/svga-web/scripts/prepare-multiformat-trace-app.mjs`
- `node tools/electron-prototype/experiments/svga-web/scripts/multiformat-trace-app-preflight.mjs "/private/tmp/Auto SVGA Multi-format Trace 018.app"`

Additional checks:

- Runtime closure validated during preparation.
- `app.asar` header integrity matched Info.plist.
- No `com.apple.quarantine` was present; only `com.apple.provenance` appeared.
- Critical task-owned paths were not symlinks. Electron framework internal
  symlinks remain normal bundle structure.
- Exact temp App process absence was confirmed with `pgrep -fl` outside the
  sandbox after sandbox process listing failed.
- Git tracked state remained clean except intended source changes and known
  `.pnpm-store/` residue.

## Next Permit Shape

The next permit should be narrower than the prior A-D discriminator:

1. Launch the exact task-owned App once without synthetic file input.
2. Stop unless the trace contains `main_started`.
3. Only if `main_started` is present, deliver the synthetic Lottie file once
   in the same zero-retry session.
4. Stop after the first missing phase. Do not repair A-D or renderer readiness
   until this environment proof is positive.

No foreground, GUI click/key/menu/dialog/clipboard/screenshot, installed-app
mutation, production material, package promotion, CR, QA, or product-support
claim is included in this record.
