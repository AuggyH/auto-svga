# R8 State Module Contract Batch - 2026-07-09

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: completed-partial

This packet supports Auto SVGA `0.1.x / SVGA Preview MVP` UI/UX
implementation. It is an implementation input, not product scope authority.
The PRD remains `docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

R6 established the token, Atom/Molecule/Module catalog, and page-state index.
R7 exposed the default Preview right-surface internals. The next UI/UX work
should avoid page-by-page Figma reads while still preparing for high-fidelity
landing beyond the default Preview state.

R8 therefore reads the remaining high-impact state/module contracts as one
compact batch:

- Compare surface and compare right-side information;
- Optimization result right-side information;
- Edit left/center/right shell composition;
- Launch frame/module confirmation only if it can be returned without deep
  descendants.

## Budget

- Current local-day conservative usage before this batch: 10/160.
- Planned MCP reads: 1.
- Hard cap: 2.
- Optional second read is allowed only if the first response is truncated before
  returning the target-state index, or if Figma returns only instance shells for
  all selected states.

## Read Plan

Use one read-only `use_figma` script on the `auto-svga` page. The script must:

- switch page exactly once with `await figma.setCurrentPageAsync(page)`;
- skip the `备份` page;
- inspect only page-state frames whose names match Launch, Preview, Compare,
  Optimization Result, Drag, Edit, Save, or Settings state keywords;
- return frame geometry, direct child modules, component/variant names when
  available, and visible text summaries;
- limit each state to direct children plus at most 40 visible text summaries;
- not return fills, vectors, image hashes, screenshots, full node objects, or
  invisible instance interiors.

## Truncation Prevention

- Serialize only compact POJOs.
- Cap target states to 14.
- Cap direct children to 12 per state.
- Cap text summaries to 40 per state.
- Strip x/y/width/height to rounded numbers.
- Include `truncated: true` flags per state when local caps are hit instead of
  returning more data.

## Stop Condition

Stop after one successful compact response that includes at least Compare,
Optimization Result, and Edit state/module contracts. If missing states are due
to search keywords, run one narrower retry returning only the page-state name
and ID index. If the tool errors, do not retry blindly; record the failure and
continue from existing R6/R7 packets.

## Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `auto-svga` page | Compact state index plus selected state/module summaries | Yes | 9.6103s | State index complete; selected state payload truncated in Preview states |
| 2 | `_use_figma` | `auto-svga` page | Target-state-only retry for Launch / Optimization / Save / Drag / Compare / Edit / Settings | Yes | 9.7076s | Target list complete; payload still truncated before full Compare/Edit/Settings interiors |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 19.3179s

Current local-day conservative usage after this batch: 12/160.

The hard cap was reached. No further Figma MCP call should be made for R8.

## Extracted Contract

### Reliable Output

- The `auto-svga` page contains 34 direct children and 25 visible page-state
  frames in the implementation region.
- The first call returned a complete page-state index, including:
  - `启动 / 默认`;
  - Loading states;
  - Preview default, replaceable, dirty, empty-replaceable, asset-empty, and
    optimization states;
  - Save states;
  - Drag states;
  - Compare empty/drag/waiting/loaded states;
  - `编辑 / 默认`;
  - `参考 / 设置面板`.
- The second call found all 14 requested target states, so the state names and
  node IDs are valid.

### Launch

- `启动 / 默认`: `640 x 640`.
- Direct children:
  - `Module/窗口标题栏`: `640 x 48`, positioned at top titlebar offset;
  - `Module/启动页模块/默认`: `640 x 592`.
- Visible copy confirms the existing launch surface: `拖拽文件到此处`,
  `打开文件`, `最近打开`, recent file rows, and inaccessible-file row text.

### Optimization

- `预览 / 优化详情`: `1280 x 800`.
- Direct children:
  - titlebar `920 x 48`;
  - `Module/中间面板`, `模式=预览`, `920 x 800`;
  - `Module/右侧栏`, `模式=优化, 状态=优化详情`, `360 x 800`,
    vertical, padding `16`, gap `4`.
- Visible text includes:
  - title `优化`;
  - optimization candidates such as `移除未引用图片资源`,
    `图片压缩（有损）`, `透明边界裁剪`;
  - candidate status labels `可安全执行`, `需复核`, `暂不支持`;
  - actions `一键优化` and `放弃优化`.

- `预览 / 优化结果对比`: `1280 x 800`.
- Direct children:
  - titlebar `920 x 48`;
  - `Module/中间面板`, `模式=对比`, `920 x 800`;
  - `Module/右侧栏`, `模式=优化, 状态=优化结果对比`, `360 x 800`,
    vertical, padding `16`, gap `4`.
- Visible text confirms result comparison title `优化结果` and metric
  before/after rows such as `2.4 MiB → 1.8 MiB`.

### Save States

- `保存 / 保存中`, `保存 / 保存成功`, and `保存 / 保存失败` are all
  `1280 x 800`.
- Each composes:
  - titlebar `920 x 48`;
  - `Module/中间面板`, `模式=预览`, `920 x 800`;
  - `Module/右侧栏`, `模式=预览`, status-specific variants
    `保存中`, `保存成功`, or `保存失败`, `360 x 800`, padding `16`, gap `4`.

### Drag States

- Drag states remain `1280 x 800`.
- `拖拽 / 已有文件_拖入对比` uses center `Module/中间面板`, `模式=对比`,
  plus the default Preview right surface.
- Visible text includes the current Figma labels `打开文件` and
  `添加对比文件`. Product authority still overrides any stale left/right Figma
  geometry: implementation must follow the PRD top/bottom split.
- `拖拽 / 格式不支持_拖拽中` confirms `不支持的文件格式`.

### Compare / Edit / Settings Limitation

- The second call confirmed these requested frames exist and named them:
  `对比 / 空态`, `对比 / 拖拽中`, `对比 / 已有文件A_等待文件B`,
  `对比 / 双文件已加载`, `编辑 / 默认`, and `参考 / 设置面板`.
- The response was truncated before full Compare loaded, Edit, and Settings
  interiors were returned. R8 must not be used as pixel-level implementation
  authority for those interiors.
- If those interiors become the next blocker, use a future R9 ultra-narrow
  read with one call that returns only `编辑 / 默认` and Compare loaded direct
  modules, with text cap below 8 per frame.

## Implementation Use

R8 will feed the next module-level WPs:

- Compare page-state and right-surface alignment;
- Optimization result page-state alignment;
- Edit shell alignment without expanding short-term editing scope;
- Launch confirmation against the 640 square window and central canvas
  direction.

Because R8 is partial, it should feed Optimization/Save/Drag work directly,
but Compare/Edit/Settings should still rely on R6 top-level composition until a
narrower R9 read is performed.

## WP-M Right Information Surface Alignment Retrospective

- Scope: implementation pass using the reliable part of R8. The pass aligned
  `compareInfo` / optimization-result right information surfaces with the
  shared `RightInformationSurface` module contract: `360 x 800`, 16px internal
  padding, and compact section gap. The previous implementation still carried
  a toolbar-avoidance top padding from the old shell; that made optimization
  and compare right panels visually sit lower than the Figma module.
- Effectiveness: medium-high. This is an owner-visible layout improvement for
  Optimization Result and Compare right surfaces while preserving the same
  commands, labels, save eligibility, and result content.
- Design-source alignment: based on R8 Optimization Result module composition
  and R7/R8 shared right-surface padding. R8 is still not used as pixel-level
  authority for Compare loaded, Edit, or Settings interiors.
- Validation cost control: used the design-system check and `git diff --check`
  only. No Figma MCP call, package, foreground screenshot, or smoke run was
  needed for this one contract-level change.
- Boundary: no compare playback, save behavior, optimization output rules,
  drag/drop hit testing, parser, or product copy was changed.

## WP-N Right Surface Direct-Child Contract Retrospective

- Scope: follow-up implementation pass using the reliable R7/R8 right-surface
  module facts. The pass corrected the shared right-surface direct-child gap
  from `8px` to the Figma-observed `4px` contract, added a
  `right-surface-content-width` token for the `360px / 16px / 328px` skeleton,
  and routed Preview body sections plus Compare/Optimization Result right
  children through that shared width.
- Effectiveness: medium-high. This is a cross-state visual rhythm improvement:
  Preview, General Compare, and Optimization Result now share a denser,
  design-system-traceable right-surface skeleton instead of drifting by page
  state.
- Design-source alignment: based on R7 default Preview right surface
  (`360 x 800`, padding `16`, direct child width `328`) and R8 Optimization
  right surfaces (`360 x 800`, padding `16`, gap `4`). R8 remains partial for
  Compare/Edit/Settings interiors and is not treated as pixel authority there.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `git diff --check` passed.
- Boundary: no visible product copy, command behavior, save eligibility,
  compare playback, drag/drop hit testing, or optimization result logic was
  changed.

## WP-S Scrollable Surface Quiet Chrome Retrospective

- Scope: shared surface pass for Preview, Compare, Edit, and Settings-backed
  right/side panels. The pass removed forced scrollbar gutter behavior and
  added a tokenized hidden-scrollbar contract for scrollable information
  surfaces so the default state reads as a low-boundary macOS canvas surface
  rather than a web side panel.
- Effectiveness: high for the targeted chrome issue. Smoke screenshots before
  the follow-up still showed a persistent right-side scrollbar thumb; after the
  tokenized `ScrollableSurface` contract, Preview and Settings evidence no
  longer show a default visible scroll gutter while scrollable content remains
  in the same DOM flow.
- Design-source alignment: based on the Owner-confirmed low-boundary direction
  and R7/R8 right-surface module rhythm. No new Figma MCP call was needed
  because this was a shared surface behavior gap, not a missing component
  geometry question.
- Validation: `npm run desktop:short-term:design-system-check` passed,
  `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  passed `36/36`, and `npm run desktop:smoke` passed. Smoke screenshots were
  used as regression evidence only; final owner acceptance still needs real
  foreground packaged-app review.
- Boundary: no visible product copy, save/compare/optimization behavior,
  parsing, drag/drop hit testing, or app packaging was changed.
