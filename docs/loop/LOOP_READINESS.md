# Auto SVGA Agent Loop Readiness

Date: 2026-06-19

## Summary

Auto SVGA is partially ready for an Agent Loop.

The repository has a strong local TypeScript/test baseline, broad Motion Asset Audit contract tests, Web inspection tests, launcher tests, and isolated Electron prototype tests. However, the loop is not fully ready because there is no single non-destructive validation command, no lint/format gate, and several critical acceptance points remain visual or product-judgement based.

## What Is Ready

- Root build and tests are local and passing.
- Core CLI, exporter, inspection, spec checker, Motion Asset Audit, and recommendation contracts are covered by Node tests.
- Web inspection report rendering has targeted tests.
- Local preview launcher has targeted tests.
- Isolated Electron prototype has local tests and smoke commands.
- Browser workflow remains available as rollback.
- Runtime code does not require production credentials for standard validation.

## What Is Not Ready

- No unified `loop:validate` command exists.
- No lint command exists.
- No formatter check exists.
- Mutating generation commands are mixed with safe validation commands in root scripts.
- Visual playback quality and real asset parity are not fully machine-verifiable.
- Electron prototype tests can race if run in parallel because they share `.runtime` preparation.
- Normal browser preview player assets and Electron player candidates have different security/offline constraints.
- Real external sample testing cannot be part of source-controlled default validation.

## Agent Loop Risks

### Testing Gaps

- Root `npm test` is strong for TypeScript logic, but it does not cover every long-running workflow.
- Web preview smoke is not represented as a root script.
- Electron prototype smoke is isolated and heavier, not part of root `npm test`.
- No lint/format gate is available.

### Nondeterministic Or Mutating Outputs

- `dist` is generated during build and tests.
- Example/job pipeline commands write generated outputs.
- Electron prototype tests write ignored `.runtime` folders.
- Parallel Electron prototype preparation can race on shared runtime directories.

### Visual Result Limits

- SVGA inflate/protobuf decode proves binary readability, not visual correctness.
- Nonblank canvas smoke proves rendering occurred, not animation parity or quality.
- Loop seams, subtle transforms, alpha edges, glow, sweep, mask/matte behavior, and premium feel remain visual-review gates.

### External Service Or Network Risk

- Standard root build/tests do not require production services.
- Network-based audit commands are not part of the current safe baseline.
- Normal browser preview should be treated carefully because player asset loading has historically involved CDN dependencies.
- Electron prototype paths use vendored local assets but remain prototype-only.

### Credentials And Production Environment Risk

- No production credentials are required for the audited commands.
- No telemetry or external AI/model service is required for the audited commands.
- Desktop distribution, signing, notarization, and production security approval are outside the loop baseline.

## Recommended Loop Guardrails

- Start each Agent Loop from a clean branch.
- Run the unified loop validation command before and after code changes once it exists.
- Keep mutating artifact generation behind explicit task permission.
- Keep real user assets outside Git.
- Keep Web/Electron prototype validation sequential, not parallel.
- Require human review for visual quality, production acceptance, and desktop security approval.
- Do not let a passing binary parse or nonblank canvas smoke claim full visual success.

## Machine Vs Manual Gates

Machine-verifiable now:

- Build and type checks.
- Unit and integration tests.
- Report contract shape.
- Spec checker results.
- Motion Asset Audit report/presentation/localization contracts.
- Web report rendering.
- Local launcher behavior.
- Basic local preview server response.
- Isolated Electron security settings and smoke output.

Manual or semi-manual:

- True animation quality.
- Pixel-level browser/Electron/player parity.
- Real catalog sample acceptance.
- Product threshold approval.
- Whether role-aware padding should become a production gate.
- Whether Electron can become a production desktop baseline.

## Readiness Decision

Status: partially_ready

Suggested first loop task:
Create a non-mutating unified validation script that runs the safe baseline checks and emits a compact machine-readable summary.

Validation facilities required before first loop:

- Add one explicit safe command, recommended as `npm run loop:validate`.
- Include build, root tests, launcher tests, Web inspection tests, Web syntax checks, Web local smoke, and isolated Electron tests in a sequential order.
- Mark mutating commands as excluded unless a task explicitly allows artifact generation.
- Capture pass/fail, duration, and skipped checks in a stable summary file or console JSON.
- Prevent parallel execution of shared Electron `.runtime` preparation.
- Add a clear human-review note for visual gates that cannot be automated yet.

Recommended unified validation command:
`npm run loop:validate`

Interim manual sequence until the command exists:

```bash
npm run build
npm test
npm run validate:example
node --test tools/launch-local-preview.test.mjs
node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs
node --check tools/svga-player-preview/main.js
node --check tools/svga-player-preview/server.mjs
node --check tools/launch-local-preview.mjs
npm --prefix tools/electron-prototype run spike:electron:test
npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
```
