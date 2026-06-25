# P6-R1 WP1 State Correctness Evidence

Date: 2026-06-25
Worker: P6R1-WP1-State-Correctness
Base commit: ad0fbd8d27f305ee089d2e47101821ce01530f99

## Failure-First Baseline

Baseline checks before repair found no reusable WP1 runtime state chain in the
shared product app:

- missing `runWp1StateCorrectnessFlow`
- missing `loadValidSvgaForStateProbe`
- missing `loadInvalidSvgaForStateProbe`
- missing explicit invalid parser/render error assertions

After the initial runtime probe was added, the real headless Web Preview flow
failed before the final repair:

- flow: `Empty -> Loading -> Loaded -> Invalid -> Recovery`
- runtime path: true
- direct state injection: false
- failing state: `loaded`
- failure: `loaded overlay should be hidden`

This proved the WP1 state evidence needed to wait for the real loaded UI to
settle instead of accepting an in-transition snapshot.

## Repair Summary

- Added a WP1 state correctness runtime probe to the shared product app.
- The probe drives real `loadSvga` paths for valid load, invalid `.svga` load,
  and recovery load.
- Invalid state now explicitly requires parser and render status to be `error`.
- Loaded and recovered evidence now waits for the rendered state proof to pass
  before capturing final state data.
- Added a narrow source-sharing regression guard for the WP1 probe entrypoints
  and invalid parser/render assertions.

## Passing Runtime Evidence

Headless Chrome against the local Web Preview passed the full state chain:

- `empty`: passed
- `loading`: passed; active phase `read`; empty CTA hidden; header file action hidden
- `loaded`: passed; parser `success`; render `ready`
- `invalid`: passed; parser `error`; render `error`; stale metadata, canvas,
  file badge, and report cleared
- `recovered`: passed; parser `success`; render `ready`; recovered from invalid

The returned proof reported:

- `usedRuntimeLoadPath: true`
- `directStateInjection: false`
- `passed: true`
- `failures: []`

## Validation

- `node --test tools/shared/product-frontend/source-sharing.test.mjs` passed.
- `npm run build` passed.
- `npm run build:example` passed.
- `npm run export:example` passed and generated the local ignored SVGA fixture.
- Headless Chrome WP1 runtime state flow passed on
  `http://127.0.0.1:4199/tools/svga-player-preview/`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:prepare` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed after prepare.
- `git diff --check` passed.

## Notes

- The first Electron contract test run failed before prepare because the
  experiment runtime had not copied the shared product shell; rerunning after
  the package's prepare step passed.
- Generated verification outputs under `dist/`,
  `examples/avatar_frame_basic/output/`, `node_modules/`, and Electron
  `.runtime/` directories are ignored and are not part of the worker commit.
