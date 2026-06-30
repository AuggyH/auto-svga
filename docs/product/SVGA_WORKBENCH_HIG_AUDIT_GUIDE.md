# SVGA Workbench HIG Audit Guide

Date: 2026-06-30
Scope: SVGA Workbench v1 desktop product work, evidence capture, and future UI repairs.

## Source Study

This guide distills the local Apple Human Interface Guidelines study performed
before the 2026-06-30 Workbench UI audit. The crawl covered 172 official HIG
topic pages under:

- https://developer.apple.com/design/human-interface-guidelines
- Getting started, Foundations, Patterns, Components, Inputs, and Technologies
- Design topics including accessibility, layout, motion, typography, color,
  privacy, modality, feedback, loading, settings, menus, scroll views, tab
  views, toolbars, focus, keyboard, and pointing devices

The local study artifact remains at
`.artifacts/ui-audit/2026-06-30-hig-study/HIG_STUDY_DIGEST.md`.

## Workbench Rules

Use these rules for future SVGA Workbench implementation and review:

1. Keep the current task, status, and next action visible without hunting.
2. Treat errors as actionable content. If a count says errors exist, show the
   first errors or a clear path to open them.
3. Preserve comfortable pointer targets for repeated actions. Keep compact
   visuals when useful, but expand hit areas and focus rings.
4. Make full rows clickable for dense resource, layer, settings, and menu items.
5. Keep only one task context visually dominant. Modals should not compete with
   open drawers or busy panels.
6. Keep scrollable content discoverable and reachable. Avoid initial modal
   positions that make headings look clipped.
7. Keep keyboard focus predictable: visible focus, modal trap, Escape close,
   focus return, and Space/Enter behavior for controls.
8. Keep loading states honest. For slow or interruptible work, keep a visible
   cancel or change-file path.
9. Make proof phases visually distinguishable. Smoke-only, partial, blocked,
   and product-exposed states must not look equivalent.
10. Preserve text integrity at minimum window sizes: no overlap, accidental
    cropping, or one-character wrapping in dense panels.
11. Respect reduced motion and reduced blur settings in every new animated or
    translucent surface.
12. Keep privacy and security metadata truthful. Do not add permission strings,
    arbitrary network allowances, telemetry claims, or Finder document
    associations unless the app actually implements and validates them.

## Current UI Audit Findings

The 2026-06-30 audit is now part of the Workbench v1 repair package. It found:

- P1 repaired: Diagnostics reported `25 errors` while the detailed area looked
  empty. The inspector now uses a two-row header/content grid, shows visible
  issue cards below the count, and records first-issue visibility in smoke
  proof.
- P2 repaired: Repeated toolbar icon targets now use a 36px practical hit area
  in the Workbench toolbar, and smoke layout proof records comfortable toolbar
  targets.
- P2 repaired: Opening Settings now closes the active diagnostics/log side
  panel first, keeping one dominant modal context.
- P2 repaired: Settings resets its internal scroll position on open, and smoke
  proof records `settingsBodyScrollTop: 0` plus an unclipped first section.
- P3 repaired: Loading keeps a visible header `更换文件` action while hiding the
  in-stage empty CTA, so slow loads retain a clear change-file path.
- P3 repaired: Sequence proof cards now distinguish `readonly`, `partial`, and
  `blocked` states with visible state pills and state-proof fields.
- P3 repaired: Dense resource rows are focusable, named, selectable with
  Enter/Space, and row/action hit-area proof is recorded in desktop smoke.
- P3 repaired: Preview-card headers now reserve stable space for actions and
  ellipsize long file titles inside the title region.

Remaining known UI/UX debt after the current repair:

- Diagnostics issue cards are visible but still dense when many similar errors
  are present.
- Long single-file names are contained, but the header remains visually tight
  at narrow widths.
- Settings still needs a fuller manual scroll/keyboard pass across every row
  and advanced disclosure state.
- Source/resources and diagnostics lists need a broader screen-reader review;
  current proof covers keyboard focus and visible hit points, not VoiceOver.
- The full screenshot audit should be refreshed as a dedicated evidence bundle
  before Product Owner UI acceptance.

These are repair inputs for future Workbench implementation. They are not
Product Owner acceptance blockers by themselves unless they hide a required
workflow, break keyboard access, or invalidate review evidence.

## Evidence Requirements

When UI work changes Workbench behavior, include:

- Desktop screenshots for empty, loading, loaded, invalid, recovered, playing,
  paused, diagnostics, resources, layers, settings, modal, menu, and narrow
  window states.
- Keyboard evidence for Tab, Shift+Tab where relevant, Escape, Enter, Space,
  focus trap, and focus return.
- Scroll evidence for every panel that can overflow.
- Hit-area evidence for high-frequency controls.
- Reduced-motion and reduced-blur evidence when transitions or materials change.
- A short status note separating implemented behavior, smoke-only proof,
  blocked work, and manual visual confirmation.
