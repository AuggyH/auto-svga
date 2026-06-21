# P5 Owner Roadmap Reset

Date: 2026-06-22

ownerDecision: `DEFER_P5_PRODUCT_ACCEPTANCE_AND_RESET_MAINLINE`
reviewedP5Head: `b1b5395412575ed484d255777f9e258b659874bf`
P5Status: `DEFERRED_AS_EDITOR_INCUBATION`
archiveBranch: `archive/p5-editor-incubation`

## Decision

P5 is deferred as editor incubation.

P5 is not PASS.
P5 is not failed.
P5 is not abandoned.
P5 Repair 3 is canceled.

## Reason

P5 batch resource editing is technically valuable, but the current product mainline must first fully desktopize the mature Web Preview. The default Desktop product must not expand generic editor scope until Web Preview parity and the macOS internal app are accepted.

## Preservation Rules

- Preserve P3-P5 code, tests, history, and evidence.
- Do not delete editor incubation work.
- Hide or isolate P3-P5 editor UI in the default Desktop product.
- Allow access only through an explicit developer feature flag.
- Keep the feature flag off by default.
- Do not continue P3-P5 product UX improvements during P6.
- Reconnect editor incubation only in a later accepted milestone.

## Next Mainline

P6: Web Preview Full Parity, Shared Frontend And macOS Internal App.
