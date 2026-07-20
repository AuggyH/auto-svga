# Review: short-term UI/UX optimization program

## 1. Summary
This document records the UI/UX execution program for continuing the short-term
desktop client redesign after the functional prototype reached the 16/16
matrix. It is an implementation and design-quality plan only. It does not add,
remove, or redefine product scope.

Hard boundary from Owner:
- Do not add product-doc-external UI copy, labels, status text, annotations,
  components, states, or information blocks.
- New product-facing content may only appear after Owner explicitly requests it
  and the product documents are updated.
- UI/UX work may refine existing documented surfaces and may refactor internal
  structure when visible behavior remains unchanged.

## 2. Current-state diagnosis
- Design system exists in documentation, but implementation is still too
  coarse: one HTML file, one large app JS file, one large page CSS file, and one
  large component CSS file.
- Tokens are present, but the implementation layers below tokens are not yet
  physically traceable as atom -> molecule -> component -> module -> page state.
- Visual quality is still closer to a functional prototype than a polished
  designer-facing macOS workbench. Spacing, hierarchy, density, rows, panels,
  and action prominence need progressive refinement.
- Interaction verification is still function-heavy. The existing 16/16 matrix
  proves capability coverage, but does not fully prove design quality for tab
  order, focus order, scrolling, minimum window size, reduced motion, selectable
  text, or menu discoverability.

## 3. Program phases
| Phase | Goal | Allowed changes | Non-goals |
| --- | --- | --- | --- |
| WP6A | CSS design-system layer split | Move existing CSS into token/atom/molecule/component/module/page-state files; update import order and tests. | No visible copy, DOM, feature, or product behavior change. |
| WP6B | JS render boundary split | Extract existing render helpers by module, starting with low-risk rendered rows and recent list rendering. | No feature changes and no new UI states. |
| WP6C | Visual polish by existing surface | Improve documented Launch, Preview, Overview, Optimization, Replaceable, Compare, and Save surfaces using existing elements only. | No new explanatory text, status labels, or components. |
| WP6D | Design-oriented interaction evidence | Add checks for tab path, focus order, scroll containment, minimum window, reduced motion, copy/select behavior, and menu discoverability. | Do not replace existing capability evidence. |
| WP6E | Real-material visual QA loop | Capture foreground desktop evidence with real SVGA materials and native macOS chrome. | Do not claim Owner acceptance or final release readiness. |

## 4. First implementation slice
WP6A starts with CSS layer extraction because it directly addresses the
documented design-system gap while keeping product behavior stable.

Initial file target:
- `short-term-macos.tokens.css`
- `short-term-macos.atoms.css`
- `short-term-macos.molecules.css`
- `short-term-macos.components.css`
- `short-term-macos.css`

Later slices may split module and page-state CSS after the first layer split is
validated.

## 5. Verification plan
- `git diff --check`
- JS syntax checks for touched entry modules when JS changes
- CSS/HTML structure assertions in `svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
- Foreground desktop screenshots when visible layout changes are made

## 6. Risks
- Moving CSS can accidentally change cascade order. WP6A therefore preserves
  selector order through explicit stylesheet link order.
- Internal historical naming can remain in code during early WP6 slices to
  avoid broad churn. Renames should happen only when they are necessary and
  product-doc-safe.

## 7. Next step
Proceed with WP6A CSS atom/molecule extraction, then verify that the short-term
client still loads and the existing UI remains behaviorally unchanged.
