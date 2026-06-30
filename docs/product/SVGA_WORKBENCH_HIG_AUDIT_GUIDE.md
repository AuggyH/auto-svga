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
- P2: Some toolbar and switch targets are smaller than comfortable HIG-style
  hit areas.
- P2: Settings can open over a logs drawer, creating a noisy modal context.
- P2: Settings initial scroll position clips the next section heading.
- P3: Loading hides the primary file action.
- P3: Sequence proof states are visible but hard to distinguish.
- P3: Dense resource filters and inline actions must preserve row-level click
  and focus behavior.

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
