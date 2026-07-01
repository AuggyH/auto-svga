# UI/UX -> Product Manager Sync: Short-term Skeleton Review

Date: 2026-07-02
Owner: Codex UI/UX
Audience: Product Manager
Status: product review requested

## Boundary

This document is not a PRD and does not update product scope. It records UI/UX
prototype changes that need Product Manager review before any authoritative
product document is changed.

The current product authority remains `docs/product/PRODUCT_ROADMAP.md`.

## Confirmed UI/UX Skeleton Direction

The short-term UI skeleton now appears workable for layout and interaction
review. It remains a low-fidelity implementation skeleton, not final visual
design.

Implemented skeleton decisions:

- Launch page uses one full-window central canvas/drop surface.
- Launch primary hierarchy is `拖入文件` plus `打开文件`.
- Preview/Edit mode switch stays near the left side of the toolbar.
- Compare sits to the right of the Preview/Edit switch.
- Overview shows production-spec status inline with file facts instead of a
  separate production-spec module.
- Temporary identity/playback status copy was removed from the preview surface.
- File menu uses a nested `Recent` submenu instead of direct recent-file rows.

## Product Decisions Requested

### 1. Recent files

Prototype behavior:

- Launch canvas shows five low-emphasis recent-file rows.
- File menu shows ten recent-file rows under `File > Recent`.
- Current implementation is static only. It does not read paths, persist
  history, expose real local paths, or update records after opening files.

PM questions:

- Should recent files be included in the short-term release scope?
- If yes, should records be path-redacted, filename-only, or include folder
  context?
- Should the launch page show five records and the menu show ten records?
- Should recent history be cleared, disabled, or hidden for privacy-sensitive
  workflows?

### 2. One-click optimization

Prototype behavior:

- Optimization tab includes `一键优化`.
- The prototype batches safe enabled optimizations only.
- Review-only or risky findings, such as sequence-frame processing in the
  fixture, are excluded from one-click execution.

PM questions:

- Should `一键优化` be part of the short-term product scope?
- Should one-click optimization include only safe deterministic operations?
- Should review-only operations require explicit per-item confirmation?
- What copy should distinguish safe execution from review-only findings?

## Suggested PM-owned Document Updates If Approved

If Product Manager approves any item above, update the PM-owned product docs,
not this UI/UX sync note:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md` only if ownership or document
  routing changes

## UI/UX-owned Documents Already Updated

The UI/UX lane has been updated only as subordinate design/prototype context:

- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/reviews/2026-07-01-codex-short-term-ui-shell-implementation.md`

These documents must defer to the main PRD if the Product Manager rejects or
changes any proposal.
