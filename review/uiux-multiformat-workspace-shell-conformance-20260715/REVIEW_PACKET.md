# Multi-format Workspace Shell Conformance

## Binding

- Product line: Auto SVGA multi-format workspace integration
- UI/UX base: `7cba862ed25986a0a50970222077dc5820e5f0aa`
- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Exact implementation head: supplied in the Implementation Ready callback
- Formal review: `docs/reviews/2026-07-15-codex-uiux-multiformat-workspace-shell-conformance.md`
- Status: Implementation Ready for independent Code Review

## Owner-visible change

- SVGA, Lottie, and VAP share the accepted canvas-first Preview workspace
  instead of presenting separate engineering surfaces.
- The right surface is capability-driven, localized, and built from the shared
  fact, row, tab, status, and action components.
- SVGA-to-SVGA drag keeps the documented top 25% Compare / lower 75% Open
  decision. Other format combinations remain Open-only.
- Replaceable image rows expose the existing replacement action directly while
  preserving the host command boundary.
- Loading, failure, close, and format transitions remove stale metadata and
  unavailable actions.
- Light/dark, focus-visible, responsive containment, and state appearance reuse
  the current token system.

## Evidence

- Focused interaction regressions: `3/3` PASS.
- Multi-format conformance suite: `25/25` PASS.
- Desktop design-system check: PASS.
- Full Electron prototype suite: `109/109` PASS.
- Syntax and diff checks: PASS.
- Dependency overlays were lockfile-matched, ignored, temporary, and removed.

## Reconciliation dependencies

- Per-row Lottie/VAP Reset is intentionally not simulated on base `7cba862e`.
  Successor `6a464087...` is under independent re-review; after approval its
  target-scoped authority must be inspected and integrated into shared
  `AssetRow`/right-surface interaction.
- Foreground placement validation is paused after three pre-product-input
  infrastructure failures. A later launch-placement contract must preserve the
  owner's normal display choice and reserve any display override for a bounded
  acceptance task.

## Remaining gates

- Independent source Code Review.
- Reconciliation with an approved target-scoped Reset authority.
- Coordinated installed-client visual/interaction walkthrough with native
  macOS chrome and real owner materials after placement control is repaired.
- Further FBP/Figma MCP evidence only when an exact design fact is missing.

## Nonclaims

- No foreground visual acceptance or pixel-fidelity PASS.
- No Product Owner acceptance.
- No package, promotion, support, distribution, or release claim.
- No visible VAP/Lottie/AEB/deferred editor scope beyond the existing
  multi-format product contract.
