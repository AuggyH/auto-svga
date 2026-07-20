# R11 Current-Head Fidelity Audit - 2026-07-10

Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Implementation page: `auto-svga`
Excluded page: `备份`
Status: Phase A completed, evidence-only

This packet supports Auto SVGA `0.1.x / SVGA Preview MVP` UI/UX fidelity
review for exact source and installed build
`552bf77991bcf3a85d1e438454b888a734984ec8`.

It is not product scope authority. The PRD remains
`docs/product/PRODUCT_ROADMAP.md`.

## Why This Read Exists

The page-state convergence milestone reached source-side QA acceptance, but
the final fidelity gate requires fresh Figma MCP evidence against the current
head. R1-R10 remain useful historical implementation inputs, but they are not
freshness evidence for the current installed build.

R11 therefore re-reads only the required owner-facing page states and compares
the fresh Figma facts to the current implementation map, tokens, components,
modules, and page-state source.

Phase A is read-only and intentionally does not modify UI source while QA is
running the installed package.

## Budget

- Current local-day conservative usage before R11: `0/160`.
- Practical daily cap: `160` read calls.
- Planned quota-counted reads: `11`.
- Hard cap: `12`.
- Optional retry: one compact metadata retry only if the first metadata read
  truncated required target facts.
- Rate-limit mitigation: pause after the first 10 reads to avoid the
  `10/minute` read boundary.

## Target Nodes

| State | Figma node | Expected evidence |
| --- | --- | --- |
| Launch | `37:154` | screenshot, frame bounds, major regions, visible copy |
| Loading | `80:16365` | screenshot, frame bounds, major regions, visible copy |
| Load failed | `80:16612` | screenshot, frame bounds, major regions, visible copy |
| Preview default | `27:2` | screenshot, frame bounds, right-surface facts |
| Preview replaceable | `82:616` | screenshot, dirty/replaceable right-surface facts |
| Preview optimization | `82:2669` | screenshot, optimization right-surface facts |
| Compare empty | `66:522` | screenshot, empty compare facts |
| Compare loaded | `64:1320` | screenshot, loaded compare facts |
| Edit reserved | `55:535` | screenshot, edit layout facts |
| Settings | `83:2069` | screenshot, settings module facts |

## Actual MCP Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `auto-svga` page | Initial target metadata and page summary | Yes | 10.0049s | Usable, but truncated during Preview default visible text |
| 2 | `_use_figma` | `auto-svga` page | Compact metadata retry for the same target list | Yes | 6.8444s | Complete usable target JSON |
| 3 | `_get_screenshot` | Launch `37:154` | Current target screenshot | Yes | 4.0271s | Complete, `720 x 720` |
| 4 | `_get_screenshot` | Loading `80:16365` | Current target screenshot | Yes | 4.5925s | Complete, `1360 x 880` |
| 5 | `_get_screenshot` | Load failed `80:16612` | Current target screenshot | Yes | 4.3587s | Complete, `1360 x 880` |
| 6 | `_get_screenshot` | Preview default `27:2` | Current target screenshot | Yes | 4.7091s | Complete, `1360 x 880` |
| 7 | `_get_screenshot` | Preview replaceable `82:616` | Current target screenshot | Yes | 3.8256s | Complete, `1360 x 880` |
| 8 | `_get_screenshot` | Preview optimization `82:2669` | Current target screenshot | Yes | 4.3539s | Complete, `1360 x 880` |
| 9 | `_get_screenshot` | Compare empty `66:522` | Current target screenshot | Yes | 4.2906s | Complete, `1360 x 880` |
| 10 | `_get_screenshot` | Compare loaded `64:1320` | Current target screenshot | Yes | 4.3320s | Complete, `1360 x 880` |
| 11 | `_get_screenshot` | Edit reserved `55:535` | Current target screenshot | Yes | 4.6630s | Complete, `1360 x 880` |
| 12 | `_get_screenshot` | Settings `83:2069` | Current target screenshot | Yes | 3.2401s | Complete, `1280 x 800` |

Actual total MCP attempts: `12`

Actual quota-counted reads, conservative: `12`

Measured MCP tool wall time total: `59.2419s`

Operational wait time: one `65s` pause after the tenth read to avoid the
per-minute rate boundary.

Current local-day conservative usage after R11: `12/160`.

## Screenshot Archive

Screenshots were downloaded immediately from short-lived Figma URLs into a
non-Git task archive:

`/Users/huangtengxin/.codex/visualizations/2026/07/10/019f4aaa-c716-7e23-99a0-27823726a5be/r11-figma-fidelity/`

Do not commit these PNG files.

| State | File | Size | SHA-256 |
| --- | --- | --- | --- |
| Launch | `launch-37-154.png` | `720 x 720` | `cd14ab0a2e97f15cae79fbe9054c6e9fd34928fa3f1ca6efe2246cc5418af53e` |
| Loading | `loading-80-16365.png` | `1360 x 880` | `8296da7bd180e0ba4d0150580412dc8489e9177566e6112fa1f5bd2b268b977e` |
| Load failed | `load-failed-80-16612.png` | `1360 x 880` | `69f2c8c00190d263e29c5a6f255a22802056a2d31005cd840b16362cdd75ee02` |
| Preview default | `preview-default-27-2.png` | `1360 x 880` | `847c9e83d500b056d30cac270c3d6ac2e1358835dda2fe0a422a18f46e0223f3` |
| Preview replaceable | `preview-replaceable-82-616.png` | `1360 x 880` | `4d814f58769ac4f5b08917d54a8c81d8964db9dd5f205e3f7e33eb848887110e` |
| Preview optimization | `preview-optimization-82-2669.png` | `1360 x 880` | `a2cc655a9f4ca64694ced23ce8171d7d164c2c270121d6b4b31758c4d92e4dfa` |
| Compare empty | `compare-empty-66-522.png` | `1360 x 880` | `fdaa7d670c4f26f79fb2297b1505f78a2cb98af58418586dffe3e24490d0a455` |
| Compare loaded | `compare-loaded-64-1320.png` | `1360 x 880` | `604294040f134dd6137bba47510f845227ab68141b4093232edee1a1f8b09a0e` |
| Edit reserved | `edit-reserved-55-535.png` | `1360 x 880` | `a3e2be7bf3834ceb0c67e3aec8eb20b46c50334ec36827f39fa936f3e4b46953` |
| Settings | `settings-83-2069.png` | `1280 x 800` | `02b021135d8ed5ce59633f17f052831d64ed1cbdf9a0610295834d240d1ab1d8` |

## Fresh Frame Facts

### File Structure

- `auto-svga`: Figma page id `0:1`.
- `备份`: Figma page id `70:1538`, excluded.
- `🎨 设计令牌`: Figma page id `88:4020`.
- `🧱 组件库`: Figma page id `88:4275`.

### Launch

- Frame: `启动 / 默认`, node `37:154`, `640 x 640`.
- Major regions: titlebar `640 x 48`; launch module `640 x 592`.
- Visible copy: `拖拽文件到此处`, `打开文件`, `最近打开`,
  `战狼头像框.svga`, `4 分钟前`, `文件不可访问`.
- Code trace: `Launch`, `LaunchModule`, `LaunchDropCanvas`,
  `LaunchRecentFilesList`.

### Loading

- Frame: `加载 / 加载中`, node `80:16365`, `1280 x 800`.
- Major regions: titlebar `920 x 48`; center panel `920 x 800`;
  right content `360 x 800`.
- Right content: vertical layout, gap `4`, padding `16`, token refs
  `间距/4`, `间距/16`, surface `表面/面板`.
- Visible copy includes `正在加载…` plus the normal Preview mode switch and
  right information surface.
- Code trace currently: `Loading` standalone `stateView`.

### Load Failed

- Frame: `加载 / 加载失败`, node `80:16612`, `1280 x 800`.
- Major regions match Loading: titlebar, center panel, right content.
- Center canvas shows failure treatment with copy `文件加载失败`,
  `文件格式不受支持或已损坏`, and `打开文件`.
- Code trace currently: `Load failed` standalone `stateView`.

### Preview Default

- Frame: `预览 / 默认`, node `27:2`, `1280 x 800`.
- Major regions: titlebar `920 x 48`; center panel `920 x 800`;
  right content `360 x 800`, padding `16`, gap `4`.
- Visible copy includes file identity, facts, imageKey, and asset list.
- Screenshot shows no default header save button.
- Code trace: `Preview ready`, `Preview overview`,
  `OverviewInformationModule`.

### Preview Replaceable

- Frame: `预览 / 可替换元素`, node `82:616`, `1280 x 800`.
- Major regions match Preview Default.
- Right content component state: `模式=预览, 状态=Dirty`.
- Code trace: replaceable rows and dirty/save command state are rendered under
  the Preview right information surface.

### Preview Optimization

- Frame: `预览 / 优化详情`, node `82:2669`, `1280 x 800`.
- Right module: `Module/右侧栏`, component state
  `模式=优化, 状态=优化详情`.
- Visible copy includes `优化`, `移除未引用图片资源`,
  `图片压缩（有损）`, `透明边界裁剪`, `一键优化`, `放弃优化`.
- Code trace: `Preview optimization`, `OptimizationDetailSurface`.

### Compare Empty

- Frame: `对比 / 空态`, node `66:522`, `1280 x 800`.
- Right content component state: `模式=对比, 状态=空态`.
- Visible copy includes `拖拽文件到此处`, `打开文件`, `对比模式`,
  `退出对比`, `文件未打开`.
- Empty canvases keep the disabled playback bar.
- Code trace: `General comparing`, `GeneralCompareModule`,
  `CompareEmptySlot`, disabled compare playback.

### Compare Loaded

- Frame: `对比 / 双文件已加载`, node `64:1320`, `1280 x 800`.
- Major regions: `920 x 800` compare center with two `460 x 800` canvas
  regions; right content `360 x 800`.
- Right surface uses a two-column comparison metric area and shared row order.
- Code trace: `General comparing`, `renderCompareMetricColumns()`.

### Edit Reserved

- Frame: `编辑 / 默认`, node `55:535`, `1280 x 800`.
- Major regions: left panel `360 x 800`; center panel `560 x 800`;
  right panel `360 x 800`.
- Left panel: padding top `48`, side/bottom `16`, gap `4`; file header,
  filters in Figma, and `Molecule/图层列表行` layer rows.
- Visible copy includes `编辑操作区`,
  `短期版本保留占位 高级功能后续规划`, `文件名.svga`,
  `全部 (57)`, `图片 (48)`, `光效 (6)`, `粒子 (3)`,
  `图层名字`, `已绑定对称图层`.
- Code trace: short-term Edit left panel displays file header and layer rows
  only; right panel remains a reserved surface.

### Settings

- Frame: `参考 / 设置面板`, node `83:2069`, `1280 x 800`.
- Settings module: `Module/设置面板`, `x=460`, `y=253`,
  `360 x 298`.
- Layout: vertical, gap `16`, padding top/bottom `24`.
- Visible copy: `设置`, `外观`, `跟随系统`, `浅色`, `深色`, `完成`.
- Code trace: `SettingsDialogModule`, `SettingsSheet`,
  `ThemeSegmentedControl`.

## Figma-To-Code Matrix

| Figma target | Current map/source status at `552bf779` | Phase A assessment |
| --- | --- | --- |
| Launch | Mapped in `design-system-map.json`; source uses `LaunchModule`, `LaunchDropCanvas`, recent list, and `640 x 640` launch tokens | Matched, pending packaged foreground binding for native chrome |
| Loading | Present in HTML/test as `Loading` standalone `stateView`; not mapped in `design-system-map.json` pageStates | Structural mismatch candidate |
| Load failed | Present in HTML/test as `Load failed` standalone `stateView`; not mapped in `design-system-map.json` pageStates | Structural and copy mismatch candidate |
| Preview default | Mapped to `Preview ready` / `Preview overview`; right panel width, padding, gap, and fact-grid token contracts match R11 | Mostly matched; default save visibility needs packaged runtime proof |
| Preview replaceable | Implemented inside Preview right surface with dirty/save command state | Mostly matched; runtime dirty state needs Phase B screenshot binding |
| Preview optimization | Mapped to `Preview optimization` and `OptimizationDetailSurface` | Mostly matched; exact row rhythm to verify in Phase B |
| Compare empty | Mapped to `General comparing`; empty slots and disabled playback present | Mostly matched; right-panel empty layout needs Phase B screenshot binding |
| Compare loaded | Mapped to `General comparing`; shared compare row order already implemented and reviewed | Mostly matched; visual metric card rhythm needs Phase B screenshot binding |
| Edit reserved | Mapped to `Edit reserved`; left layer list implemented; right reserved panel intentionally does not expose future controls | Intentional PRD divergence for inactive/future Figma text and filter operations |
| Settings | Mapped to `Settings dialog`; module width, gap, appearance choices, and action match R10/R11 | Matched, pending packaged foreground binding |

## Discrepancy Matrix

| ID | Target | Category | R11 Figma fact | Current source fact | Impact | Recommended disposition |
| --- | --- | --- | --- | --- | --- | --- |
| R11-D01 | Loading | Structural; state/content | Loading remains inside the workbench shell: titlebar, center canvas, playback/mode context, and right info surface stay visible | Loading is a standalone full-window `stateView` with centered `stateCard`, copy `正在打开 SVGA` and `读取文件并准备预览。` | High. This is the largest fresh Figma/current-source mismatch | Do not repair during Phase A. Phase B should bind installed-app screenshots. If confirmed unintended, repair Loading/Load failed together as one page-state bundle or ask PM/Owner whether the current no-stale-metadata recovery model intentionally overrides Figma |
| R11-D02 | Load failed | Structural; state/content | Failure remains inside the workbench shell and uses copy `文件加载失败`, `文件格式不受支持或已损坏`, `打开文件` | Failure is a standalone full-window `stateView` with copy `无法打开这个 SVGA`, dynamic error text, and `打开文件` | High. Same recovery-surface family as R11-D01 | Treat with R11-D01; avoid isolated copy-only repair |
| R11-D03 | Loading / Load failed | Evidence limitation; possible intentional PRD/accessibility divergence | Figma screenshots preserve right-panel demo file facts during loading/failure | Execution plan verification says `no stale metadata in loading/failure states`; current source avoids stale metadata by using dedicated state views | Medium-high. This may be a design-vs-gate conflict, not a code bug | Route to PM if Phase B confirms mismatch. Decide whether Figma should be updated or code should adopt a workbench-shell recovery state without stale facts |
| R11-D04 | Design-system map | Evidence/traceability | R11 minimum target set includes Loading and Load failed | `design-system-map.json` pageStates do not list Loading or Load failed | Medium. Traceability gap affects fidelity gate and future reads | Add Loading/Load failed map entries in a future evidence/repair bundle if PM accepts R11-D01/D02 direction |
| R11-D05 | Preview default | Evidence limitation | Screenshot has no visible header save button in default state | Static HTML contains save buttons, but runtime command state hides the save cluster unless dirty/output state is active | Low unless Phase B shows stale visible buttons | Verify in packaged app. Do not change source from static HTML alone |
| R11-D06 | Preview / Compare playback | Intentional PRD/platform divergence candidate | Figma screenshots show right-side playback icons that may read as loop/fullscreen-style controls | Current reviewed scope explicitly includes loop control and excludes fullscreen | Low-medium. Could be visual mismatch if a fullscreen glyph is expected by design but out of product scope | Do not add fullscreen. Record as PRD/platform divergence if Phase B sees a missing authorized control |
| R11-D07 | Edit reserved | Intentional PRD divergence | Figma includes Edit right placeholder copy and filter tabs | Owner/PRD boundary keeps short-term Edit left panel to layer display only; right side remains reserved without inactive future controls | Low. Current source protects scope | Keep source behavior unless PRD changes. Figma may retain a visual placeholder as design reference, but code must not expose future-function copy |
| R11-D08 | Launch | Evidence limitation | Figma frame is exactly `640 x 640` with titlebar `640 x 48` | Source tokens set Launch minimum `640 x 640`; packaged macOS window chrome can affect outer screenshot dimensions | Low | Phase B packaged screenshot should compare content bounds, not raw native outer-window dimensions only |

## Phase B Requirements

Phase B must wait for the deterministic packaged-app callback. It should bind
installed-app screenshots to this R11 packet by:

1. App path and build commit.
2. PID/process identity.
3. Display/workspace and foreground lease identity.
4. Viewport/window size, theme, and reduced-motion/transparency conditions.
5. Real owner SVGA material used for loaded states.
6. State target name and corresponding R11 Figma node.

For stable static regions, use overlay or pixel-diff evidence. For dynamic
content such as live SVGA canvas, use bounded visual review and classify
differences rather than forcing pixel equality.

If unintended high-impact differences remain, implement them as one bundled
Figma fidelity repair milestone from the accepted source. Do not open
micro-tasks per selector or per copy string.

If no repair is required, return an evidence-only fidelity report. Neither
Phase A nor Phase B can claim Product Owner acceptance.

## Phase B Composite Evidence Update

Date: 2026-07-10
Status: PM-disposition superseded; repair required

PM supplied the deterministic foreground retry fact after Phase A:

- Installed app:
  `/Users/huangtengxin/Applications/Auto SVGA.app`.
- Installed build:
  `552bf77991bcf3a85d1e438454b888a734984ec8`.
- QA commit: `7d358be8`.
- QA report:
  `/Users/huangtengxin/.codex/worktrees/ed2a/auto-svga/docs/quality/reports/UIUX-0.1-page-state-owner-visible-visual-regression.md`.
- QA proved clean Launch, reversible Recent, real-material Preview overview,
  Preview optimization, Preview replaceable, Edit reserved, and Compare empty.
- QA did not complete Compare loaded, Loading, Load failed, Settings, dark/light
  appearance switching, minimum-window, or keyboard/focus visual acceptance.
- PM will not authorize a third equivalent foreground retry.

Phase B therefore uses a composite model:

1. Exact installed-app foreground screenshots where QA already proved identity
   and state.
2. Exact-head source and source-side QA proof for difficult static states not
   covered by foreground.
3. Fresh R11 Figma facts and screenshots from this packet.

This composite evidence can classify mismatch risk, but it cannot claim final
Product Owner visual acceptance.

### Composite Target Matrix

| Target | Available evidence | Phase B classification |
| --- | --- | --- |
| Launch | R11 Figma screenshot/facts; exact installed-app foreground retry screenshot; source tokens map `640 x 640` launch | No confirmed repair. Native outer-window dimensions remain a platform comparison limitation. |
| Preview default | R11 Figma screenshot/facts; exact installed-app foreground real-material preview screenshot; source right-surface token map | No confirmed repair. Runtime header save visibility should remain verified by command state, not static HTML. |
| Preview optimization | R11 Figma screenshot/facts; exact installed-app foreground optimization tab screenshot; source `OptimizationDetailSurface` | No confirmed repair from R11. |
| Preview replaceable | R11 Figma screenshot/facts; exact installed-app foreground replaceable tab screenshot; source replaceable rows | No confirmed repair from R11. |
| Compare empty | R11 Figma screenshot/facts; exact installed-app foreground Compare empty screenshot; source disabled playback / empty slot prompts | No confirmed repair from R11. |
| Compare loaded | R11 Figma screenshot/facts; exact-head source proof for shared compare row order; no foreground loaded-compare screenshot | Evidence limitation. No confirmed visual repair without deterministic foreground or static screenshot binding. |
| Edit reserved | R11 Figma screenshot/facts; exact installed-app foreground Edit reserved screenshot; source left-layer-only boundary | Intentional PRD divergence for Figma placeholder/future copy and filter operations. No repair. |
| Settings | R11 Figma screenshot/facts; source settings module proof; no foreground settings screenshot in retry | Evidence limitation. No confirmed repair from R11. |
| Loading | R11 Figma screenshot/facts; exact source `Loading` standalone `stateView`; source-side QA traceability; no foreground loading screenshot in retry | Confirmed unintended structural fidelity gap. Repair by preserving the workbench shell and replacing stale facts with loading-specific neutral/skeleton content. |
| Load failed | R11 Figma screenshot/facts; exact source `Load failed` standalone `stateView`; source-side QA traceability; no foreground load-failed screenshot in retry | Confirmed unintended structural fidelity gap. Repair by preserving the workbench shell and replacing stale facts with failure/recovery content. |

### Resolution Of High-impact Candidate

R11-D01, R11-D02, and R11-D03 are resolved by PM as an implementable combined
contract, not as an intentional divergence.

Rationale:

- `docs/product/PRODUCT_ROADMAP.md` S2 requires invalid, parse, loading, and
  playback failures to show a visible user message and recover when a valid
  file is opened.
- The PRD state table allows `Loading` to be either a main-surface skeleton or
  loading feedback; it does not require preserving loaded-file right metadata.
- The PRD and sample validation table require invalid or non-SVGA files to
  avoid stale metadata.
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md` requires Load failed to show
  human-readable error, no stale file data, and recovery.
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md` explicitly lists
  `no stale metadata in loading/failure states` as a verification gate.
- The older UI/UX screenshot audit recorded stale file identity and stale mode
  state in Load failed as defects to avoid.

The R11 Figma Loading / Load failed frames preserve the workbench shell. PM
confirmed that shell/spatial context is required, while stale previous-source
facts remain forbidden. The repair target is therefore:

- preserve native titlebar, canvas region, mode/playback context, and the right
  information-surface footprint;
- keep primary loading/error feedback and the existing Open File recovery
  action in the canvas;
- replace previous-source facts with loading-specific neutral/skeleton content
  or failure/recovery content;
- suppress stale metadata, assets, optimization results, and actionable save
  state;
- keep unavailable controls disabled and avoid fullscreen/deferred scope.

This packet now routes R11-D01/D02/D03 into one bundled R11 Figma fidelity
repair milestone. The only intentional divergence is stale demo/source content,
not shell geometry.

### Evidence Limitations Left Open

- Compare loaded still lacks owner-visible foreground proof.
- Loading and Load failed still lack owner-visible foreground proof; source
  repair must be validated through direct state/shell tests and design-system
  checks before later owner-visible acceptance.
- Settings still lacks the retry foreground screenshot.
- Dark/light, reduced motion/transparency, minimum supported window, and
  keyboard/focus visual checks remain outside this R11 composite pass.

These limitations mean final visual acceptance remains open. They do not block
the source-side shell repair because PM has already confirmed the mismatch as a
repairable Figma fidelity gap.

## Retrospective

- Effective: yes. R11 refreshed all required fidelity targets in one bounded
  batch and found a concrete high-impact candidate mismatch instead of spending
  reads on broad inventories.
- Cost control: acceptable. The batch used exactly the predeclared hard cap
  because the first metadata read truncated and the compact retry was required.
- Design-source alignment: stronger. The audit distinguishes real Figma/source
  mismatch from stale-content divergence so the next repair preserves shell
  fidelity without leaking previous-file facts.
- Main lesson: product/design reconciliation can produce a combined contract:
  preserve Figma shell geometry, but replace stale source content with
  state-specific loading/error content.
