# UI/UX -> Product Manager Sync: Short-term Skeleton Review

Date: 2026-07-02
Owner: Codex UI/UX
Audience: Product Manager
Status: product reviewed; PM correction recorded

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

## Original Product Decisions Requested

The questions below were the original UI/UX-to-PM request. They are answered
by the PM Review Result later in this document.

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

## Suggested PM-owned Document Updates

When Product Manager approves any item above, update the PM-owned product docs,
not only this UI/UX sync note:

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

## PM Review Result

Date: 2026-07-02
Reviewer role: Product Manager

Correction note: the UI/UX-side Owner confirmation covered the layout and
interaction skeleton. The product-scope decisions below are recorded by the
Product Manager after the Product Owner's direct correction in the PM thread.
The previous interpretation that recent files were only a prototype/future
candidate was incorrect.

### 1. Recent files

Decision: approved for the short-term formal product scope.

Short-term conditions:

- The launch page shows up to five recent SVGA records below the primary Open
  and Drag In actions.
- `File > Recent` shows up to ten recent SVGA records and a clear-history
  action.
- Recent records must be real short-term release behavior, not static prototype
  rows.
- Recent labels must hide full local paths by default. Filename plus minimal
  parent-folder context is acceptable for disambiguation.
- Opening a recent record must use the same validation, loading, playback, and
  error-recovery flow as Open or Drag In.
- Missing or inaccessible files must show recoverable feedback and must not
  leave stale metadata on screen.

PM-owned docs updated:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`

### 2. Safe optimization batch action

Decision: approved as a short-term one-click optimization action, constrained
to safe executable optimization items.

Short-term conditions:

- The batch action may include only safe, deterministic optimization items that
  can produce optimized bytes and pass round-trip safety proof without human
  review.
- Review-only, risky, unsupported, or visually ambiguous findings must not be
  executed by the batch action.
- Items that need review require separate per-item review, explicit
  confirmation, or remain suggestion-only.
- `一键优化` may be used as the product label when visible copy states that only
  safe executable items are batched. More explicit labels such as `执行安全优化`
  or `生成安全优化副本` are also acceptable.
- UI copy should distinguish `可安全执行`, `需复核`, and `暂不支持/建议项`.

PM-owned docs updated:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
