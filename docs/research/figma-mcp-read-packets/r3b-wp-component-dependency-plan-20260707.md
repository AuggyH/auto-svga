# R3b WP Component Dependency Plan

Date: 2026-07-07
Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Status: R3b complete, no Figma MCP calls used

This packet turns the R3 component hierarchy map into a work-package dependency
plan for implementation. It is an implementation routing document, not PRD
authority.

Product scope remains governed by `docs/product/PRODUCT_ROADMAP.md`.

## Inputs

- R1 screenshot archive:
  `docs/research/figma-mcp-read-packets/r1-target-screenshot-manifest-20260707.md`
- R2 token map:
  `docs/research/figma-mcp-read-packets/r2-token-map-20260707.md`
- R3 component hierarchy:
  `docs/research/figma-mcp-read-packets/r3-atomic-component-hierarchy-20260707.md`
- UI/UX read plan:
  `docs/research/figma-mcp-uiux-read-plan.md`
- PRD authority:
  `docs/product/PRODUCT_ROADMAP.md`

## R3b Rules

- Start from `Module` entries whenever a module exists for the WP.
- Treat R3 section membership as explicit component existence.
- Treat exact nested composition as unknown until a targeted R4 module read
  confirms it.
- Do not read global atom or molecule details just because a module might use
  them.
- Exclude section title text nodes from component-contract reads.
- R3b does not consume Figma MCP quota.

## Component Roots

| Layer | Name | ID | R3b role |
| --- | --- | --- | --- |
| module | `Module/启动页模块/默认` | `125:42` | Launch root |
| module | `Module/右侧栏` | `227:2861` | Preview, optimization, compare, edit right-surface root |
| module | `Module/中间面板` | `238:4602` | Preview, compare, drag canvas root |
| module | `Module/左侧栏` | `125:71` | Edit reserved left-surface root |
| module | `Module/设置面板` | `237:4292` | Appearance settings root |
| module | `Module/播放控制栏/播放中` | `115:1098` | Playback-control root |
| module | `Module/窗口标题栏` | `115:1089` | Native-window visual reference only; low R4 priority |

## WP Dependency Map

### WP1 - Token And Theme Foundation

PRD support: S1-S16 design-system foundation

R4 need: none by default.

Use R2 token map first. R4 is only needed if a token binding cannot be resolved
from R2 and the implementation needs to inspect one named component.

Allowed follow-up:

- none for R4

Blocked / unknown:

- shadow/effect exact values remain outside R2 unless a module contract exposes
  bindings later.

### WP2 - Core Atoms And Controls

PRD support: S1, S2, S10-S16

Module roots:

- `Module/播放控制栏/播放中` (`115:1098`)
- `Module/中间面板` (`238:4602`) only when mode switch placement or canvas
  overlay controls are touched

Explicit allowed dependencies:

| Layer | Component | ID | Why allowed |
| --- | --- | --- | --- |
| atom | `Atom/图标按钮` | `105:23` | Directly referenced by playback controls |
| atom | `Atom/文字按钮` | `95:90` | Save, replace, launch, and recovery actions |
| atom | `Atom/模式切换器` | `95:37` | Preview/Edit top-center switch |
| atom | `Atom/文字输入框` | `216:3039` | Runtime text and imageKey inputs |
| atom | `Atom/缩略图框` | `94:83` | Resource and layer thumbnails |
| atom | `Atom/Tab Item` | `286:2564` | Tab/filter item used by filter bars |
| atom | `Atom/状态徽标` | `94:14` | Compact status where PRD/design permits |
| molecule | `Molecule/toast` | `319:5660` | Save/drop feedback primitive |

R4 read order:

1. `Module/播放控制栏/播放中`
2. only then read referenced atom contracts that are still ambiguous

Do not read all atoms globally.

### WP3 - Launch And Canvas Shell

PRD support: S1, S16

Module root:

- `Module/启动页模块/默认` (`125:42`)

Explicit dependencies from R3:

| Layer | Component | ID | Source |
| --- | --- | --- | --- |
| molecule | `Molecule/空态画布` | `124:58` | Direct ref from launch module |
| atom | `Atom/文字按钮` | `95:90` | Direct ref inside empty canvas |
| atom | `Atom/最近文件行/正常` | `124:71` | R3 atom exists; needed by S16 launch recent list |

R4 read order:

1. `Module/启动页模块/默认`
2. `Molecule/空态画布` only if launch module contract does not expose enough
   layout/detail
3. `Atom/最近文件行/正常` only if recent-list behavior or visual states are
   ambiguous after module read

Blocked / unknown:

- R3 does not show the recent-row composition directly inside the launch module.
  R4 must verify whether recent rows are nested deeper or represented in page
  state metadata.

### WP4 - Preview Default Right Surface

PRD support: S3-S8, S11-S15

Module roots:

- `Module/右侧栏` (`227:2861`)
- `Module/中间面板` (`238:4602`) only for canvas/mode switch alignment
- `Module/播放控制栏/播放中` (`115:1098`) only if controls change in this WP

Explicit allowed dependencies:

| Layer | Component | ID | Why allowed |
| --- | --- | --- | --- |
| atom | `Atom/文件信息头部/默认` | `115:1114` | Filename, dirty star, Save As state |
| atom | `Atom/指标优化入口` | `121:1110` | Metric-level optimization entry |
| atom | `Atom/文字输入框` | `216:3039` | Runtime text preview input |
| atom | `Atom/面板区块标题` | `266:3327` | Right-surface section headers |
| atom | `Atom/筛选标签栏` | `154:2476` | Asset tabs/filtering |
| molecule | `Molecule/统计信息网格` | `236:4479` | File facts grid |
| molecule | `Molecule/数据指标块` | `268:7836` | Fact cells and optimization-result facts |
| molecule | `Molecule/资源列表行` | `95:81` | Asset and replaceable rows |
| molecule | `Molecule/缺省` | `298:7215` | Empty states for replaceable/audio/sequence groups |

R4 read order:

1. `Module/右侧栏`
2. only read `Molecule/统计信息网格`, `Molecule/资源列表行`, and
   `Atom/文件信息头部/默认` if the right-sidebar module contract does not expose
   enough details
3. defer atom-level reads until a visible mismatch or implementation ambiguity
   requires them

Blocked / unknown:

- R3 shows no direct child refs for `Module/右侧栏`; its state-specific nested
  composition must be resolved by a targeted R4 module read.

### WP5 - Optimization Flow

PRD support: S8-S10, S14

Module roots:

- `Module/右侧栏` (`227:2861`)
- `Module/中间面板` (`238:4602`) for before/after preview canvas alignment
- `Module/播放控制栏/播放中` (`115:1098`) only if optimization result keeps
  playback controls on the canvas

Explicit allowed dependencies:

| Layer | Component | ID | Why allowed |
| --- | --- | --- | --- |
| atom | `Atom/指标优化入口` | `121:1110` | Metric-level optimization entry |
| atom | `Atom/文字按钮` | `95:90` | Save As / Overwrite / Abandon actions |
| atom | `Atom/状态徽标` | `94:14` | Safety labels when PRD/design permits |
| molecule | `Molecule/优化候选项行` | `95:109` | Optimization detail rows |
| molecule | `Molecule/进度状态` | `159:2814` | Optimization running state |
| molecule | `Molecule/数据指标块` | `268:7836` | Before/after metrics |
| molecule | `Molecule/保存反馈横幅` | `121:1165` | Save/optimization feedback |

R4 read order:

1. `Module/右侧栏` filtered to optimization states
2. `Module/中间面板` only if result-comparison canvas layout is ambiguous
3. `Molecule/优化候选项行` or `Molecule/数据指标块` only after module read

Blocked / unknown:

- R3 does not distinguish optimization detail vs result composition inside the
  right-sidebar variants. R4 must read the module's optimization variants.

### WP6 - Compare And Drag Decision

PRD support: S1, S2, S10

Module roots:

- `Module/中间面板` (`238:4602`)
- `Module/右侧栏` (`227:2861`)
- `Module/播放控制栏/播放中` (`115:1098`) for compare playback-control disabled
  state check

Explicit allowed dependencies:

| Layer | Component | ID | Why allowed |
| --- | --- | --- | --- |
| molecule | `Molecule/拖拽决策` | `294:20629` | Full drag-decision overlay |
| molecule | `Molecule/拖拽决策区` | `121:1134` | Open/compare drop zones |
| molecule | `Molecule/错误恢复面板` | `124:123` | Unsupported file state |
| molecule | `Molecule/toast` | `319:5660` | Unsupported drop toast |
| molecule | `Molecule/动画占位` | `155:2668` | Empty/loaded canvas placeholder states |
| atom | `Atom/图标按钮` | `105:23` | Playback/loop/fullscreen controls |
| atom | `Atom/文字按钮` | `95:90` | Open action inside empty compare slots |

R4 read order:

1. `Module/中间面板`
2. `Module/右侧栏` filtered to compare states
3. `Molecule/拖拽决策` only if the module read does not expose enough overlay
   composition
4. `Molecule/拖拽决策区` only if focus/unsupported states remain ambiguous

Blocked / unknown:

- R3 confirms `Module/中间面板` has `显示拖拽决策`, but not the exact overlay
  placement. R4 must resolve this before implementation.

### WP7 - Edit Reserved, Settings, Loading, Save, And Error States

PRD support: S2, S14, S16, Edit reserved mode rules

Module roots:

- `Module/左侧栏` (`125:71`)
- `Module/设置面板` (`237:4292`)
- `Module/右侧栏` (`227:2861`)
- `Module/中间面板` (`238:4602`)

Explicit allowed dependencies:

| Layer | Component | ID | Why allowed |
| --- | --- | --- | --- |
| atom | `Atom/文件信息头部/默认` | `115:1114` | Direct ref from left sidebar |
| atom | `Atom/筛选标签栏` | `154:2476` | Direct ref from left sidebar |
| atom | `Atom/分割线` | `94:23` | Direct ref from settings and left sidebar |
| molecule | `Molecule/图层列表行` | `294:15420` | Edit left list rows |
| molecule | `Molecule/加载提示文字` | `185:2668` | Loading state |
| molecule | `Molecule/错误恢复面板` | `124:123` | Load/playback/format failures |
| molecule | `Molecule/保存反馈横幅` | `121:1165` | Save states |
| molecule | `Molecule/动画占位` | `155:2668` | Canvas loading/error placeholders |

R4 read order:

1. `Module/左侧栏` for edit reserved left panel
2. `Module/设置面板` for theme settings
3. `Module/右侧栏` for edit/save/error right states
4. `Module/中间面板` only if loading/error canvas states remain ambiguous

Blocked / unknown:

- `Module/设置面板` direct refs only expose dividers at R3 level. R4 must read
  the settings module before styling or implementation.
- `Module/右侧栏` owns many save/error state variants but R3 does not expose
  their internal composition.

### WP8 - Final Pixel And Product Evidence Closure

PRD support: S1-S16

R4 need: none by default.

Use the module contracts already read for WP3-WP7. R6 targeted rechecks are
allowed only for unresolved screenshot mismatches or changed Figma nodes.

## R4 Read Queue

R4 should be requested in small, Owner-authorized batches. The default queue is:

| Order | R4 target | ID | Supports | Reason |
| ---: | --- | --- | --- | --- |
| 1 | `Module/启动页模块/默认` | `125:42` | WP3 | Small root; validates launch direction early |
| 2 | `Module/右侧栏` | `227:2861` | WP4, WP5, WP6, WP7 | Highest reuse and state density |
| 3 | `Module/中间面板` | `238:4602` | WP3, WP4, WP5, WP6, WP7 | Canvas, compare, drag, mode switching |
| 4 | `Module/播放控制栏/播放中` | `115:1098` | WP2, WP4-WP6 | Shared playback controls |
| 5 | `Module/左侧栏` | `125:71` | WP7 | Edit reserved left panel |
| 6 | `Module/设置面板` | `237:4292` | WP7 | Theme/settings sheet |

Only after a module read proves an unresolved dependency should R4 read a
specific molecule or atom. Never read all atoms or all molecules as one batch.

## Dependencies Blocked By Missing R4 Evidence

| Area | Blocked question | Required next evidence |
| --- | --- | --- |
| Right surface | Which molecules/atoms appear in each `Module/右侧栏` mode/state variant? | R4 read for `Module/右侧栏` |
| Canvas shell | How `Module/中间面板` places mode switch, playback controls, compare slots, and drag decision overlay | R4 read for `Module/中间面板` |
| Launch recent list | Whether recent rows are nested inside `Module/启动页模块/默认` or only represented in page states | R4 read for launch module; R5 only if needed |
| Optimization result | Whether result comparison uses `Molecule/数据指标块` directly or through a nested module variant | R4 read for right surface optimization states |
| Settings | Exact settings sheet composition beyond dividers | R4 read for `Module/设置面板` |

## R3b Output Rules For Implementation

- Code implementation should reference canonical component names from this
  packet when mapping Figma to code files.
- Any dependency marked here as allowed is not automatically approved for code
  changes; it only defines what can be read in R4 without a broad scan.
- Visible UI text still must trace to PRD/design docs. Do not add explanatory
  text because a component name suggests it.
- If R4 reveals a component that is not in this R3b plan, add a targeted R3b
  addendum before implementation uses it.

## Next Action

R3b is complete. The next Figma MCP action is R4 and must be explicitly
authorized by Owner before execution.

Recommended first R4 request:

- target: `Module/启动页模块/默认` (`125:42`)
- purpose: validate the smallest high-value module contract before broader
  visual implementation
- expected calls: 1
- hard cap: 2 if the component needs a compact retry
