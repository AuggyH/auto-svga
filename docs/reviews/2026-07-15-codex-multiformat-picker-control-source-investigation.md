# Review: Multi-format Picker-Control Source Investigation

## 1. Summary

This source-only successor investigates the installed picker-control blocker
reported after Permit 083 for `ASV-REQ-20260709-003` / bundled multi-format
conformance. The installed app opened Launch, invoked the named Open command,
and the native chooser disappeared before QA or PM selected, canceled, typed,
or closed it.

Status: Implementation Ready for PM audit and Code Review routing. This is not
runtime, installed, foreground, QA, Packaging, or Product Owner acceptance
evidence.

## 2. Git State

- Branch: `codex/0.2-picker-control-source-investigation-20260715`
- Base / installed combined source under investigation:
  `a0958d82330c62d348eb236ea0248c91ce08e583`
- Product diff SHA-256:
  `47341497bab2f8572fa17869f9d12a4e7ba2f75af16befcef1cece69d760b45d`
- Classified residue: untracked `.pnpm-store/`, preserved and unstaged

## 3. Source Investigation

### Finding

The source path for the Launch/Open command was:

1. renderer `openFromHostDialog()`
2. preload/main IPC open action
3. `openMultiFormatFile()`
4. `chooseMultiFormatLocalFile()`
5. Electron `dialog.showOpenDialog(options)`

`openMultiFormatFile()` invoked the native picker without passing the active
`BrowserWindow` owner. In a foreground-constrained installed session, an
unowned macOS dialog can lose clear ownership if app activation, focus, or
window readiness changes. Source could therefore explain the observed chooser
disappearance class well enough to repair the ownership boundary before another
runtime gate.

### Repair

- `openMultiFormatFile()` now calls `showOpenDialogForActiveMainWindow`.
- The helper fails closed if the active main window is missing or destroyed.
- The helper invokes `dialog.showOpenDialog(activeMainWindow, options)` so the
  native picker is sheet/owner-bound to the Auto SVGA window.
- The existing host picker failure contract remains typed and path-redacted.

This does not change renderer copy, UI styling, placement, playback,
replacement/reset, parsing, recent files, Save/export, or installed bytes.

### Why Prior Source Tests Missed It

Previous picker tests verified filters, delayed cancel, typed host failures, and
renderer normalization. They did not require the native picker call to be owned
by the active `BrowserWindow`.

## 4. Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- this review, retrospective ledger, and visible review packet

## 5. Failure-First Evidence

- The new focused source contract initially failed on the current source
  because `showOpenDialogForActiveMainWindow(options)` did not exist.
- After the repair, the same test proves:
  - `openMultiFormatFile()` routes through the owner-bound helper;
  - the legacy unowned `dialog.showOpenDialog(options)` call is absent from the
    Open path;
  - the helper checks `activeMainWindow` and `isDestroyed()`;
  - no-owner picker failure is typed and path-redacted before any session open.

## 6. Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS.
- Focused picker owner/cancel/filter tests: PASS `3/3`.
- Full multi-format conformance milestone suite: PASS `28/28`.
- `npm run build`: PASS.
- `npm run test:all`: PASS `538/538`.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check`: PASS.

No Electron, Auto SVGA, Finder, native chooser, foreground, installed app,
owner material, package, promotion, or runtime permit was used.

## 7. Next Runtime Discriminator

After PM-owned Code Review and a rebuilt installed candidate, the next QA
discriminator should verify:

1. named Open creates a native picker visibly owned by the Auto SVGA window;
2. Cancel preserves Launch state and 640x640 geometry;
3. valid SVGA/Lottie/VAP picker selection submits through the same host intake
   path.

If the chooser still disappears, the next missing evidence is an installed
macOS dialog lifecycle/runtime ownership trace, not another source-only parser
or renderer hypothesis.

## 8. Boundaries And Nonclaims

This handoff does not close `ASV-QA-20260714-001`, Permit 083, or the full
installed matrix. It does not claim installed picker stability, full matrix
acceptance, pixel fidelity, Product Owner acceptance, public support,
Packaging, distribution, release readiness, save/export/conversion support, or
foreground success.

## 9. Project Retrospective

- Value assessment: High.
- Product lesson: a native picker is an owner-window lifecycle boundary, not
  only a renderer command.
- Technical lesson: host dialogs that affect foreground state should be
  explicitly bound to the active product window when a window owner exists.
- Evidence lesson: helper-level picker safety was insufficient; composed source
  tests must assert ownership at the main-process callsite.
- Avoid next time: do not treat a passing cancel/no-deadline test as evidence
  that the native dialog has a stable macOS owner.

## 10. Token Usage

- Source: unavailable.
- Exact token counts: unavailable.
