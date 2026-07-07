# Auto SVGA Figma MCP UI/UX Read Plan

Owner lane: UI/UX
Status: execution plan for Figma-guided short-term UI/UX refinement
Date: 2026-07-07

This document turns the first Figma MCP inventory read into a complete read
and implementation plan. It defines what to read next, how to avoid truncated
payloads, how to control budget, and how to map each Figma read round to
short-term UI/UX work packages.

It is not a PRD and does not change product scope. Product authority remains
`docs/product/PRODUCT_ROADMAP.md`.

## Inputs

Authority and local routing:

- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
- `DESIGN.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`
- `docs/retrospectives/PROJECT_BASELINE_RETROSPECTIVE.md`
- `docs/research/figma-mcp-uiux-call-protocol.md`
- `docs/research/figma-mcp-call-log.md`

Official Figma MCP references used:

- https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- https://developers.figma.com/docs/figma-mcp-server/avoid-large-frames/
- https://developers.figma.com/docs/figma-mcp-server/stuck-or-slow/
- https://developers.figma.com/docs/figma-mcp-server/images-stopped-loading/

## First Read Result

Already completed in Batch 01:

- File key: `7hIydrsyIzxs6E5dJQ53tu`
- Allowed pages:
  - `auto-svga` - `0:1`
  - `🎨 设计令牌` - `88:4020`
  - `🧱 组件库` - `88:4275`
- Excluded page:
  - `备份` - `70:1538`
- Screen frames found: 25 implementation frames
- Variable collections found: 5
- Variables found: 95
- Component page top-level nodes found: 39
- Component-like nodes returned before truncation: 121

Batch 01 cost:

- Total MCP calls: 5
- Conservative quota-counted reads: 4
- Tool wall time: 23.1632s

Batch 01 lesson:

The component-library read returned too much nested data and the tail was
truncated. Future component reads must split top-level component inventory from
per-component detail.

## Budget Model

The Auto SVGA Figma file is in a Professional plan, and the authenticated user
has a Full seat. The working Figma MCP quota baseline is:

- 200 read calls per day
- 10 read calls per minute

Project operating budget:

- Daily planning budget: 160 read calls
- Mandatory reserve: 40 read calls
- Per-minute planning cap: 6 calls per minute
- Per-read target wall time: under 10s
- Per-read soft failure threshold: over 20s or visibly truncated output
- Per-read hard failure threshold: timeout, rate limit, permission failure, or
  incomplete critical payload

If a read call fails, count it as consumed for planning purposes.

## Core Reading Principle

Read Figma in the same order that implementation should happen:

1. visual target screenshots
2. token values and token-to-code map
3. atomic component hierarchy map
4. module-first component dependency graph by work package
5. component contracts for only the dependencies that active work packages need
6. page-state metadata by work package
7. targeted rechecks only where implementation evidence is uncertain

Do not read by curiosity. Every read must name the WP, node IDs, expected
payload, hard stop, and local record path before calling MCP.

## Tool Selection

Use `whoami` only for identity and plan confirmation. It is exempt from the
read-call rate limits per Figma documentation.

Use `get_screenshot` for visual target evidence. Request URL output, not
inline base64. Download the screenshot immediately to a stable non-Git archive
because Figma image URLs can expire.

Use `use_figma` for compact structured reads when:

- variables and variable values are needed
- node hierarchy must be filtered by ID, depth, or type
- instance/component relationships are needed
- text inventory and layout metadata must be mapped to implementation

If a client exposes `get_metadata`, prefer it for sparse node outlines. In the
current Codex Figma tool surface, use a compact `use_figma` equivalent.

Do not use `download_assets` unless implementation needs an actual asset file.
Normal visual comparison should use screenshots.

Do not use Figma Make or write to Figma unless the Owner separately asks.

## Output Size Rules

Every structured read must return compact JSON and respect these limits:

- at most 80 nodes per call
- at most depth 2 by default
- depth 3 only for one named component or region
- no image bytes
- no inline screenshot base64
- no full `fills`, `effects`, or text style dumps unless scoped to one
  component or token mapping
- no nested component-library dump across the whole page
- include `truncated: true` and `nextOffset` when the script intentionally
  stops early

Required fields for page-state metadata:

- `id`
- `name`
- `type`
- `visible`
- `x`, `y`, `width`, `height`
- `layoutMode`
- `itemSpacing`
- padding values
- `cornerRadius`
- bound variable aliases when available
- visible text strings
- instance main component name and ID when available

Fields to omit unless specifically needed:

- every descendant text segment
- raw image fills
- full vector path data
- all invisible layers
- generated React/Tailwind unless using `get_design_context` for one small
  component

## Screenshot Archive Rules

Screenshots from Figma are design reference evidence, not Git assets.

Archive root:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/`

For each screenshot archive:

- save PNG outside Git
- write a local manifest with file key, node ID, node name, dimensions,
  capture time, MCP call number, and SHA-256
- commit only a text manifest or summary when needed
- never commit the PNG unless the Owner explicitly changes asset policy

## Complete Figma Read Rounds

### R0 - Completed Inventory

Status: done

Budget already used:

- 4 quota-counted reads

Do not repeat unless:

- the Owner says the Figma file was reorganized
- a referenced node ID fails
- the file key changes

### R1 - Target Screenshot Archive

Purpose:

Create stable visual targets for pixel-level implementation.

Expected cost:

- 12 to 15 screenshot calls

Nodes:

| Priority | Node ID | State |
| ---: | --- | --- |
| 1 | `37:154` | 启动 / 默认 |
| 2 | `27:2` | 预览 / 默认 |
| 3 | `82:1821` | 预览 / imageKey 重命名 Dirty 状态 |
| 4 | `82:2669` | 预览 / 优化详情 |
| 5 | `64:2040` | 预览 / 优化结果对比 |
| 6 | `66:522` | 对比 / 空态 |
| 7 | `64:1320` | 对比 / 双文件已加载 |
| 8 | `55:197` | 拖拽 / 已有文件_拖入对比 |
| 9 | `64:361` | 拖拽 / 格式不支持_拖拽中 |
| 10 | `86:1271` | 拖拽 / 格式不支持_Drop后 |
| 11 | `55:535` | 编辑 / 默认 |
| 12 | `83:2069` | 参考 / 设置面板 |
| 13 | `80:16365` | 加载 / 加载中 |
| 14 | `80:16612` | 加载 / 加载失败 |
| 15 | `83:1136` | 保存 / 保存失败 |

Rules:

- Use `maxDimension` around 1600-1920 for 1280 x 800 frames.
- Use URL output and download immediately.
- If screenshot URL download fails, re-request only that node once.
- Do not request base64 unless URL fetching is unavailable.

Output:

- local screenshot archive
- text manifest with hashes
- no code changes

### R2 - Exact Token Values And Code Mapping

Purpose:

Map Figma variables to Auto SVGA CSS tokens before visual implementation.

Expected cost:

- 2 to 4 structured reads

Nodes / collections:

- `VariableCollectionId:88:3906` - 基础/色彩
- `VariableCollectionId:88:3939` - 语义/色彩
- `VariableCollectionId:88:3968` - 基础/间距
- `VariableCollectionId:88:3982` - 基础/圆角
- `VariableCollectionId:88:3991` - 语义/间距

Read fields:

- variable ID
- variable name
- type
- mode names
- value by mode
- alias target when value is a variable alias
- Figma scope
- proposed CSS variable name

Output:

- `docs/research/figma-mcp-read-packets/token-map-YYYYMMDD.md` or JSON
- gap list: Figma token exists but code token does not
- debt list: code token exists but does not map to Figma

Implementation dependency:

- WP1 cannot start until R2 is recorded.

### R3 - Atomic Component Hierarchy Map

Purpose:

Read the component library's atomic hierarchy before reading component details.
The Owner-confirmed library model is:

- `module` is composed from `molecule` and `atom`
- `molecule` is composed from `atom`
- `atom` is the smallest reusable UI unit
- Figma component sets and variant properties manage each layer
- the component-library page now has three top-level sections named exactly
  `Atom`, `Molecule`, and `Module`

R3 must avoid a flat component-library scan. It should read only the three
known top-level sections and their direct children, then let R3b and R4 read
from large composed surfaces downward only where an active work package needs
the dependency.

Expected cost:

- 1 structured read
- hard cap: 3 reads if the response must be split by `atom`, `molecule`, and
  `module`
- match section names case-insensitively and normalize them to canonical
  lower-case `atom`, `molecule`, and `module` in local records

Page:

- `🧱 组件库` - `88:4275`

Read fields only:

- section node ID for `atom`, `molecule`, and `module`
- direct child node ID
- name
- type
- parent or section name when visible
- size
- child count
- direct child instance names and IDs only when depth stays at 1
- variant count
- variant property names only
- classification from containing section

Do not return:

- descendant trees
- full fills, effects, or text styles
- child instance internals
- all component variants' internal layers
- inferred product behavior

Output:

- `docs/research/figma-mcp-read-packets/r3-atomic-component-hierarchy-YYYYMMDD.md`
- classified table grouped by `module`, `molecule`, and `atom`
- section-level confidence; entries inside the three Owner-confirmed sections
  are explicit, while entries outside those sections are `unknown`
- component-set variant property list
- missing expected section or section-outside entries that need targeted
  follow-up before implementation

Authorization gate:

- Do not execute R3 without explicit Owner authorization.
- Before the MCP call, state the exact scope, expected calls, hard cap, and
  fallback if the response is large or truncated.

### R3b - Work-Package Component Dependency Plan

Purpose:

Turn R3's hierarchy map into a no-Figma-call dependency plan for implementation
work packages. This is where each WP decides which module is the root, which
molecules and atoms are allowed to be read, and which candidates are out of
scope.

Expected cost:

- 0 Figma MCP calls

Inputs:

- R1 screenshots
- R2 token map
- R3 `atom` / `molecule` / `module` section map
- Batch 01 component names only, if R3 has not been authorized yet

Rules:

- Prefer module roots over isolated atom/molecule reads.
- Mark dependencies as `explicit` when they come from the Owner-confirmed
  `atom`, `molecule`, or `module` sections.
- Mark Batch 01-only dependency guesses as `provisional`.
- Do not ask Figma for a global atom list just because one module might use
  atoms internally.

Output:

- WP-to-component dependency table
- module root per WP
- allowed molecule/atom follow-up list
- dependencies blocked by missing R3 evidence
- completed packet:
  `docs/research/figma-mcp-read-packets/r3b-wp-component-dependency-plan-20260707.md`

### R4 - Module-first Component Contracts

Purpose:

Read reusable component contracts in the same direction as the Figma design
system: module first, then referenced molecule, then referenced atom. R4 should
produce enough detail to implement code contracts and pixel alignment, not a
complete reproduction of every descendant layer.

Expected cost:

- 8 to 14 structured reads in the normal case
- hard cap: 18 structured reads

Read order:

| Priority | Layer | Component | Why |
| ---: | --- | --- | --- |
| 1 | module | `启动页模块/默认` | Launch canvas composition |
| 2 | module | `右侧栏` | Main state-driven information surface |
| 3 | module | `中间面板` | Preview, compare, and drag canvas shell |
| 4 | module | `左侧栏` | Edit reserved left layer surface |
| 5 | module | `设置面板/跟随系统` | Appearance settings |
| 6 | molecule | `播放控制栏/播放中` | Shared bottom playback controls |
| 7 | molecule | `统计信息网格` | File facts and optimization results |
| 8 | molecule | `资源列表行` | Asset and replaceable rows |
| 9 | molecule | `文件信息头部/默认` | Filename, dirty star, save affordance |
| 10 | molecule | `拖拽决策区` | Open/compare drag zones |
| 11 | molecule | `优化候选项行` | Optimization detail rows |
| 12 | molecule | `图层列表行` | Edit reserved layer list |
| 13 | atom | `图标按钮` | Icon-only action grammar |
| 14 | atom | `文字按钮` | Save/abandon/replace action grammar |
| 15 | atom | `模式切换器` | Top-center Preview/Edit switch |
| 16 | atom | `文字输入框` | Runtime text preview and key input |
| 17 | atom | `缩略图框` | Asset/resource thumbnail frame |
| 18 | atom | `Tab Item` | Asset and settings tab item |
| 19 | atom | `状态徽标` | Compact status only where approved by PRD/design |
| 20 | atom | `toast` | Transient unsupported/drop/save feedback |

Read fields:

- component set ID and variant IDs
- variant property names/values
- size
- direct child layout
- token bindings
- visible text inventory
- main nested instances by component name

Rules:

- Start from the module root for a WP whenever a module exists.
- Read molecule and atom details only when the active module references them or
  the R1 screenshot clearly requires them.
- Do not sweep all atoms globally.
- Do not read every nested instance layer when module-level composition already
  gives enough implementation guidance.
- If a module uses unknown nested instances, record the unknown dependency and
  perform one targeted follow-up rather than broadening the whole read.

Stop condition:

- enough data to implement the component contract in code tokens, not enough
  data to reproduce every descendant layer.

### R5 - Page-State Metadata By WP

Purpose:

Read only the page-state frames needed by the active WP.

Expected cost:

- 2 to 5 calls per WP

Rules:

- Do not read all 25 page states in one batch.
- Start each WP from archived screenshots and component contracts.
- Read page-state metadata only when screenshots plus component contracts are
  insufficient.
- Split large states by region:
  - app/window shell
  - canvas/middle region
  - right surface
  - left surface when Edit mode is touched
  - transient overlay/toast when applicable

Return fields:

- region bounds
- component instance IDs and names
- visible text inventory
- token bindings
- auto-layout direction/gaps
- local exceptions

### R6 - Targeted Figma Rechecks

Purpose:

Resolve implementation mismatches after local code and foreground screenshots.

Expected cost:

- 0 to 20 calls total

Allowed reasons:

- a local screenshot mismatch cannot be resolved from archived Figma evidence
- a token alias or value was missing
- a component variant was not captured
- a design frame changed
- Owner asks for a specific comparison

Forbidden:

- re-reading entire pages after ordinary CSS changes
- re-requesting all screenshots because one component changed
- asking Figma to explain product behavior already governed by the PRD

## UI/UX Work Packages

Work packages must be bundled by user-visible surface/state, not by tiny CSS
diffs. Each WP should produce one implementation bundle, one validation bundle,
and one review note.

### WP0 - Figma Evidence And Token Preparation

Scope:

- R1 screenshot archive
- R2 token values
- R3 atomic component hierarchy map
- R3b WP component dependency plan

PRD IDs:

- S1-S16 as reference only

No UI code changes.

Exit criteria:

- screenshot archive manifest exists
- token map exists
- atomic component hierarchy map exists or the task explicitly records that R3
  is waiting for Owner authorization
- WP dependency plan exists, with any pre-R3 assumptions marked provisional
- Figma MCP call log updated

### WP1 - Token And Theme Foundation

Scope:

- align CSS custom properties with Figma variable collections
- light/dark semantic color tokens
- spacing/radius mapping
- remove or mark unmapped one-off values

PRD IDs:

- S1-S16 design-system support

Figma reads:

- R2 only; R6 only if a token value is missing

Validation:

- design-system check
- light/dark local screenshots
- raw value guard

### WP2 - Core Atoms And Controls

Scope:

- icon button
- text button
- mode switch
- playback controls
- inputs
- thumbnails
- status/toast primitives

PRD IDs:

- S1, S2, S10-S16

Figma reads:

- R4 module-first component contracts
- targeted R5 only for controls embedded in a page state

Validation:

- keyboard/focus checks
- disabled state checks
- light/dark screenshots

### WP3 - Launch And Canvas Shell

Scope:

- Launch state
- canvas checker and central drop/open affordance
- recent list low-emphasis hierarchy
- window/canvas shell sizing

PRD IDs:

- S1, S16

Figma reads:

- screenshots: `37:154`
- module root: `启动页模块/默认`
- follow-up molecules/atoms only when referenced by that module, such as
  `最近文件行/正常`, `文字按钮`, or `图标按钮`
- page metadata only for launch regions if needed

Validation:

- launch foreground screenshot
- recent clear affordance visual check
- open/drag priority hierarchy

### WP4 - Preview Default Right Surface

Scope:

- file header
- file facts
- production-spec compact status
- asset groups
- replaceable image/text rows
- dirty Save As affordance

PRD IDs:

- S3-S8, S11-S14, S15

Figma reads:

- screenshots: `27:2`, `82:616`, `82:1821`, `82:1139`,
  `82:1423`, `298:9755`
- module root: `右侧栏`
- follow-up molecules/atoms only when referenced by the right-surface module,
  such as `统计信息网格`, `资源列表行`, `文件信息头部/默认`,
  `指标优化入口`, or `文字输入框`
- page metadata for right surface only

Validation:

- foreground Preview screenshots with real SVGA files
- copy/selection check for dense metadata
- no visible Open Another File button
- no top-right optimization summary button

### WP5 - Optimization Flow

Scope:

- metric-level optimization entry
- optimization detail
- optimization running
- optimization result comparison
- Save As SVGA / Overwrite Save / Abandon Optimization action hierarchy

PRD IDs:

- S8-S10, S14

Figma reads:

- screenshots: `82:2669`, `83:2318`, `64:2040`
- module root: optimization right-surface/result module when present in R3
- follow-up molecules/atoms only when referenced by that module, such as
  `优化候选项行`, `进度状态`, `数据指标块`, `文字按钮`, or `保存反馈横幅`
- page metadata for right surface and compare canvas only

Validation:

- optimization report flow still works
- result comparison foreground screenshot
- overwrite success returns to Preview
- Save As / Overwrite / Abandon states visible and correct

### WP6 - Compare And Drag Decision

Scope:

- compare empty
- compare waiting
- compare two-file
- drag open-vs-compare overlay
- unsupported drag and drop toast

PRD IDs:

- S1, S2, S10

Figma reads:

- screenshots: `66:522`, `66:899`, `83:2239`, `64:1320`,
  `55:197`, `64:361`, `86:1271`
- module roots: `中间面板` and compare/drag module when present in R3
- follow-up molecules/atoms only when referenced by those modules, such as
  `拖拽决策`, `拖拽决策区`, `错误恢复面板`, or `toast`
- page metadata only for compare/drag regions

Validation:

- compare empty playback controls disabled
- compare loaded has two canvases and one comparison-focused right panel
- supported drag focus green
- unsupported drag focus red
- unsupported drop clears canvas and shows toast

### WP7 - Edit Reserved, Settings, Loading, Save And Error States

Scope:

- Edit reserved mode
- Settings appearance sheet
- loading, load failed, playback abnormal
- save validating, save complete, save failed

PRD IDs:

- S2, S14, S16 plus Edit reserved mode rules

Figma reads:

- screenshots: `55:535`, `83:2069`, `80:16365`, `80:16612`,
  `80:16859`, `82:2948`, `82:3324`, `83:1136`
- module roots: `左侧栏`, `设置面板/跟随系统`, and loading/save/error
  modules when present in R3
- follow-up molecules/atoms only when referenced by those modules, such as
  `图层列表行`, `加载提示文字`, `错误恢复面板`, or `保存反馈横幅`
- page metadata only where screenshots and component contracts are insufficient

Validation:

- Edit right panel exposes no inactive controls
- settings has Follow System / Light / Dark only
- loading/error states have no stale metadata
- save states do not claim success before validation

### WP8 - Final Pixel And Product Evidence Closure

Scope:

- compare implemented app screenshots against archived Figma screenshots
- foreground macOS screenshots with native chrome
- light and dark mode
- minimum window pass
- keyboard/focus pass
- final package if requested

PRD IDs:

- S1-S16

Figma reads:

- R6 only, capped at 20 calls

Validation:

- requirement-by-requirement evidence matrix
- screenshot manifest
- automated checks
- foreground desktop screenshots
- status vocabulary: implemented, validated, evidence-ready, Owner accepted,
  distributable, released

## Total Budget Forecast

| Round | Purpose | Expected calls | Hard cap |
| --- | --- | ---: | ---: |
| R0 | Completed inventory | 4 | already done |
| R1 | Screenshot archive | 12-15 | 16 |
| R2 | Token values | 2-4 | 6 |
| R3 | Atomic component hierarchy map | 1 | 3 |
| R3b | WP component dependency plan | 0 | 0 |
| R4 | Module-first component contracts | 8-14 | 18 |
| R5 | WP page-state metadata | 18-35 | 45 |
| R6 | Targeted rechecks | 0-20 | 24 |
| Reserve | rate-limit, stale URLs, broken IDs, design changes | 40 | 40 |

Expected remaining calls for full Figma-guided UI/UX refinement:

- normal case: 45-70 additional quota-counted reads
- difficult case: 90-110 additional quota-counted reads
- absolute stop before Owner intervention: 140 additional quota-counted reads

This keeps the full Figma-guided pass within one Professional daily quota while
retaining recovery reserve.

## Pixel-level Restoration Workflow

For each WP:

1. Start from archived Figma screenshots.
2. Apply token/component changes locally.
3. Capture local app screenshots in the same major state.
4. Compare visually first, then use pixel diff where the surface is stable.
5. Mask dynamic SVGA artwork, macOS native chrome, live timestamps, file names,
   and other intentionally variable content.
6. Use Figma metadata only to resolve mismatches.
7. Record the mismatch list and either fix it or mark it as an intentional
   product/implementation difference.

Do not claim pixel-level restoration from Figma screenshots alone. Final UI/UX
evidence still needs real foreground macOS client screenshots.

## Failure And Recovery Plan

### Rate Limit

Stop immediately. Record the last successful call, failed call, and missing
data. Do not retry repeatedly. Resume after quota reset or Owner direction.

### Timeout Or Lost Connection

Assume the payload was too large unless evidence says otherwise. Wait briefly,
then retry once with half the node count or one smaller region. If it fails
again, log the blocker and continue with already archived screenshots.

### Truncated Response

Do not repeat the same call. Replace it with a paginated or narrower read:

- reduce depth
- reduce node count
- read by component ID
- return names/IDs first, details later
- include `offset` and `limit` in the script

### Expired Screenshot URL

If the local PNG was not saved, re-request only that screenshot node. If the
local PNG exists and has a hash, do not re-request.

### Missing Node ID

Do one low-cost page inventory refresh. If the page changed, update the read
plan before continuing.

### Figma Design Changed Mid-WP

Pause the active WP. Refresh only the affected frame/component. Do not rescan
the entire file.

### Foreground Client Unavailable

Continue implementation and automated checks, but mark UI/UX visual acceptance
as not yet proven.

## Logging Requirements

Every Figma MCP call must append to `docs/research/figma-mcp-call-log.md` or a
linked per-batch record:

- date and time
- file key
- tool
- node IDs
- purpose
- planned call count
- actual wall time
- whether it counts against quota
- result size summary
- whether output was truncated
- archive paths and hashes for screenshots
- direct implementation target
- follow-up or lesson

Each WP review must include:

- Figma read batch IDs used
- Figma screenshot archive paths used
- app screenshots used
- PRD IDs covered
- validation tier
- evidence status band

## Do Not Do

- Do not read the `备份` page.
- Do not read all 25 frames as full metadata in one batch.
- Do not ask Figma for product decisions already governed by PRD.
- Do not use Figma Make AI credits for implementation unless explicitly asked.
- Do not commit Figma PNGs or production design assets.
- Do not declare Owner acceptance or release readiness from MCP evidence.
- Do not let tiny adjacent CSS changes create separate review/screenshot cycles
  when they belong to the same page-state bundle.

## Next Action

R1 screenshots, R2 tokens, R3 hierarchy, R3b dependency planning, WP1A token
implementation, the first R4 module contract, and WP3 launch visual alignment
are complete.

Completed first R4 request:

1. target `Module/启动页模块/默认` (`125:42`);
2. expected calls: 1;
3. actual calls: 2 because the first response was truncated and a compact
   retry was required;
4. packet:
   `docs/research/figma-mcp-read-packets/r4-launch-module-contract-20260707.md`.

Completed WP3 launch visual alignment used:

- R1 launch target screenshot;
- R2 token map and implemented token foundation;
- R4 launch module contract.

WP3 did not require another Figma MCP read.

Completed second R4 request:

1. target `Module/右侧栏` (`227:2861`);
2. expected calls: 1;
3. actual calls: 2 because the module root returned only a state-symbol index
   and the default Preview symbol drilldown still returned only a shell;
4. packet:
   `docs/research/figma-mcp-read-packets/r4-right-surface-state-index-20260707.md`;
5. status: partial. It is useful as a right-surface state index, but not enough
   for pixel-level WP4 implementation.

The next efficient project action is to avoid repeating metadata-only reads for
right-surface symbols. If Owner authorizes another Figma MCP batch, request a
structured child/context read for `模式=预览, 状态=默认` (`227:2796`) that returns
direct children, visible text, geometry, instance main-component IDs,
component properties, and implementation findings. If that read path is not
available, use archived R1 screenshots only for a rough visual analysis pass and
do not claim pixel-level right-surface readiness.

Before any new R4 read, request Owner authorization and target one named module
or component only. Do not read all atoms, all molecules, or all module
descendants in one batch.
