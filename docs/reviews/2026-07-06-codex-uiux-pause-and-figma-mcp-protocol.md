# UI/UX Pause And Figma MCP Protocol Review

Owner lane: UI/UX
Status: paused pending finalized Figma design
Date: 2026-07-06

## Summary

The short-term UI/UX implementation task is paused at the Owner's request. No
new UI polish should continue until the Owner says the Figma design稿 is final
enough to follow or explicitly identifies a frame/component to implement.

This review records the current UI/UX state and adds an operating protocol for
quota-safe Figma MCP usage:

- `docs/research/figma-mcp-uiux-call-protocol.md`

## Current Product And Design Boundary

The PRD authority remains:

- `docs/product/PRODUCT_ROADMAP.md`

Subordinate UI/UX and design-system inputs remain:

- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `DESIGN.md`

The current Figma design file is in the Professional plan. It is not yet final
implementation authority.

## Current UI/UX Progress

Completed and committed before this pause:

- Design-system structure and componentization groundwork.
- Canvas-first visual direction applied across the short-term shell.
- Launch, preview information, asset list, playback controls, edit reserved
  surface, compare empty surface, drag decision overlay, settings appearance,
  and several right-surface hierarchy polish slices.
- Foreground desktop screenshot evidence has been collected across many slices
  under `review/uiux-high-fidelity-packages/`.

Not yet complete:

- Final Figma-guided visual precision pass.
- Final requirement-by-requirement UI/UX acceptance matrix.
- Final packaged-App visual pass after design稿 freeze.
- Final comparison between approved Figma frames and real foreground desktop
  screenshots.

## Frozen Working Tree State

At pause time, the branch is:

- `agent/codex/svga-workbench-v1-autonomous`

Current HEAD:

- `69d2a5c1 docs: expand project baseline retrospective`

Uncommitted UI/UX files at pause time:

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

The frozen uncommitted slice softens optimization-result action hierarchy:

- removes the result group status rail / inset shadow
- keeps result groups visually lower-boundary
- makes secondary optimization-result actions transparent
- centers optimization-result action buttons
- updates the regression test expectations accordingly

This slice should either be committed when the UI/UX lane resumes, or reviewed
and adjusted against the finalized Figma design. Do not silently revert it.

## Verification Already Run For Frozen Slice

The frozen uncommitted slice was validated before the pause with:

- design-system check: passed
- short-term Electron web tests: 31/31 passed
- `git diff --check`: passed
- desktop smoke: passed
- foreground screenshots captured under:
  `review/uiux-high-fidelity-packages/foreground-hf34-completion-review-20260706/`

Key screenshot for the frozen slice:

- `review/uiux-high-fidelity-packages/foreground-hf34-completion-review-20260706/05-display2-optimization-result-actions-polished.png`

This evidence proves the slice did not break automated flow or immediate
foreground rendering. It does not claim final UI/UX acceptance.

## Figma MCP Research Result

Official Figma MCP constraints relevant to Auto SVGA:

- Professional + Full/Dev seat: up to 200 read calls per day and 10 per minute.
- Rate limits apply to Figma MCP tools that read data from Figma.
- Figma lists `whoami`, `generate_figma_design`, and `add_code_connect_map` as
  examples exempt from those read limits.
- Figma recommends smaller sections/components instead of large heavy frames.
- Figma Make AI credits are separate from MCP read-call limits and vary by
  model, task complexity, and context size.

The Auto SVGA UI/UX lane should use 160 calls/day as the practical working
budget and reserve the rest for recovery.

## Resume Conditions

Resume UI implementation only when one of these is true:

1. Owner says the Figma design稿 is final enough to implement.
2. Owner names specific Figma frames/components to follow.
3. Owner explicitly asks to continue non-Figma local polish.

Before resuming from Figma:

1. Read `docs/research/figma-mcp-uiux-call-protocol.md`.
2. Create a read batch plan before any MCP read call.
3. Avoid the Figma page named `备份`.
4. Record every batch in the implementation review.
5. Use real foreground desktop screenshots for visual acceptance.

## Sources

- https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- https://developers.figma.com/docs/figma-mcp-server/avoid-large-frames/
- https://help.figma.com/hc/en-us/articles/33459875669015-How-AI-credits-work
- https://help.figma.com/hc/en-us/articles/40097793879191-Best-practices-for-optimizing-AI-credits-in-Figma-Make

## Changed Files

- `docs/research/figma-mcp-uiux-call-protocol.md`
- `docs/reviews/2026-07-06-codex-uiux-pause-and-figma-mcp-protocol.md`

Existing uncommitted implementation files remain frozen and are not part of
this documentation-only review.
