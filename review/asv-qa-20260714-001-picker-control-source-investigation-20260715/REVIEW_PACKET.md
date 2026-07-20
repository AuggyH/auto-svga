# ASV-QA-20260714-001 Picker-Control Source Investigation Packet

## Binding

- Requirement: `ASV-REQ-20260709-003`
- Parent QA ticket: `ASV-QA-20260714-001`
- Installed symptom under investigation: Permit 083 native chooser disappeared
  before QA/PM cancel/select/typing/close action
- Branch: `codex/0.2-picker-control-source-investigation-20260715`
- Base / installed combined source:
  `a0958d82330c62d348eb236ea0248c91ce08e583`
- Product diff SHA-256:
  `47341497bab2f8572fa17869f9d12a4e7ba2f75af16befcef1cece69d760b45d`

## Source Change

`openMultiFormatFile()` now opens the native file picker through an
active-window owner helper:

- fail closed if the active main window is missing or destroyed;
- call `dialog.showOpenDialog(activeMainWindow, options)`;
- preserve the existing host picker result and typed redacted failure contract.

The repair is intentionally narrow. It does not touch renderer styling,
placement, playback, parser behavior, recent files, replacement/reset, Save,
export, packaging, or installed bytes.

## Failure-First Evidence

The new source contract failed before the repair because the owner-bound helper
did not exist. After repair, it verifies that the Open path no longer calls
unowned `dialog.showOpenDialog(options)` and that missing owner failure remains
typed/path-redacted.

## Validation

- `node --check tools/electron-prototype/experiments/svga-web/main.cjs`: PASS.
- Focused picker owner/cancel/filter tests: PASS `3/3`.
- Full multi-format conformance milestone suite: PASS `28/28`.
- `npm run build`: PASS.
- `npm run test:all`: PASS `538/538`.
- Desktop design-system check: PASS.

## Next Gate

PM-owned Code Review, then a rebuilt installed candidate may rerun the native
picker discriminator: owner-bound Open, exact Cancel no-op, and supported
SVGA/Lottie/VAP picker submission.

## Nonclaims

No installed-app mutation, foreground run, native chooser execution, Finder,
owner material, package, promotion, QA route, ticket closure, Product Owner
acceptance, support, distribution, or release readiness claim.
