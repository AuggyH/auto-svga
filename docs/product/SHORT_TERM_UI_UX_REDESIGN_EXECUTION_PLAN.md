# Short-term UI/UX Redesign Execution Plan

Date: 2026-07-01
Status: active subordinate execution plan
Authority: subordinate to `docs/product/PRODUCT_ROADMAP.md`

## Purpose

This document turns the corrected short-term PRD and UI/UX design brief into a
design-system-first execution plan for the clean-slate macOS-first Auto SVGA
app.

It is not a PRD and does not define product scope. The only project-level PRD
authority remains `docs/product/PRODUCT_ROADMAP.md`. If this document conflicts
with the main PRD, the main PRD wins and this document must be corrected before
design or implementation continues.

This plan exists to prevent the common failure mode where product and design
documents are clear, but implementation reverts to one-off UI code. Every
future UI design and code slice must remain traceable from PRD requirement to
design token, component, module, page state, source file, and evidence.

## Inputs

Authoritative product scope:

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`

Subordinate UI/UX input:

- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `DESIGN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`

Historical references that must not become the visual baseline:

- old Web Preview
- Electron prototype
- P6 Workbench

## Execution Principles

1. Start from product state, not screens.
2. Build from tokens to atoms to molecules to components to modules to pages.
3. Keep Preview mode and Edit mode structurally distinct.
4. Keep short-term actions inside S1-S16.
5. Keep disabled controls honest and explain why they are unavailable.
6. Keep persisted byte-output actions separate from runtime-only previews.
7. Do not expose export acceptance, sequence repair, batch replacement, AI,
   accounts, cloud sync, telemetry, or advanced motion authoring controls.

## Design System Layers

| Layer | Purpose | Required output |
| --- | --- | --- |
| Primitive tokens | Stable raw values | color, type, space, radius, shadow, motion |
| Semantic tokens | Mode-aware intent | text, surface, border, action, status, focus |
| Component tokens | Reusable control contracts | toolbar, button, tab, row, modal, save state |
| Atoms | Smallest visible units | icon, text, badge, dot, divider, thumbnail |
| Molecules | Small controls and rows | toolbar button, tab item, fact cell, rename input |
| Components | Reusable UI objects | preview stage, right tab panel, asset row, modal |
| Modules | Feature surfaces | launch, overview, optimization, replaceable, compare |
| Page states | User-visible screens | Launch, Loading, Preview, Compare, Save states |

## Required Page States

The short-term UI must cover:

- Launch
- Loading
- Load failed
- Preview Overview
- Preview Optimization
- Preview Replaceable Elements
- No Replaceable Elements
- Rename imageKey
- Runtime image replacement
- Runtime text replacement
- General Compare
- Optimization Compare
- Save validating
- Save complete
- Save failed
- Edit reserved

## Implementation Gate

Before implementation begins, the design or code task must declare:

| Field | Required content |
| --- | --- |
| PRD IDs | S1-S16 IDs touched by the task |
| Page states | States rendered or changed |
| Modules | Modules affected |
| Components | Components created or changed |
| Tokens | Token namespaces used |
| Non-goals | Out-of-scope items protected |
| Evidence | Screenshot, interaction proof, or automated check expected |

## Design-to-code Rules

- Use design tokens or CSS variables for visual values.
- Do not hardcode one-off color, spacing, radius, or typography values in page
  components.
- Keep component names stable between design docs and implementation.
- Keep app copy Chinese-primary with English only where useful for debug
  traceability.
- Keep focus states visible.
- Keep `prefers-reduced-motion` behavior for animated elements.
- Keep dense metadata selectable where practical.
- Avoid page-local decorative effects that are not tied to product state.

## Verification Gates

Every UI implementation slice should include a proportional subset of:

- static syntax checks
- token/reference grep checks
- keyboard path checks
- narrow and normal viewport checks
- light and dark mode checks when mode support is touched
- save/dirty-state checks when persisted output UI is touched
- no stale metadata in loading/failure states
- no old out-of-scope menu or toolbar entries

## Foreground macOS Validation Gate

Automated smoke evidence is regression evidence only. It can prove that the
short-term flow still opens, renders, and exercises required states, but it must
not be used as the sole basis for saying the page layout, interaction quality,
or UI design is acceptable.

Before a UI/UX slice claims visual or interaction acceptance, collect
foreground desktop evidence from the actual macOS client:

- capture the real foreground app window, including the macOS menu bar and
  native titlebar/window chrome;
- use real production SVGA materials from
  `/Users/huangtengxin/Downloads/auto-svga测试物料` when available, not only
  synthetic fixtures or smoke inputs;
- cover more than one SVGA file when the touched surface depends on file size,
  resource count, memory estimate, replaceable elements, text elements, or
  optimization findings;
- inspect Launch, Preview Overview, Replaceable Elements, Optimization,
  General Compare, Save Failed, Loading, and Failure states when those surfaces
  are touched;
- record screenshot paths or review links in the UI/UX review file.

If foreground capture is temporarily unavailable, the review must explicitly
mark visual/interaction acceptance as not yet proven and state that smoke
evidence only covers automated regression.

## Rollback Plan

This plan is documentation-only. If it introduces confusion, revert the document
or replace the disputed section with a Product Owner decision note. Do not
change product scope here; change scope only in the main PRD.
