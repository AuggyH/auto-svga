# ASV-QA-20260714-001 Multi-format Conformance Packet

## Binding

- Requirement: `ASV-REQ-20260709-003`
- Parent QA ticket: `ASV-QA-20260714-001`
- Children: `ASV-QA-20260714-002` through `ASV-QA-20260714-008`
- Branch: `codex/0.2-multiformat-conformance-milestone-20260714`
- Base: `59f4001230a7f2834f3374034fa1e0cf5da83e14`
- Accepted shell authority selectively preserved: `c012dad6c3e84648e76c9d95c3d6193d65fe945c`
- Final exact head: supplied in the Fix Ready callback; this packet is tracked by that head
- Status: Fix Ready for independent Code Review; QA tickets remain open

## Product Change

- One Launch-to-Preview architecture now owns picker, drag, menu, file-open,
  recent files, stage layout, runtime controls, and capability facts.
- Formal 0.2 delegates SVGA editing, comparison, optimization, rename, and save
  commands to the accepted short-term controller instead of nulling them.
- Lottie and VAP retain their reviewed parser/player contracts and local-only
  ancillary-resource handling.
- Cancel remains a Launch-state no-op; accepted input alone starts Loading.
- The right panel hides not-applicable groups and internal phase labels while
  preserving genuine format warnings.

## Evidence

- Focused/related Electron tests: `99/99` PASS.
- Build: PASS.
- Full project suite: `532/532` PASS.
- Desktop design-system check: PASS.
- Source/material conformance proof: PASS; final exact-head path and SHA are in
  the Fix Ready callback.
- Hidden real-rendering regression: real SVGA canvas, live Lottie SVG, and real
  VAP WebGL/video all load, advance, pause stably, balance lifecycle, and make
  no external requests; final exact-head path and SHA are in the callback.
- Private inputs remain mode 0600; durable material references use aliases and
  hashes only.

## Remaining Gates

- Independent Code Review of UI, host, preload/IPC, filesystem, and playback boundaries.
- Rebuilt installed QA of the complete Launch/Preview/product/design matrix.
- A new real-runtime VAP fusion replacement/reset replay was not run because
  the historical task-owned fusion fixture was unavailable. Existing source
  behavior and regressions remain intact; this is an explicit evidence gap.

## Nonclaims

- No QA ticket closure.
- No installed-app mutation, package, promotion, or foreground action.
- No Product Owner acceptance, support, distribution, or release claim.
