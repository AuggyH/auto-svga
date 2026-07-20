# ASV-QA-20260714-001 Native Picker Repair Packet

## Binding

- Requirement: `ASV-REQ-20260709-003`
- Parent QA ticket: `ASV-QA-20260714-001`
- Findings: recurring `006`, new `009`, and `MF-NATIVE-PICKER-CR-001`; prior
  `002..005` and `007..008` preserved
- Branch: `codex/0.2-multiformat-native-picker-repair-20260715`
- Base / failed installed source: `3231f2beb6c34de6cfe020dc5f62159ec6d45f7d`
- Status: Fix Ready for PM-owned Code Re-review and rebuilt installed QA

## Product Change

- The macOS chooser exposes local files instead of depending on unavailable
  custom-type inference, then the host admits only SVGA, JSON, or MP4 into the
  existing bounded format parser.
- Human chooser wait no longer consumes the renderer's 15-second load-terminal
  deadline. Exact Cancel remains Launch with no session open or window resize.
- Drag, file-open, ancillary-resource discovery, parsing, real rendering,
  replacement/reset, recent files, and formal 0.1 SVGA behavior are unchanged.
- Reviewed host failures now cross the composed renderer boundary as typed,
  path-redacted owner outcomes. The renderer accepts only the exact reviewed
  codes and supplies its own safe copy; arbitrary host messages are ignored.

## Evidence

- Focused picker/cancel: `5/5` PASS.
- Composed failure-first: `2/2` FAIL before repair and `2/2` PASS after repair.
- Bundled conformance: `20/20` PASS.
- All Electron experiment tests: `104/104` PASS.
- Build: PASS.
- Full compiled project suite: `532/532` PASS.
- Desktop design-system: PASS.
- Private-binding source proof: real SVGA, Lottie, and VAP picker selections
  reach `previewReady` and prepared runtime payloads; delayed cancel opens no
  session and changes no window mode.
- Native Open-button acceptance is deliberately not claimed by source proof;
  rebuilt installed QA remains required.

## Remaining Gate

PM-owned exact-head Code Re-review, exact rebuild/install, then resume the same
installed matrix at native cancel and one SVGA/Lottie/VAP submit each.
Downstream rows remain open until QA directly runs them.

## Nonclaims

No ticket closure, package, promotion, installed mutation, foreground action,
Product Owner acceptance, support, distribution, or release claim.
