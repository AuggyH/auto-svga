# Review: ST-RC0 Host Scope Boundary

## Summary

Closed one short-term RC0 scope leak in the Electron host boundary: the formal
desktop product bridge now disables the mid-term sequence-repair Save As API
when `productMilestoneId` is `short-term`, and the formal desktop product entry
only token-binds `/api/svga-sequence-repair` for non-short-term legacy/evidence
milestones.

The legacy prototype bridge still keeps historical P3/P4/P5/P6 evidence hooks
so old proof paths remain testable, and legacy product smoke milestones keep
their existing bridge behavior. The short-term milestone is explicitly scoped
down.

## Git State

- Base before this change: `2f01d469 docs: expand mid-term product roadmap`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Unrelated untracked file left untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs`
  - Adds separate product and legacy prototype preload API builders.
  - Keeps `createPreloadApi` as the legacy compatibility alias for historical
    tests.
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
  - Exposes `autoSvgaElectronHost` with product-scoped capabilities.
  - Exposes `autoSvgaPrototype` with historical prototype capabilities.
- `tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs`
  - Gates `/api/svga-sequence-repair` token binding to non-short-term
    milestones.
  - Changes no-bridge milestone fallback from `P6` to `short-term`.
- `tools/electron-prototype/experiments/svga-web/web/prototype.js`
  - Makes the historical prototype prefer the legacy bridge.
- `docs/product/ROADMAP_UI_CAPACITY_MAP.json`
  - Adds the missing `mid_term_adapter_foundation` reserved capacity status
    required by the visual-system audit after the mid-term roadmap update.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds regression coverage for the product/legacy bridge split.
  - Adds regression coverage that the formal desktop entry does not expose the
    sequence-repair API path.

## Requirement Checks

| Check | Status |
| --- | --- |
| Do not return to broad UI polish/layout-system work | Done |
| Do not swap in the current short-term UI shell as the real product | Done |
| Keep historical P3/P4/P5/P6 evidence paths available | Done |
| Formal short-term bridge excludes sequence repair Save As | Done |
| Formal desktop entry excludes short-term `/api/svga-sequence-repair` token binding | Done |
| Legacy evidence smoke keeps sequence repair bridge available | Done |
| Visual-system capacity map includes `mid_term_adapter_foundation` | Done |
| App package release readiness | Prep ready, release blocked by external review/signing credentials |

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/preload.cjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/desktop-product-entry.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/prototype.js`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - Passed: 28 tests.
- `node --test tools/shared/product-frontend/source-sharing.test.mjs`
  - Passed: 7 tests.
- `npm run desktop:smoke`
  - Passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  - Passed.
- `node tools/svga-workbench/run-packaged-runtime-proof.mjs`
  - Passed.
- `node --test dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-app-state.test.js tools/shared/product-frontend/short-term-product-state.test.mjs tools/shared/product-frontend/short-term-product-shell.test.mjs`
  - Passed: 25 tests.
- `npm run svga-workbench:v1:validate`
  - Passed: 15 commands, failed list empty.
- `npm run svga-workbench:v1:distribution-readiness`
  - `passed=true`
  - `releaseCandidateReady=false`
  - `state=PREP_READY_RELEASE_BLOCKED`
  - Blocked by Product Owner review gate, macOS signing identity, and macOS
    notarization credentials.

## Risks

- The old shared `product-shell.html` / `product-app.mjs` still contain
  historical export-review and sequence-repair code for P6 evidence lineage.
  This change intentionally does not remove that code.
- The current short-term shell remains a UI/UX skeleton artifact, not the real
  connected product shell. This change does not route the packaged desktop app
  to that shell.

## Next

- Continue finite ST-RC0 closure by scanning the remaining main-process and
  command surfaces for short-term authority drift.
- Keep release acceptance separate from distribution preparation; current
  release blockers remain external review/signing/notary items.
