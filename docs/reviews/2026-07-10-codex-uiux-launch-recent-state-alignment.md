# UI/UX Launch Recent-State Alignment - 2026-07-10

Owner lane: UI/UX

Version context: Auto SVGA `0.1.x` / SVGA Preview MVP

## Summary

This pass refines the Launch page layout using the established three-source
rule:

- token: named Launch offset token;
- component: `LaunchDropCanvas`, `FileDropTarget`, and `LaunchRecentFilesList`;
- page state: R4/R6/R8 Launch frame and module contract.

When recent records exist, the Launch content now follows the R4 module
positioning: the empty-canvas prompt starts after the titlebar plus the
approved module offset. When no recent records exist, the central open-file
operation remains visually centered and dominant.

No visible copy, recent-file behavior, drag/drop behavior, menu command, or
file-open logic changed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs` passed, `36/36`.

No Figma MCP call, package refresh, local stable promotion, or foreground
macOS screenshot was used for this small page-level alignment. Final visual
acceptance still needs bundled smoke/foreground evidence after more page polish
is grouped.

## Retrospective

Effective: medium. This is a small visible-layout refinement, but it matters
because Launch is the clearest 1:1 page state and now has a state-aware layout
rule instead of relying only on generic centering.

Cost control: good. Existing R4/R6/R8 packets were enough; validation was
bundled with the existing design-system check and test suite.

Risk: the CSS uses `:has()` for the recent-record state. Electron's Chromium
runtime supports it, but final owner-visible packaged evidence should still
include Launch with and without recent records.

## Token Usage

Source: unavailable.
