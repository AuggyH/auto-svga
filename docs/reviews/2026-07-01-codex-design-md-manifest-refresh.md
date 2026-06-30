# DESIGN.md Manifest Refresh Review

Date: 2026-07-01
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Replaced the obsolete Web Preview-focused `DESIGN.md` content with a current
agent-readable design-system manifest for the corrected short-term
macOS-first Auto SVGA app.

The manifest is owned by the UI/UX lane. It keeps product scope subordinate to
`docs/product/PRODUCT_ROADMAP.md`, points detailed UI/UX requirements to
`docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`, and points implementation
discipline to `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`.

The refreshed manifest emphasizes token namespaces, component hierarchy, page
states, macOS interaction rules, accessibility rules, and design-to-code trace
requirements. It explicitly blocks old Web Preview visual-baseline revival and
short-term out-of-scope UI such as export acceptance, sequence-frame repair,
advanced layer editing, batch replacement, AI, accounts, cloud sync, and
telemetry.

## Boundary

This review belongs to the UI/UX design lane. It should be grouped separately
from the product-documentation review:

- Product authority, PRD, short-term scope, boundary, and UI brief:
  `docs/reviews/2026-07-01-codex-product-documentation-system.md`
- Design manifest, design-system discipline, IA, and prototype:
  UI/UX reviews including this file

## Changed Files

- `DESIGN.md`
- references from project docs to the refreshed design manifest where needed

## Requirement Checks

- Main PRD authority preserved: yes.
- UI brief authority preserved: yes.
- Historical Web Preview/Electron/P6 visual baseline blocked: yes.
- Token/component trace expectations documented: yes.
- Product scope redefinition avoided: yes.

## Verification

- `DESIGN.md` front matter should parse as YAML.
- Links to subordinate UI/UX documents should resolve after the UI lane files
  are restored.
- No runtime source code is changed by this review.

## Risks

- If UI lane files are removed while `DESIGN.md` still references them, the
  documentation graph becomes incomplete.
- Final token values and high-fidelity Figma work remain future design tasks.
