# R10 Atom Molecule Contract Batch - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: completed-partial

This packet supports Auto SVGA `0.1.x / SVGA Preview MVP` UI/UX
implementation. It is an implementation input, not product scope authority.
The PRD remains `docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

R6 established the Atom / Molecule / Module catalog. R7-R9 captured key module
contracts. The next high-fidelity work should not keep tuning selectors from
memory; it needs reusable component contracts for the most-used atoms and
molecules before deeper page polish.

R10 reads component internals from the component-library page, not page-state
screens.

## Budget

- Current local-day conservative usage before this batch: 13/160.
- Planned MCP reads: 1.
- Hard cap: 2.
- Standing Owner authorization applies because usage is below the daily safety
  budget.
- Optional second read is allowed only if the first call fails or returns no
  usable component payload.

## Target Components

Priority targets:

- `Atom/文字按钮`
- `Atom/图标按钮`
- `Atom/模式切换器`
- `Atom/文字输入框`
- `Atom/指标优化入口`
- `Molecule/统计信息网格`
- `Molecule/数据指标块`
- `Molecule/资源列表行`
- `Molecule/图层列表行`
- `Molecule/优化候选项行`
- `Molecule/toast`

Optional only if payload remains small:

- `Atom/筛选标签栏`
- `Atom/Tab Item`
- `Module/设置面板`

## Read Plan

Use one read-only `_use_figma` script on page `🧱 组件库`.

Return compact JSON only:

- component or component-set name, type, size, layout mode, padding, item gap;
- direct children and at most one nested level;
- variant property names and values;
- visible text samples, capped to 4 per component;
- simplified fill role only when useful, not full color dumps.

Do not return screenshots, image bytes, vectors, full descendants, invisible
instance interiors, or all component-library nodes.

## Truncation Prevention

- Set `figma.skipInvisibleInstanceChildren = true`.
- Switch page exactly once with `await figma.setCurrentPageAsync(page)`.
- Find target components by exact or prefix names.
- Cap each component summary to 8 direct children and 12 descendant samples.
- Return `truncatedChildren` flags instead of serializing more nodes.

## Stop Condition

Stop after one successful payload that answers the priority component
contracts. If only optional components are missing, do not retry.

## Planned Implementation Use

R10 should feed the next implementation WPs:

- WP-P: shared button/icon/mode-switch/input token and component contract;
- WP-Q: metric, asset row, layer row, optimization row molecule alignment;
- WP-R: page polish that consumes the stabilized component contracts.

R10 must not be used to introduce new product copy, inactive controls, future
format UI, or visual elements not already in product/Figma scope.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `🧱 组件库` | Priority Atom/Molecule contract batch | Yes | 4.3990s | Usable early payload; truncated during `Molecule/数据指标块` |
| 2 | `_use_figma` | `🧱 组件库` | Remaining priority components only | Yes | 4.1878s | Complete usable JSON for row/toast/filter/settings targets |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 8.5868s

Current local-day conservative usage after this batch: 15/160.

Reason for the second call: the first call did not answer all priority
component contracts. It was not a broad retry; it read only the remaining
priority row/toast/filter/settings targets.

## Extracted Contract

### Core Atoms

- `Atom/文字按钮`: component set `204 x 172`, variants `类型` and `状态`.
  Primary save/overwrite-style buttons are `72 x 30`, padding `6 / 12`,
  font `12 / 18`. Replacement action is `61 x 24`, padding `4 / 8`,
  font `10 / 14`.
- `Atom/图标按钮`: primary and secondary variants are `44 x 44`; icon
  placeholder is `20 x 20`.
- `Atom/模式切换器`: component set includes `false` and `true` states.
  Each switch is `152 x 42`, padding `4`; each segment is `72 x 34`,
  padding `8 / 12`, text `12 / 18`.
- `Atom/文字输入框`: focus/default variants are `172 x 24`, padding `4 / 8`,
  text `11 / 16`.
- `Atom/指标优化入口`: variants `可优化`, `可安全优化`, `建议查看` are
  `18px` high, padding `2 / 6`, gap `2`, text `10 / 14`.

### Metric And Row Molecules

- `Molecule/统计信息网格`: component base is `280 x 204`, grid layout,
  padding `12 / 0`. Page/module instances can resize wider; R7/R9 module
  width contracts remain authoritative when a module instance is `328px`.
- `Molecule/数据指标块`: regular and optimization-result variants use vertical
  layout, gap `4`; regular sample is `49 x 64`, optimization-result sample is
  `111 x 64`.
- `Molecule/资源列表行`: component set `360 x 352`, vertical gap `8`, child
  rows are `320 x 56`, horizontal gap `12`, padding `4 / 0`.
- `Molecule/图层列表行`: component set variants `默认` and `隐藏`; rows are
  `240 x 56`, horizontal gap `10`, padding `4 / 0`. In Edit module instances,
  rows may be resized to the left-sidebar content width from R9.
- `Molecule/优化候选项行`: variants `可执行`, `需复核`, `暂不支持`; rows are
  `280 x 62`, horizontal gap `8`, padding `12`.
- `Molecule/toast`: variants include success/failure, height `44`, widths
  `280` and `320`.

### Filters And Settings

- `Atom/筛选标签栏`: `235 x 34`, horizontal gap `4`, padding `4 / 0`.
  Tab item instances are `26px` high with padding `6 / 8`.
- `Atom/Tab Item`: variants `Focused` and `Default`; sample size
  `42 x 26`, padding `6 / 8`, text `10 / 14`.
- `Module/设置面板`: `360 x 298`, vertical, gap `16`, padding top/bottom
  `24 / 0`. Children: handle row `360 x 28`, title row `358 x 22` with side
  padding `24`, divider, appearance block `358 x 116` gap `10` side padding
  `24`, divider, button area `358 x 44` side padding `24`.

## Implementation Notes

- Do not blindly use component-base widths when the same component is resized
  inside a module. For example, `Molecule/统计信息网格` base width is `280`, but
  Preview right surface uses a `328px` module content width from R7/R9.
- Edit filter tabs are a valid Figma component, but current short-term
  implementation still excludes them from Edit left sidebar because Owner
  confirmed the Edit left panel should only display layers and should not
  implement extra operations.
- R10 is now sufficient for WP-P and WP-Q component-contract implementation.
  Do not spend another component-library MCP read until a specific missing
  contract is identified.

## Retrospective

- Effective: yes. R10 filled the reusable Atom/Molecule component details that
  R6 intentionally did not include, while avoiding another page-state read.
- Cost control: acceptable. The first payload truncated, but the second call
  was scoped to the remaining priority components only and stayed within the
  predeclared hard cap.
- Design-source alignment: stronger. Future polish can now target shared
  button, icon, mode switch, input, metric, asset row, layer row, optimization
  row, toast, tab, and settings contracts before page-level tuning.
- Boundary: no Figma writes, screenshots, asset exports, or product-scope
  changes occurred.

## WP-P Implementation Retrospective

- Implemented scope: shared atom-level contracts from R10. Mode switch geometry
  now uses `152 x 42` switch and `72 x 34` segment tokens; text inputs use a
  dedicated `172 x 24` atom token instead of the global control height; metric
  optimization entries use explicit `2 / 6` padding and `2px` gap tokens; file
  header text actions use the `72 x 30` button width from the Figma contract.
- Effective: yes. This moves shared visual contracts into token and molecule
  layers before page-specific polish, which is the intended design-system-first
  order.
- Cost control: acceptable. No new Figma MCP call, package build, foreground
  screenshot, or local stable promotion was used for this atom contract WP.
- Verification: `npm run desktop:short-term:design-system-check` passed with
  `figma-r10-atom-molecule-contract-covered`; `node --test
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`.
- Boundary: no visible copy, product behavior, menu entry, save flow, or edit
  capability changed.
- Next: continue with WP-Q row molecules so AssetRow, LayerRow,
  OptimizationFindingRow, Toast, Tabs, and Settings surfaces consume the
  already-read R10 contracts before further page polish.

## WP-Q Implementation Retrospective

- Implemented scope: remaining reusable R10 molecule contracts that were not
  fully explicit in code. Asset and layer row geometry already matched the R10
  row contracts, so this WP avoided churn there. It tightened the asset filter
  to `235 x 34`, `26px` tabs, `10 / 14` tab text, and tokenized toast
  dimensions (`44px` height, `280px` default width, `320px` failure width).
- Effective: yes. The implementation now covers the shared atom and row/control
  molecule layer from the R10 component-library read before page-specific
  visual polish continues.
- Cost control: good. No new Figma MCP call, no package build, no foreground
  capture, and no product-scope change. Verification stayed bundled with the
  prior atom WP.
- Verification: `npm run desktop:short-term:design-system-check` passed with
  the expanded `figma-r10-atom-molecule-contract-covered`; `node --test
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`.
- Boundary: no visible copy or command behavior changed. Edit filter tabs remain
  excluded from the short-term Edit left sidebar even though the Figma component
  exists.
- Next: move from shared component contracts into page-level visual alignment,
  starting with the Preview canvas/right surface because it is the primary
  owner-visible working state.

## WP-Q2 Asset Section Header Retrospective

- Implemented scope: fixed the right-surface asset section header hierarchy so
  `资产列表 (n)` and `AssetFilterTabs` render as two vertical rows instead of
  competing in one flex row. The prior `.assetSectionHead` rule existed, but
  was overridden by the later generic `.sectionHead` rule because both had the
  same specificity. The implementation now uses the explicit
  `.sectionHead.assetSectionHead` component variant, tokenized by
  `--asv-component-asset-section-head-gap`.
- Effective: yes. The smoke screenshot shows the asset title no longer wraps
  and the filter tab bar sits below it, closer to the Figma/Owner right-surface
  hierarchy.
- Cost control: good. No new Figma MCP call, package build, foreground capture,
  or local stable promotion. The only heavier validation was desktop smoke,
  justified because the previous smoke run had exposed a real click-path issue
  and this WP touched the same owner-visible right surface.
- Verification: `npm run desktop:short-term:design-system-check` passed;
  `node --test
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`; `npm run desktop:smoke` passed.
- Boundary: no visible copy, product behavior, asset filtering logic, menu
  command, or save flow changed.
- Lesson: when a page element carries a generic class and a component-variant
  class, the variant selector must be more specific than the generic rule and
  guarded by design-system checks; otherwise the design-system layer exists in
  code but does not actually control the rendered UI.

## WP-X Settings Module Spacing Contract Retrospective

- Implemented scope: completed the R10 `Module/设置面板` spacing contract at
  the token/component layer. The settings dialog now exposes explicit component
  tokens for sheet gap, appearance block height, appearance block gap, and
  appearance block vertical padding, then consumes those tokens in
  `SettingsSheet` / `ThemeSegmentedControl` CSS. No setting option, command,
  theme behavior, copy, or menu entry changed.
- Effective: yes. This turns the settings sheet from a partially tokenized
  dialog into a clearer module contract, so later visual tuning can adjust the
  settings module without touching generic dialog or unrelated page CSS.
- Cost control: acceptable. No new Figma MCP call, package build, foreground
  capture, or local stable promotion was used. Desktop smoke was run because
  the WP touched visible modal spacing and a settings screenshot already exists
  in the smoke set.
- Verification: `npm run desktop:short-term:design-system-check` passed;
  `node --test
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`; `npm run desktop:smoke` passed. The smoke settings dialog
  screenshot remained visually valid after the spacing contract change.
- Boundary: no product scope, no unapproved visible text, no new controls, and
  no behavior changes.
- Lesson: module-level Figma values such as sheet gap and block height should
  become named component tokens instead of being hidden as generic `space-*`
  usage inside a dialog selector.

## WP-Y IconButton Atom Contract Retrospective

- Implemented scope: promoted the R10/R4 `Atom/图标按钮` contract into shared
  IconButton component tokens: `44px` control size, `20px` icon size, `8px`
  radius, primary action background/color, secondary transparent background,
  secondary hover, and atom shadow. Playback icon buttons now consume the
  shared IconButton aliases instead of encoding those values directly in
  playback-only selectors.
- Effective: yes. Playback controls still render the same owner-visible
  controls, but the most reused icon-button dimensions are now traceable to
  the atom layer and guarded by the design-system check.
- Cost control: acceptable. No new Figma MCP call, no package build, no
  foreground capture, and no local stable promotion. Desktop smoke was run
  because the WP touched visible playback controls.
- Verification: `npm run desktop:short-term:design-system-check` passed;
  `node --test
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`; `npm run desktop:smoke` passed. The smoke preview screenshot
  confirmed that the secondary replay button stayed low emphasis and the
  primary play/pause button stayed clear.
- Boundary: no playback logic, shortcuts, labels, product scope, or menu
  behavior changed.
- Lesson: shared atom contracts should not remain embedded in the first module
  that uses them. Promote them before adding more icon buttons to avoid
  multiple one-off control systems.
