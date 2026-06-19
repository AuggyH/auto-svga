# M1: Unified Loop Validation

Status: active
Contract frozen after bootstrap commit.

## Objective

Add one unified validation entrypoint:

```bash
npm run loop:validate
```

The command must be source-safe validation. It may write to `dist`, system temporary directories, ignored `.runtime` directories, and `.artifacts/loop-validation`. It must not modify tracked business code, fixtures, examples, jobs, outputs, schemas, templates, or product artifacts.

No third-party dependency may be added.

## Required Sequential Checks

Run these checks in strict order. Do not use `Promise.all` or other parallel execution.

1. `npm run build`
2. `npm test`
3. `npm run validate:example`
4. `node --test tools/launch-local-preview.test.mjs`
5. `node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs`
6. `node --check tools/svga-player-preview/main.js`
7. `node --check tools/svga-player-preview/server.mjs`
8. `node --check tools/launch-local-preview.mjs`
9. Web local smoke:
   - use `127.0.0.1` and a random available port
   - preview page endpoint returns 200
   - `/api/latest-artifact` returns 200
   - do not open a browser
   - do not access public network
   - always close the server after success or failure
10. `npm --prefix tools/electron-prototype run spike:electron:test`
11. `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
12. `git diff --check`

Electron checks must run sequentially to avoid shared `.runtime` races.

## Validator Contract

Implement:

- `tools/loop-validate.mjs`
- `tools/loop-validate.test.mjs`
- `package.json` script `loop:validate`

Behavior:

1. Default fail-fast.
2. Required step failure exits non-zero.
3. Steps after a required failure are recorded as `skipped`.
4. Skipped reason is `blocked_by_previous_failure`.
5. Child stdout and stderr are not swallowed.
6. Child processes are reliably cleaned up.
7. Summary paths do not contain local absolute paths.
8. The validator does not access public network.

Every run writes:

```text
.artifacts/loop-validation/latest.json
```

The final console line must be:

```text
AUTO_SVGA_LOOP_VALIDATE_RESULT=<single-line-json>
```

Summary JSON contains at least:

- `schemaVersion: 1`
- `status: pass | fail | aborted`
- `startedAt`
- `finishedAt`
- `durationMs`
- `steps`
- `knownGaps`

Each step contains at least:

- `id`
- `command`
- `required`
- `status`
- `exitCode`
- `durationMs`
- `reason`

`knownGaps` must include:

- `lint: not_available`
- `format: not_available`
- `performance-benchmark: not_available`
- `visual-quality: manual_review`
- `svga-web-render-smoke: optional_heavy_check`

## Required Tests

Tests must prove:

1. Success path executes in the defined order and returns 0.
2. Middle-step failure returns non-zero.
3. Steps after failure are not executed and are marked `skipped`.
4. JSON summary is parseable and has `schemaVersion: 1`.
5. Console summary and file summary have matching semantics.
6. Electron steps do not run in parallel.
7. Web smoke uses random loopback port and closes the server.
8. Failure-path tests do not modify real project files.

## Completion Gates

Before `PASS`:

1. Run targeted validator tests.
2. Run `npm run loop:validate` twice consecutively.
3. Run independent read-only review against this contract.
4. Repair blocking findings.
5. Commit the completed M1 implementation.

## Prohibited

Do not:

1. Modify this milestone contract after bootstrap commit.
2. Modify the three audit files.
3. Delete or weaken tests.
4. Modify product features or SVGA output semantics.
5. Add a dependency.
6. Add lint or formatter tooling.
7. Run `build:example`, `export:example`, or autosvga job pipeline commands.
8. Push, merge, release, or deploy.
9. Hide required failures with ignore, skip, catch, or fallback success.
