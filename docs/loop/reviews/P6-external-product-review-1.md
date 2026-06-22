# P6 External Product Review 1

Date: 2026-06-22

## Outcome

- externalOutcome: `REPAIR_REQUIRED`
- reviewedHeadCommit: `0fda2a601307506f84cc5f87deb1646081bc1889`
- reviewedBaseCommit: `b1b5395412575ed484d255777f9e258b659874bf`
- currentRepairRound: `1`
- nextRepairRound: `2`
- productOutcome: `FULL_WEB_PARITY_NOT_ACHIEVED`

## Blocking Findings

1. Web and Desktop evidence show two different product surfaces.
2. Electron default renderer still uses
   `tools/electron-prototype/experiments/svga-web/web/prototype.js`
   instead of `tools/shared/product-frontend/product-app.mjs`.
3. Electron still uses independent `web/index.html`, `web/prototype.js`, and
   `web/styles.css` instead of a shared product page source.
4. Source-sharing tests only prove Web Preview uses the shared frontend; they do
   not prove the current Electron experiment uses the same page, DOM, JS, and
   CSS.
5. Markdown inventory records 20 regions, 33 features, 10 interactions,
   12 states, and 9 motions, while JSON parity contract records only
   14 regions and 12 features.
6. Missing contract entries include player bars, reference player bar, asset
   preview modal, report grid, floating root, secondary SVGA controls,
   reference media controls, latest artifact scan/load, synchronized replay,
   copy/clear logs, reduced motion/blur settings, status announcements, and
   multiple real playback/panel capabilities.
7. `tools/p6/generate-p6-evidence.mjs` writes unconditional `status: "pass"`
   for every item.
8. Feature, region, interaction, state, and motion items bind the same broad
   artifact set instead of item-specific Web and Desktop evidence.
9. Current parity report cannot detect missing Desktop toolbar, mode switching,
   secondary SVGA comparison, reference media, logs/settings, editor leakage,
   or DOM mismatch.
10. Web and Desktop parity evidence uses different fixtures; Web uses
    `examples/avatar_frame_basic/output/avatar_frame_basic.svga`, while Desktop
    uses a synthetic two-block fixture.
11. No matched Web/Desktop frame-strip or recording evidence exists for required
    motions.
12. Reviewer A/B returned PASS without catching architecture, visual, and
    evidence failures.
13. Packaged App proof uses `--smoke --product-smoke` and does not prove
    Finder-equivalent normal launch.
14. App identity still uses `AutoSVGAInternalPrototype`, not stable product
    identity `Auto SVGA`.
15. P6 Review ZIP contains local absolute paths and omits the actual macOS App
    ZIP as required user-test material.

## P6-PF1 Disposition

- P6-PF1 head: `c832f12bfe521442b037c36346e8408ad07ef1cc`
- status: `SUPERSEDED_BY_P6_REPAIR`

Reasons:

1. PF1 tests the old Desktop product surface.
2. PF1 does not prove Web/Desktop parity.
3. PF1 is historical evidence only and must not be used as P6 acceptance.
4. PF1 reports and tools may be reused selectively, but PF1 terminal status,
   final response, and old App identity must not be cherry-picked into P6
   acceptance.

## Required Repair Direction

1. Reconcile Markdown inventory and JSON contract without shrinking Web source
   of truth.
2. Make Electron default surface load the same shared product frontend as Web.
3. Hide P3-P5 editor incubation by default.
4. Use identical fixture bytes for Web, Desktop, and packaged App parity.
5. Generate item-specific region, feature, interaction, state, and motion
   evidence.
6. Replace unconditional parity PASS generation with computed checks.
7. Prove normal Finder-equivalent macOS App launch.
8. Produce privacy-clean portable review and App ZIP artifacts.
