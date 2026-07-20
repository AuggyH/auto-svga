# Figma MCP UI/UX Read Plan Review

Owner lane: UI/UX
Date: 2026-07-07
Status: planning and research only

## Summary

Created the complete Figma MCP read and UI/UX work-package plan for the
short-term client visual refinement pass:

- `docs/research/figma-mcp-uiux-read-plan.md`

This review does not change app UI and does not perform any new Figma MCP read
calls. It uses Batch 01 from `docs/research/figma-mcp-call-log.md` as the
baseline.

## What The Plan Establishes

- A hard budget model for Professional + Full plan usage:
  - 160 quota-counted reads as practical daily budget
  - 40 calls reserved for recovery
  - 6 calls/minute operating cap
- A full read sequence:
  - R1 target screenshot archive
  - R2 exact token values and code mapping
  - R3 corrected component index
  - R4 core component contracts
  - R5 page-state metadata by active WP
  - R6 targeted rechecks only
- Payload limits to prevent truncation:
  - no whole-page deep dumps
  - no nested component-library dump
  - max 80 nodes per structured read
  - depth 2 by default
  - component-by-ID detail reads only
- A short-term UI/UX WP split:
  - WP0 Figma evidence and token preparation
  - WP1 token/theme foundation
  - WP2 core atoms and controls
  - WP3 launch and canvas shell
  - WP4 preview default right surface
  - WP5 optimization flow
  - WP6 compare and drag decision
  - WP7 edit/settings/loading/save/error states
  - WP8 final pixel and product evidence closure
- Recovery behavior for rate limits, timeouts, truncation, stale screenshot
  URLs, missing node IDs, and design changes.

## Sources Consulted

Project sources:

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `DESIGN.md`
- `docs/research/figma-mcp-uiux-call-protocol.md`
- `docs/research/figma-mcp-call-log.md`

Official Figma sources:

- https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- https://developers.figma.com/docs/figma-mcp-server/avoid-large-frames/
- https://developers.figma.com/docs/figma-mcp-server/stuck-or-slow/
- https://developers.figma.com/docs/figma-mcp-server/images-stopped-loading/

## Changed Files

- `docs/research/figma-mcp-uiux-read-plan.md`
- `docs/reviews/2026-07-07-codex-figma-mcp-uiux-read-plan.md`

## Verification

- Documentation-only change.
- `git diff --check` should be run before commit.

## Risks

- The plan assumes the current Figma node IDs from Batch 01 remain stable.
  If the design file is reorganized, the next read should refresh only the
  affected inventory, not the whole file.
- Pixel-level restoration still depends on future archived Figma screenshots
  and real foreground macOS client screenshots.

## Next Step

Run R1 screenshot archive before UI implementation:

1. capture 12-15 key state screenshots from known node IDs;
2. save screenshots outside Git;
3. write manifest and hashes;
4. update the Figma MCP call log;
5. then run R2 token extraction.
