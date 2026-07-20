# ASV-QA-20260711-001 First-launch Durable Open Repair

## Summary

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-installed-open-first-launch-durable-20260713`
- Base: `eec5c1717614246cb4a81584531626d33bef6920`
- State: `Fix Ready / Code Review Required`

This repair addresses the installed `eec5c171` Permit 024 failure where a single first-launch macOS file-open event for a supported Lottie left the installed app on the Launch / `打开预览候选` surface. QA later proved the same process and window were alive, so the defect is startup delivery timing rather than Lottie parser or renderer absence.

## Finding Ledger

| Finding | Evidence | Status |
| --- | --- | --- |
| `ASV-QA-20260711-001 / Permit 024` | Installed build `eec5c171` launched once with task-owned supported Lottie. Same PID/window survived, but visible state remained Launch/open-candidate. QA fact-source `9892d14d`, evidence SHA `f19062daf07d68368e19b8b03743f430a6231d2336ec0018a8559cffe2b76fac`. | Repaired in source; requires Code Review, rebuild/install, then QA foreground regression. |

## Repair Contract

Root-cause hypothesis:

`eec5c171` fixed queue consumption timing, but the renderer entry still called `notifyMultiFormatRendererReady()` before `controller.initialize()`. Main flushed queued first-launch file-open work inside that readiness IPC. A successful `completeHostFileOpen()` could push the model to `previewReady`, then the subsequent renderer initialization reset the visible state to Launch. The same synchronous IPC path also let file parsing block `loadURL()` completion and delay the only visible window.

Why prior fix failed:

The prior source tests proved queue preservation and renderer-ready gating, but they did not model the renderer app entry order: action bridge installed, readiness IPC fired, queued open completed, and then controller initialization ran.

Failure-first coverage:

- Added `0.2 first-launch file-open survives delayed renderer-ready flush and late initialization`.
- Updated installed-open static contract to require `controller.initialize()` before `notifyMultiFormatRendererReady()`.
- Updated trace contract to require non-blocking readiness-triggered flush.

Success stop condition:

One first-launch task-owned Lottie event reaches `previewReady`, runtime mount stays `loaded`, late initialization cannot return to Launch, queued file-open dispatch remains bound to explicit renderer-ready IPC, and existing Lottie/VAP/SVGA regressions pass.

Failure stop condition:

If Code Review or rebuilt installed QA still observes Launch fallback after the same single-open first-launch path, stop source guessing and require a new discriminator that records whether the event reached renderer action acceptance or was lost before queue insertion.

Repair Health budget:

This is a successor repair after Permit 024, not a third recurrence of `MF-EARLY-CR-001R`. A future same-symptom installed failure after this head should be treated as a new runtime discriminator requirement, not another cosmetic source patch.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
  - Initializes the controller before notifying main that the renderer action bridge is ready.
- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Starts queued file-open flush asynchronously after renderer-ready IPC so first input processing does not block `loadURL()` and visible window readiness.
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
  - Makes initialization idempotent when a model is already present, preserving preview/failed state instead of forcing Launch.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds the first-launch delayed-ready regression and updates host-order contracts.
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs`
  - Updates renderer-ready flush contract for non-blocking async flush.

## Validation

- `node --test --test-name-pattern "0\\.2 installed file-open|launch-time file-open queue|first-launch file-open" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: PASS 6/6
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-open-runtime-trace.test.mjs`: PASS 3/3
- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`: PASS
- `npm run build`: PASS
- Related multi-format suites: PASS 57/57
- `npm run test:all`: PASS 525/525
- `npm run desktop:short-term:design-system-check`: PASS

## Boundaries

- No package build, installed app replacement, foreground launch, QA route, Product Owner acceptance, support claim, save/export/conversion work, or production asset mutation was performed.
- `.pnpm-store/` remains an existing classified untracked residue and was not staged or cleaned.
- A rebuilt installed candidate is required before QA can verify the real foreground same-session behavior.

## Retrospective

The useful lesson is that renderer action readiness is not enough if the renderer app has not completed its own initial visible-state initialization. First-launch file-open tests need to cover both directions: the main queue must wait for renderer readiness, and the renderer must not announce readiness before its own initialization can preserve a completed open.

Token usage: unavailable from local runtime.
