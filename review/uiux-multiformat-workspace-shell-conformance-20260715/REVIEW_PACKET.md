# Multi-format Workspace Shell Conformance

## Binding

- Product line: Auto SVGA multi-format workspace integration
- UI/UX base: `7cba862ed25986a0a50970222077dc5820e5f0aa`
- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Original milestone head: `1ca67dce21a185559a7821ccf746747cb4c09273`
- Authority repair head: `8b8f9221ee70d6e1df6fdcf2a88307ff6dfb7034`
- First product repair head: `2247303be8a58049c7600ea77a37fd42c78d57f5`
- Root-cause projector repair head: `5f6f1b781f5d9d3e8c33fc5f6b90c3123368be88`
- Root-cause repair diff SHA-256: `efa2f8e911c90ad9780d612739dfa20edb85e03b77465c33555e1a502980f068`
- Validation summary SHA-256: `4dc7df0259079c7484cce4033cf7c26c2cb2c4c78479a675a687d1914a99767e`
- Formal review: `docs/reviews/2026-07-15-codex-uiux-multiformat-workspace-shell-conformance.md`
- Review upload: `uiux-multiformat-workspace-shell-conformance-20260715-review.zip`
- Status: Fix Ready for independent Code Re-review

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
- Owner issues and unsupported rows use a closed Chinese product vocabulary;
  unknown host/runtime message, code, feature, and path values cannot appear in
  the visible projection.
- Failure feedback uses an immutable exact-code vocabulary. Raw Chinese paths,
  mixed-language technical messages, unknown codes, objects, arrays, accessors,
  coercible values, and host extra fields all fall back to one fixed generic
  Chinese failure without evaluating their content.
- Cancel preserves the current document. An accepted Open failure clears prior
  Lottie, VAP, or SVGA authority and disables all stale document commands.
- The independent right-panel projector now constructs facts, assets,
  inventory, groups, items, issues, and unsupported-feature rows from fixed
  schemas. It does not spread upstream objects or evaluate accessors,
  `toString`, `Symbol.toPrimitive`, array coercion, or template coercion.

## Evidence

- Existing focused interaction regressions: `3/3` PASS.
- Direct CR repair regressions: `4/4` PASS.
- Root-cause projector regressions: `2/2` PASS, including exact output key
  sets, zero getter/coercion calls, and nested raw-field rejection.
- Multi-format conformance suite: `27/27` PASS.
- Desktop design-system check: PASS.
- Full Electron prototype suite: `113/113` PASS.
- Syntax and diff checks: PASS.
- Dependency overlays were lockfile-matched, ignored, temporary, and removed.
- Machine-readable validation bytes:
  `VALIDATION_SUMMARY.json` (SHA-256
  `4dc7df0259079c7484cce4033cf7c26c2cb2c4c78479a675a687d1914a99767e`).

## Reconciliation dependencies

- Per-row Lottie/VAP Reset is intentionally not simulated on base `7cba862e`.
  Successor `6a464087...` is under independent re-review; after approval its
  target-scoped authority must be inspected and integrated into shared
  `AssetRow`/right-surface interaction.
- Foreground placement validation is paused after three pre-product-input
  infrastructure failures. A later launch-placement contract must preserve the
  owner's normal display choice and reserve any display override for a bounded
  acceptance task.
- UI/UX accepts the PM placement separation: normal launch restores a valid
  online-display placement and clamps it to the work area, otherwise falls
  back to primary; a hidden internal-candidate acceptance override may select
  only an exact display ID, has no UI or coordinates, and never persists.
- For a saved window spanning displays, choose the display with the greatest
  intersection area and use a deterministic tie-break. Keep the complete
  standard window, including native titlebar, inside the selected work area.

## Remaining gates

- Independent source Code Re-review of root-cause repair `5f6f1b78` and its
  final docs-only handoff descendant. `UIUX-MF-SHELL-CR-001` remains open until
  that independent disposition.
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
