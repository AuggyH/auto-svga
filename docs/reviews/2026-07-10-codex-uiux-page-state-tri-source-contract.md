# UI/UX Page-State Tri-Source Contract - 2026-07-10

Owner lane: UI/UX

Version context: Auto SVGA `0.1.x` / SVGA Preview MVP

## Summary

This pass adds a traceable page-state layer to the existing Figma-to-code
design-system map. The goal is to keep future high-fidelity page polish
anchored to three sources at once:

- token/layout values;
- Atom / Molecule / Module component mapping;
- Figma page-state frame dimensions and module composition.

No product behavior, visible copy, menu command, save flow, optimization logic,
or drag/drop logic changed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/design-system-map.json`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Requirement Checks

- Product authority remains `docs/product/PRODUCT_ROADMAP.md`.
- `DESIGN.md` remains a design-system manifest, not product scope authority.
- The implementation uses existing Figma read packets only; no new Figma MCP
  call was made.
- The new mapping covers Launch, Preview, Optimization Detail, Optimization
  Result, Compare Empty, Compare Loaded, Edit Default, and Settings.
- Launch remains a `640 x 640` design/window target, separate from workbench
  page states.
- Workbench page-state design targets remain `1280 x 800`, with the Preview /
  Compare center/right composition represented as `920 + 360`.
- Edit retains the `360 + 560 + 360` page-state contract without adding edit
  actions beyond the current short-term scope.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, `36/36`.

No desktop smoke, package refresh, local stable promotion, or foreground
macOS screenshot was run for this pass because it is a design-system/page-state
traceability change rather than final owner-visible visual acceptance.

## Retrospective

Effective: yes. The change moves high-fidelity work away from page-by-page CSS
guessing by giving future WPs a machine-checkable page-state contract.

Cost control: good. Existing R6/R8/R9/R10 packets were sufficient, so no Figma
MCP quota was spent. Verification stayed bundled to design-system check and the
existing unit suite.

Risk: this does not prove final pixel-level alignment. It only makes later
page-level polish more disciplined by requiring token, component, and
page-state evidence to line up.

Next: proceed to page-level visual polish in this order: Launch, Preview,
Compare, Edit, Settings. Each page WP should cite token/component/page-state
inputs before changing selectors.

## Token Usage

Source: unavailable.
