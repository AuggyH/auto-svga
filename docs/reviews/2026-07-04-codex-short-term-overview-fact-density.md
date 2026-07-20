# Codex Review: Short-term Overview Fact Density

Date: 2026-07-04
Agent: Codex
Scope: UI/UX visual-density refinement for the short-term macOS client

## Summary

This slice keeps the Overview file/spec facts in the dense two-column matrix at
compact window heights. A previous compact-height override reintroduced gaps
inside `.factGrid`, which made the facts read like separated cards and weakened
the Owner-preferred close label/value relationship.

No product behavior, visible copy, menu structure, save logic, or inspection
logic was changed.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this slice: `5662066a uiux: reduce short-term tab visual weight`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.page-states.css`
  - Removed the compact-height `.factGrid` gap override.

## Requirement Checks

- Main PRD authority preserved: no change to
  `docs/product/PRODUCT_ROADMAP.md`.
- UI/UX scope preserved: no new feature, module, state, component, label, or
  explanatory copy was added.
- Design-system layering preserved: the change only removes a module-level
  override and continues to use existing tokenized component styles.
- Owner density feedback preserved: Overview facts stay in the two-column
  compact reading pattern instead of becoming a card-like stack.

## Verification

- `npm run desktop:short-term:design-system-check` passed.
- `npm run desktop:smoke` passed.
- Latest automated smoke screenshots refreshed under:
  `.artifacts/product/short-term/`
- Relevant automated screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-minimum.png`

## Foreground Evidence

Foreground capture was attempted against the current packaged app:

- `.artifacts/uiux-foreground/2026-07-04/foreground-launch-current.png`
- `.artifacts/uiux-foreground/2026-07-04/foreground-after-recent-click-current.png`
- `.artifacts/uiux-foreground/2026-07-04/foreground-after-permission-cgclick-current.png`
- `.artifacts/uiux-foreground/2026-07-04/foreground-after-permission-cgclick2-current.png`
- `.artifacts/uiux-foreground/2026-07-04/foreground-after-permission-cgclick3-current.png`

The foreground validation did not reach real-file Preview states because macOS
blocked the current packaged app on a Downloads-folder access prompt while
opening a recent file from `/Users/huangtengxin/Downloads/auto-svga测试物料`.
The prompt could not be dismissed reliably by the available automation path.

Therefore this slice does not claim owner-visible visual/interaction acceptance.
Automated smoke evidence is regression evidence only.

## Risks

- The fix is intentionally narrow and only affects compact-height Overview
  spacing.
- A full foreground pass with multiple real production SVGA files is still
  required after the Downloads permission prompt is handled manually or through
  a cleaner app data setup.

## Next Step

Run a foreground pass from the current packaged app after permission is cleared,
covering Launch, Preview Overview, Optimization, Replaceable, Compare, and Save
Failed states with multiple real SVGA files.
