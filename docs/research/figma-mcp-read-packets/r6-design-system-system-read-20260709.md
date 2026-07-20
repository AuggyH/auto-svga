# R6 Design System System Read - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: completed

This packet governs the next Figma MCP read for Auto SVGA `0.1.x` / SVGA
Preview MVP UI/UX implementation. It is an implementation input, not product
scope authority. Product authority remains
`docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

The previous R1-R5 reads were useful but WP-shaped: screenshots, token map,
component hierarchy, and selected module/component contracts. The Owner has
clarified that UI/UX implementation must stop page-by-page patching and first
land the Figma-defined design system and component system.

R6 therefore reads the design system in system layers:

1. current variable/token collections;
2. current `Atom` / `Molecule` / `Module` component catalog;
3. current implementation page-state frame index and root module usage.

R6 must not read one screen just because it is being polished. It must produce
a reusable implementation map for WP-A and WP-B.

## Pre-Read Rules

- Do not read the `备份` page.
- Do not use Figma write operations.
- Do not request base64 screenshots or export design assets.
- Do not scan full descendant trees.
- Do not use MCP to justify creating new components outside the Figma system.
- Stop if output is truncated before required facts are returned; retry only
  with a narrower payload.
- Keep PRD product behavior above Figma when they conflict.

## Planned Calls

| Call | Tool | Target | Purpose | Expected quota |
| ---: | --- | --- | --- | ---: |
| 1 | `_use_figma` | Figma file variables | Compact current token/variable map by collection and mode | 1 |
| 2 | `_use_figma` | `🧱 组件库` | Compact direct child catalog for `Atom`, `Molecule`, and `Module` sections | 1 |
| 3 | `_use_figma` | `auto-svga` page | Compact page-state frame index and root module instances | 1 |

Planned quota-counted reads: 3

Hard cap: 5

Optional calls may be used only if one of the three planned calls is truncated
or if a returned system-level node requires a single narrower retry. Optional
calls may not be used for page-level visual polish.

## Expected Output

R6 should produce:

- current Figma token collection snapshot;
- current component catalog grouped by atom, molecule, module;
- page-state to module/component usage map;
- Figma-to-code gap list for WP-A token/theme and WP-B component-system
  implementation;
- actual MCP usage and wall-time record.

## Implementation Use

R6 feeds:

- WP-A: token and theme alignment;
- WP-B: atom/molecule/module component contract alignment;
- WP-C: page-state composition after WP-A/WP-B are stable.

R6 does not authorize page-level micro-polish by itself.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | Figma variables | Compact current variable collections and mode values | Yes | 10.3451s | Complete usable JSON |
| 2 | `_use_figma` | `🧱 组件库` | Compact `Atom` / `Molecule` / `Module` direct-child catalog | Yes | 4.5688s | Complete usable JSON |
| 3 | `_use_figma` | `auto-svga` page | Page-state index plus deep system instances | Yes | 13.5602s | Truncated around 20 KB |
| 4 | `_use_figma` | `auto-svga` page | Ultra-compact page-state retry with top-level modules only | Yes | 6.8827s | Complete usable JSON |

Actual total MCP attempts: 4

Actual quota-counted reads, conservative: 4

Measured MCP tool wall time total: 35.3568s

Reason for the fourth call: the planned page-state read returned useful early
facts but was truncated. The retry narrowed the payload to frame names,
dimensions, and top-level module instances only.

## R6 Findings

### Variable Snapshot

R6 confirms the current Figma token system still has 5 variable collections and
95 variables:

| Collection | Variables | Modes |
| --- | ---: | --- |
| `基础/色彩` | 32 | `默认` |
| `语义/色彩` | 28 | `浅色`, `深色` |
| `基础/间距` | 13 | `默认` |
| `基础/圆角` | 8 | `中等圆角`, `大圆角` |
| `语义/间距` | 14 | `中等圆角`, `大圆角` |

Implementation implication:

- WP-A does not need another token read before starting.
- The current code already contains the R2 base palette and many semantic
  aliases.
- WP-A should audit alias consistency, dark-mode aliases, radius-mode support,
  raw-value containment, and naming drift instead of replacing the whole token
  file.

### Component Catalog Snapshot

R6 confirms the component-library page is now cleanly divided into three
top-level sections:

| Section | Direct implementation entries | Notes |
| --- | ---: | --- |
| `Atom` | 14 | text section labels removed from the count |
| `Molecule` | 15 | direct component and component-set entries only |
| `Module` | 7 | root modules for launch, middle, right, left, settings, playback, titlebar |

Canonical implementation roots:

- `Module/启动页模块/默认`
- `Module/中间面板`
- `Module/右侧栏`
- `Module/左侧栏`
- `Module/设置面板`
- `Module/播放控制栏/播放中`
- `Module/窗口标题栏`

Implementation implication:

- WP-B should map implementation classes/functions to these component names.
- Existing page-specific renderers should be treated as surfaces using these
  modules, not as separate design systems.
- Do not create a new component unless it maps to one of the R6 catalog entries
  or is explicitly required by PRD behavior and recorded as a design gap.

### Page-State Snapshot

R6 confirms 25 implementation page-state frames on the `auto-svga` page.

Key composition rules:

- `启动 / 默认` is `640 x 640`: titlebar `640 x 48` plus
  `Module/启动页模块/默认` `640 x 592`.
- Most Preview/Loading/Save/Compare/Drag frames are `1280 x 800`: center
  module `920 x 800` plus right module `360 x 800`.
- Edit uses left `360`, center `560`, and right `360`.
- Compare states use `Module/中间面板` with `模式=对比` and `Module/右侧栏`
  with `模式=对比`.
- Optimization result uses center `模式=对比` and right
  `模式=优化, 状态=优化结果对比`.

PRD override:

- Any Figma drag decision shape that still implies left/right decision zones is
  stale. Implementation must follow the PRD top/bottom split: top secondary
  `Add As Compare File`, lower primary `Open File`.

## Figma-To-Code Gap Audit

### WP-A Token / Theme Gaps

- Token foundation is partially landed: base color, base spacing, base radius,
  semantic colors, semantic spacing, and many component tokens already exist in
  `short-term-macos.tokens.css`.
- Remaining WP-A work should be an audit and normalization pass:
  - confirm every R6 variable has a stable CSS counterpart or documented
    compatibility alias;
  - keep direct raw values inside token definitions, reset rules, or intentional
    layout constants only;
  - check dark mode aliases against `语义/色彩`;
  - check large-radius mode handling against `基础/圆角` and `语义/间距`;
  - remove stale pre-Figma token names only when they have safe compatibility
    aliases.

### WP-B Component-System Gaps

- Implementation already has split CSS layers and surface renderers, but the
  mapping is not yet explicit enough:
  - Figma `Atom/文字按钮` and `Atom/图标按钮` need clear shared code contracts.
  - Figma `Molecule/资源列表行`, `Molecule/数据指标块`,
    `Molecule/优化候选项行`, `Molecule/图层列表行`, and `Molecule/toast`
    need code trace rows.
  - Figma modules should map to one code surface/module each, with page states
    composing them instead of adding one-off page styles.

### WP-C Page-State Gaps

- R6 provides the page-state composition index needed to avoid page-by-page
  MCP reads.
- Page-state implementation should be grouped by module composition:
  - Launch;
  - Preview/Replaceable/Dirty/Save;
  - Optimization;
  - Compare/Drag;
  - Edit/Settings.
- Do not start page visual polish until WP-A and WP-B produce a traceable
  token/component map.

## R6 Retrospective

- Effective: yes. R6 converted scattered R1-R5 packets into a system-level
  implementation route and confirmed that the next work should be component
  mapping, not more page micro-polish.
- MCP cost: acceptable. Four conservative reads stayed well below the safe
  daily budget and avoided page-by-page fragmentation.
- Waste observed: one planned page-state read was too deep and truncated.
  The compact retry solved it; future page-state reads should default to the
  ultra-compact format first.
- Boundary: no Figma writes, no screenshots, no assets, no product scope
  change.

## WP-A Token Pass Retrospective

- Scope: token/theme system landing only. The pass added missing component and
  layout aliases for spinner, thumbnail sequence gap, status badge borders,
  message-row status colors, context menu geometry, preview canvas minimums,
  compact left-panel width, and reduced-motion duration.
- Effectiveness: useful foundation work, not final visual polish. It reduces
  future page-level tuning cost by moving repeated implementation constants back
  behind token aliases while preserving the current visible layout.
- Design-source alignment: based on R6 token/component audit; no new product
  copy, new visible state, or one-off page element was introduced.
- Validation cost control: used the design-system check and `git diff --check`
  only. No packaged app or foreground screenshot was produced because this WP
  changed design-system plumbing rather than owner-visible page composition.
- Issue found and fixed: the design-system check initially expected a raw
  `1ms` reduced-motion value. The guardrail was updated to require
  `--asv-reduced-motion-duration`, so the check now enforces the tokenized
  version of the same requirement.

## WP-B Component Map Retrospective

- Scope: Figma component-system traceability. The pass added a machine-readable
  implementation map for the current R6 catalog: 14 atoms, 15 molecules, and
  7 modules.
- Effectiveness: high for downstream precision. Future page polishing can now
  target a Figma component or module and trace it to canonical `data-component`,
  `data-module`, CSS layer, and renderer/surface file instead of searching the
  app ad hoc.
- Guardrail added: the design-system check now verifies catalog completeness,
  canonical code component/module references, and existence of mapped
  implementation files.
- Validation cost control: only the design-system check and `git diff --check`
  were needed. No Figma read, app packaging, or foreground screenshot was used
  because this WP changed traceability and guardrails rather than visible page
  pixels.
- Boundary: no new visible UI, no product behavior change, and no new component
  invented outside the Figma Atom/Molecule/Module catalog.

## WP-C Page-State Skeleton Retrospective

- Scope: page-state skeleton alignment from the R6 page-state inventory. The
  pass corrected the Launch window default from the older 720 x 720 shell to
  the Figma `启动 / 默认` 640 x 640 frame and updated the compact window
  bounds policy/test contract to match.
- Effectiveness: useful and owner-visible in the next packaged build. This
  closes a page-level mismatch before deeper visual polish, so later Launch
  spacing, recent-list rhythm, and checkerboard motion checks start from the
  correct canvas size instead of compensating for the wrong window.
- Design-source alignment: based on R6 page-state metadata. No new visible
  copy, command, product state, or component was introduced.
- Validation cost control: used design-system check, whitespace check, and a
  narrow launch-window contract assertion. No package, smoke run, Figma read,
  or foreground screenshot was used in this slice.
- Issue observed: the broad Node test file still has an unrelated
  `shortTermHtml is not defined` failure when run with the current test-name
  filter. It is recorded as unrelated validation debt and was not repaired in
  this UI/UX skeleton slice.

## WP-D Launch Module State Retrospective

- Scope: module/component contract landing for `Module/启动页模块/默认`. The
  pass added the Figma-defined invalid recent-file row state to the Launch
  renderer/CSS/token contract, added missing module trace points for
  `Module/设置面板` and `Module/窗口标题栏`, added the right-surface asset
  heading as dynamic `资产列表 (n)`, and added a right-surface contract
  guardrail after the targeted R7 read.
- Effectiveness: medium-high. This does not complete visual polish, but it
  turns Figma module facts into code-level contracts: invalid recent rows are
  representable, all visible high-level modules have traceable code module
  names, the asset section follows the Figma heading/count pattern, and the
  right surface cannot drift away from the Figma 360/16/328 skeleton without
  failing the design-system check.
- Design-source alignment: based on the existing R4 Launch module packet, so no
  new Figma MCP call was needed for the Launch state. The visible fallback copy
  `文件不可访问` comes from the Figma Launch module and the current PRD
  missing-file recovery scope. The right-surface guardrail is based on the R7
  `模式=预览, 状态=默认` compact read.
- Validation cost control: used design-system check, whitespace check, and a
  narrow renderer contract assertion. No package, smoke run, or foreground
  screenshot was used. Figma MCP reads were limited to the R7 targeted
  right-surface contract and stayed within the declared two-call cap.
- Boundary: no host recent-file persistence, missing-file detection, menu
  behavior, file-open logic, or new owner-visible product surface was changed.

## WP-E Right Surface Asset Filter Retrospective

- Scope: component-system landing for the Preview right-surface asset list. The
  pass implemented the Figma `Atom/筛选标签栏` and `Atom/Tab Item` contract as a
  tokenized, data-driven `AssetFilterTabs` surface above the asset rows.
- Effectiveness: high for design-system alignment. The right surface now uses
  the same atom/molecule hierarchy as the Figma default state: asset heading,
  category tabs, and filtered resource rows. This is a visible improvement and
  also reduces later page-polish cost because asset filtering is no longer a
  missing one-off behavior.
- Design-source alignment: based on already-read R4/R7 contracts. No new Figma
  MCP read was used, because the relevant component details were already in the
  local packets. Labels remain the product/design labels `全部`, `图片`,
  `序列帧`, and `音频`; counts come from the loaded SVGA model.
- Validation cost control: used design-system check, whitespace check, and one
  focused renderer contract assertion for tab counts/selection/filtering. No
  package, smoke run, foreground screenshot, or Figma read was used in this
  WP.
- Boundary: no parser, optimizer, save, replace, recent-file, or host menu
  logic was changed. The asset filter resets to `全部` when a file is opened or
  closed so state from one file cannot leak into another.

## WP-F Right Surface Row And Metric Retrospective

- Scope: molecule/atom contract cleanup for `Molecule/资源列表行` and
  `Molecule/数据指标块`. The pass removed the extra asset-row `次引用` copy,
  kept rows to the Figma-scoped name plus dimensions/file-size hierarchy, and
  changed dynamic fact cells to trace as `FactCell`.
- Effectiveness: medium-high. The visible asset rows now look less like an
  engineering report and closer to the Owner/Figma reference, while the metric
  cells are easier to map back to the component library for later pixel tuning.
- Design-source alignment: based on R4 right-surface dependency contracts and
  R7 default right-surface composition. No new labels, badges, or helper copy
  were introduced; the existing risk-only `需关注` badge remains because it is
  tied to actual finding data.
- Validation cost control: used design-system check, whitespace check, and one
  focused renderer assertion covering tab counts/filtering, asset-row copy, and
  `FactCell` traceability. No package, smoke run, foreground screenshot, or
  Figma read was used.
- Boundary: no asset model, parser, risk detection, optimization, save, or
  replacement logic was changed.

## WP-G Optimization Right Surface Contract Retrospective

- Scope: Figma R5/R6 component-contract landing for the optimization right
  surface. The pass added explicit trace from `Molecule/优化候选项行` to
  `OptimizationFindingRow`, kept optimization result metrics under
  `OptimizationResultCard`, and added design-system checks for candidate-row
  rhythm, result-card traceability, and action-button rhythm.
- Effectiveness: medium. This is not the final visual polish of the
  optimization flow, but it prevents the optimization surface from drifting
  back into one-off engineering rows while later page tuning proceeds. It also
  keeps the PRD-required result actions while reducing the implementation to
  the Figma component contracts already read.
- Design-source alignment: based on existing R5 optimization packets and the
  R6 component catalog. No new visible copy, product state, action, or
  optimization behavior was introduced.
- Validation cost control: used the design-system check and `git diff --check`
  only. No Figma MCP call, package, smoke run, or foreground screenshot was
  used because this WP changed component traceability and static guardrails
  rather than final owner-visible page evidence.
- Boundary: no optimizer algorithm, net-effect decision, save eligibility,
  compare playback, parser, or output-writing logic was changed.

## WP-H Launch And Canvas Base Contract Retrospective

- Scope: Figma R4/R6 contract landing for the Launch module and central empty
  canvas molecule. The pass added explicit implementation trace from the
  central launch prompt to `FileDropTarget` / `LaunchEmptyCanvas` and added a
  design-system check for the R4 launch module skeleton: 640 launch page state,
  300px empty-canvas molecule, 72 x 30 open action, 360 x 200 recent area,
  five-row recent limit, invalid recent row, clear-all control, and checker
  background tokenization.
- Effectiveness: medium-high for system landing. This does not make the launch
  page visually final by itself, but it closes a missing component boundary:
  the central prompt is now a traceable molecule instead of an anonymous div,
  and the design-system check can catch regressions against the Owner/Figma
  launch contract.
- Design-source alignment: based on the existing R4 Launch module packet and
  R6 component catalog. No new visible copy, command, product state, or recent
  behavior was added.
- Validation cost control: used the design-system check and `git diff --check`
  only. No Figma MCP call, package, smoke run, or foreground screenshot was
  used because this WP was structural traceability and guardrail work.
- Boundary: no file-open behavior, recent persistence, clear-history host
  command, missing-file recovery, drag/drop handling, or window promotion logic
  was changed.

## WP-I Canvas Playback Contract Retrospective

- Scope: Figma R4/R6 component-contract landing for `Module/中间面板`,
  `Module/播放控制栏/播放中`, `Atom/模式切换器`, and `Atom/图标按钮`.
  The pass added explicit `IconButton` trace to playback controls and added a
  design-system check for the center-canvas/playback contract: top-centered
  mode switch, 44px icon controls, 20px icon slots, 24px/12px playback padding,
  16px playback rhythm, 3px progress track, and 12px/18px time text.
- Effectiveness: medium-high. This does not replace foreground visual review,
  but it closes the component-system layer for the most repeated canvas
  controls before deeper page-level visual polishing. Future changes to
  playback spacing or mode-switch placement now have an explicit Figma-backed
  guardrail.
- Design-source alignment: based on the existing R4 canvas/playback packet and
  R6 component catalog. The stale Figma left/right drag-decision detail remains
  ignored in favor of the PRD top/bottom drag contract.
- Validation cost control: used the design-system check and `git diff --check`
  only. No Figma MCP call, package, smoke run, or foreground screenshot was
  used because this WP changed traceability and static guardrails rather than
  final owner-visible evidence.
- Boundary: no playback engine behavior, progress calculation, keyboard
  commands, drag/drop hit testing, compare behavior, or canvas drawing logic
  was changed.

## WP-J Preview Right Surface Page Rhythm Retrospective

- Scope: first page-level rhythm pass after the component-system contract
  landing. The pass aligned secondary right-surface section titles with the
  Figma R7 default right-surface contract by adding component and semantic
  tokens for section-title size, line-height, weight, and color, then routing
  the repeated right-surface headings through those tokens.
- Effectiveness: medium. This is still not the final pixel polish of the
  Preview page, but it moves the work from ad hoc local CSS tuning into the
  page-state contract layer. Later typography, spacing, and dark-mode tuning
  can now adjust a single right-section title contract instead of touching
  every section heading separately.
- Design-source alignment: based on the existing R7 right-surface default
  packet and R6 design-system catalog. No new visible copy, field, state,
  badge, action, or product behavior was introduced.
- Validation cost control: used the design-system check, whitespace check, and
  JSONL parse only. No Figma MCP call, package, smoke run, or foreground
  screenshot was used because existing packets already contained the needed
  right-surface contract and this WP does not yet justify an owner-visible
  package refresh.
- Boundary: no parser, metadata model, replacement, asset filtering,
  optimization, save, compare, playback, or file-open behavior was changed.

## WP-K Preview Right Surface Section Boundary Retrospective

- Scope: continued Preview default page-rhythm landing for the right surface.
  The pass split section spacing into dedicated tokens for section start
  margin and section top padding, then routed the repeated replaceable,
  text-preview, and asset sections through those tokens. This lowers the
  visible block-boundary weight without adding cards, explanatory copy, or new
  product states.
- Effectiveness: medium. The visible change is intentionally restrained, but
  the implementation value is high for future polish: section boundaries can
  now be tuned from the design-system layer instead of relying on repeated
  module selectors that encourage one-off spacing fixes.
- Design-source alignment: based on R7 direct-child right-surface rhythm and
  the Owner-confirmed low-boundary canvas direction. No Figma MCP call was
  needed because the existing R7 packet already records the right-surface
  360px frame, 16px padding, 328px child width, and compact 4px direct-child
  rhythm.
- Validation cost control: used the design-system check and `git diff --check`
  only. No package, smoke run, foreground screenshot, or Figma read was used
  because this is a tokenized page-rhythm adjustment within an already-read
  contract.
- Boundary: no section content, label, count, filter behavior, replaceable
  interaction, asset rendering, parser, save, optimization, compare, or
  playback behavior was changed.

## WP-L Low-Boundary Shell And Color Traceability Retrospective

- Scope: low-boundary shell cleanup and atom color traceability. The pass
  reduced the right-panel shell separator to a tokenized zero-width boundary,
  kept the structure in place for future tuning, and replaced hardcoded
  `white` button text with the existing `--asv-on-action` token at both atom
  and right-header levels. A design-system check now rejects `white` / `black`
  visual color names outside the token layer.
- Effectiveness: medium-high. The right surface now relies more on background
  and rhythm than an explicit vertical line, matching the Owner-confirmed
  immersive low-boundary direction. The button color cleanup is small visually
  but important structurally: action text can now follow theme/token changes
  without selector-level overrides.
- Design-source alignment: based on Owner-confirmed canvas direction and the
  existing Figma token/component landing. This did not add, remove, or rename
  any visible control.
- Validation cost control: used the design-system check and `git diff --check`
  only. No Figma MCP call, package, smoke run, or foreground screenshot was
  used because the change is token/guardrail-level and does not need a new
  design read.
- Boundary: no toolbar command, save behavior, button state machine,
  right-panel layout, theme setting behavior, parser, or file workflow was
  changed.
