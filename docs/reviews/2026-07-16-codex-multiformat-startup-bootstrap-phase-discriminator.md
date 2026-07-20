# Multi-format Startup Bootstrap Phase Discriminator

Date: 2026-07-16

Branch: `codex/0.2-multiformat-daily-use-stability-20260716`

Base / installed QA baseline: `0f430fa2b63abe7b9e87a9336a087c4b2533e87f`

Predecessor daily-use stability head: `34c59c2cf77df088ec8829cc28dde6b97f10c79c`

Final source head: the commit containing this review file; exact hash is reported in PM handoff.

## Outcome

Implementation Ready for PM/A0 independent review and Code Review routing.

This is a source-only repair/discriminator for Permit097's startup proof/no-process boundary. It does not launch Electron or Auto SVGA and does not claim installed runtime acceptance.

## QA097 Boundary

QA fact-source `914e36c5af87a94437a8c12fd5781b5835704d1f` recorded installed build `0f430fa2b63abe7b9e87a9336a087c4b2533e87f` exiting with code `134` after one direct installed launch with:

- `AUTO_SVGA_ACCEPTANCE_EXECUTION_ID=ASV-APR-20260716-097`
- fresh product artifact root
- `--auto-svga-acceptance-display-id=2`

The artifact root remained empty, `acceptance-startup-placement-proof.json` was absent, and no Open/chooser/material/product rows ran.

## Changed

- Added `acceptance-startup-bootstrap-phases.jsonl`, written only for acceptance-display launches under `AUTO_SVGA_PRODUCT_ARTIFACTS`.
- Moved the bounded bootstrap writer and fatal handlers before `require("electron")`.
- Added ordered phase records for:
  - JS entrypoint loaded
  - Electron require begin/complete
  - local requires begin/complete
  - `app.whenReady` handler registration
  - app-ready create-window entry
  - server import/start
  - placement resolve/revalidate
  - BrowserWindow construction
  - placement proof publish accepted/rejected
  - renderer load begin/complete
  - bootstrap failure artifact begin/write/reject
- Kept normal owner launch, owner placement persistence, picker behavior, renderer behavior, and format runtime behavior unchanged.

## Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs`

Product diff SHA-256 over changed source/test files from predecessor head: `40291df65d7e4317313a9299a7738984363fdeb4708770a4ed45c4c58527d199`

## Failure-First Evidence

Before this repair, source only produced `acceptance-startup-placement-proof.json` after Electron was required and, for success, after BrowserWindow construction. An installed abort before or during Electron startup could therefore leave QA with an empty artifact root and no durable last-reached phase.

The new focused source contract fails the prior shape because it requires `entrypoint_loaded` and `electron_require_begin` to be emitted before `require("electron")`, with later phases proving whether startup reached local module loading, app ready, BrowserWindow construction, placement proof publication, or renderer load.

## Validation

Passed:

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs` PASS 12/12
- `node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs` PASS 28/28
- `node --test --test-name-pattern "native picker|picker|Cancel|cancel|acceptance startup|placement proof|window placement" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` PASS 3/3
- `npm run build` PASS
- `npm run test:all` PASS 538/538
- `npm run desktop:short-term:design-system-check` PASS

Post-packet hygiene is recorded in the visible validation summary.

## What This Proves

Source now guarantees that any acceptance-display launch that reaches `main.cjs` with a valid artifact root writes a bounded, path-redacted phase artifact before Electron is required. If a future installed run still produces an empty artifact root, the next discriminator is no longer main-process placement logic; it is pre-JS Electron/package bootstrap or environment/runtime launch failure.

## Not Changed / Not Claimed

- No installed app launch.
- No foreground use.
- No Finder/native chooser.
- No packaging, promotion, install, QA route, or Permit098.
- No Product Owner acceptance, support claim, distribution readiness, release readiness, save/export/conversion change, or owner material mutation.

## Repair Health

- Root-cause hypothesis: Permit097's empty artifact root could occur before the existing placement proof writer was reached, including Electron require, local startup module loading, app ready, BrowserWindow construction, or proof publication.
- Why prior repairs missed it: prior artifacts centered on placement proof success/rejection and entrypoint exception handling, but did not produce an ordered last-reached phase before Electron was required.
- Success stop: source emits a bounded phase file before Electron require and preserves ordered phase evidence through the placement proof boundary; focused and full source validation pass.
- Failure stop: if rebuilt installed bytes still exit `134` with an empty artifact root, stop treating source placement code as proven involved and route a minimal runtime discriminator for pre-JS/package Electron bootstrap.

## Next Gate

PM/A0 independent review, then Code Review if PM routes this successor. Installed QA needs rebuilt bytes and a fresh permit before any runtime conclusion.
