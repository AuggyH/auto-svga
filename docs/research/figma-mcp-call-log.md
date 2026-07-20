# Figma MCP Call Log

Owner lane: UI/UX
Status: append-only operational log
Started: 2026-07-07

This log records Figma MCP usage for Auto SVGA UI/UX work. It tracks planned
budget, actual calls, elapsed time, extracted facts, and lessons for reducing
future Figma MCP quota waste.

## Batch 01 - Final Design Inventory

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Owner approval: Owner said the design稿 has been整理完毕 and approved the first
read.

### Objective

Establish the final design file map before any Figma-guided UI code changes.
This batch intentionally did not implement UI changes.

### Planned Budget

- Planned MCP calls: 5
- Planned quota-counted reads: 4
- Exempt/identity calls: 1
- Practical daily budget baseline: 160 quota-counted reads
- Hard stop for this batch: 6 total calls

### Actual Usage

| # | Tool | Purpose | Counts against read quota | Time |
| ---: | --- | --- | --- | ---: |
| 1 | `whoami` | Confirm authenticated user and plan/seat | No, per Figma docs | 1.5483s |
| 2 | `use_figma` | Read page inventory | Yes, conservative count | 3.5449s |
| 3 | `use_figma` | Read `auto-svga` page top-level screen inventory | Yes | 8.3026s |
| 4 | `use_figma` | Read design-token page and local variable summary | Yes | 3.8074s |
| 5 | `use_figma` | Read component-library page inventory | Yes | 5.9600s |

Actual total MCP calls: 5

Actual quota-counted reads, conservative: 4

Measured tool wall time total: 23.1632s

Remaining practical daily budget after this batch: about 156 quota-counted
reads.

### Auth And Plan Result

Authenticated user:

- Handle: `AuggyH`
- Email: `huang5208@hotmail.com`

Plans seen:

- `SuperForest速拼木学` - Starter, Full
- `Hoby` - Professional, Full
- `Personal` - Starter, Full

Owner confirmed the Auto SVGA file is in the Professional plan. Use
Professional + Full as the working quota baseline.

### Page Inventory

Pages:

- `auto-svga` - `0:1` - implementation candidate
- `备份` - `70:1538` - excluded by protocol
- `🎨 设计令牌` - `88:4020` - implementation candidate
- `🧱 组件库` - `88:4275` - implementation candidate

Current page at first read:

- `auto-svga` - `0:1`

### Screen Inventory

`auto-svga` page top-level count: 34

Implementation screen frames:

| Node ID | Name | Size |
| --- | --- | --- |
| `37:154` | 启动 / 默认 | 640 x 640 |
| `80:16365` | 加载 / 加载中 | 1280 x 800 |
| `80:16612` | 加载 / 加载失败 | 1280 x 800 |
| `80:16859` | 加载 / 播放异常 | 1280 x 800 |
| `27:2` | 预览 / 默认 | 1280 x 800 |
| `82:616` | 预览 / 可替换元素 | 1280 x 800 |
| `82:1821` | 预览 / imageKey 重命名 Dirty 状态 | 1280 x 800 |
| `82:1139` | 预览 / 无可替换元素 | 1280 x 800 |
| `82:1423` | 预览 / 无音频资产 | 1280 x 800 |
| `298:9755` | 预览 / 无序列帧资产 | 1280 x 800 |
| `82:2669` | 预览 / 优化详情 | 1280 x 800 |
| `83:2318` | 预览 / 优化执行中 | 1280 x 800 |
| `64:2040` | 预览 / 优化结果对比 | 1280 x 800 |
| `82:2948` | 保存 / 保存中 | 1280 x 800 |
| `82:3324` | 保存 / 保存成功 | 1280 x 800 |
| `83:1136` | 保存 / 保存失败 | 1280 x 800 |
| `55:197` | 拖拽 / 已有文件_拖入对比 | 1280 x 800 |
| `64:361` | 拖拽 / 格式不支持_拖拽中 | 1280 x 800 |
| `86:1271` | 拖拽 / 格式不支持_Drop后 | 1280 x 800 |
| `66:522` | 对比 / 空态 | 1280 x 800 |
| `66:899` | 对比 / 拖拽中 | 1280 x 800 |
| `83:2239` | 对比 / 已有文件A_等待文件B | 1280 x 800 |
| `64:1320` | 对比 / 双文件已加载 | 1280 x 800 |
| `55:535` | 编辑 / 默认 | 1280 x 800 |
| `83:2069` | 参考 / 设置面板 | 1280 x 800 |

### Token Inventory

Design token page:

- Page: `🎨 设计令牌`
- Page ID: `88:4020`
- Top-level frame: `令牌参考文档` - `88:4025`
- Local variable collections: 5
- Local variables: 95

Variable collections:

| Collection | ID | Modes | Variable count | Types |
| --- | --- | --- | ---: | --- |
| 基础/色彩 | `VariableCollectionId:88:3906` | 默认 | 32 | COLOR |
| 语义/色彩 | `VariableCollectionId:88:3939` | 浅色, 深色 | 28 | COLOR |
| 基础/间距 | `VariableCollectionId:88:3968` | 默认 | 13 | FLOAT |
| 基础/圆角 | `VariableCollectionId:88:3982` | 中等圆角, 大圆角 | 8 | FLOAT |
| 语义/间距 | `VariableCollectionId:88:3991` | 中等圆角, 大圆角 | 14 | FLOAT |

Important token groups observed:

- neutral and accent base colors
- semantic text colors
- semantic surface colors
- semantic border colors
- action colors
- spacing scale
- control/card/modal/toast radii
- panel/list/resource-row spacing

### Component Library Inventory

Component page:

- Page: `🧱 组件库`
- Page ID: `88:4275`
- Top-level nodes: 39
- Component-like nodes returned before truncation: 121

Top-level components / component sets observed:

- `动画占位`
- `加载提示文字`
- `文字输入框`
- `右侧栏`
- `统计信息网格`
- `设置面板/跟随系统`
- `中间面板`
- `拖拽决策`
- `分割线`
- `加载指示器`
- `缩略图框`
- `模式切换器`
- `图标按钮`
- `资源列表行`
- `文字按钮`
- `窗口标题栏`
- `播放控制栏/播放中`
- `文件信息头部/默认`
- `指标优化入口`
- `拖拽决策区`
- `保存反馈横幅`
- `空态画布`
- `最近文件行/正常`
- `错误恢复面板`
- `启动页模块/默认`
- `左侧栏`
- `筛选标签栏`
- `进度状态`
- `面板区块标题`
- `Tab Item`
- `数据指标块`
- `图层列表行`
- `优化候选项行`
- `状态徽标`
- `缺省`
- `toast`

Notable variants observed:

- `右侧栏`: preview/default, preview/dirty, save states, optimization detail,
  optimization running, optimization result compare, edit, compare empty,
  compare waiting, compare two-file.
- `中间面板`: preview, compare.
- `动画占位`: 300 and 200 sizes; playing, loading, empty, load failed, playback
  failed, unsupported file.
- `资源列表行`: normal image, sequence frames, audio, replaceable text,
  replaceable image.
- `图标按钮`: primary and secondary.
- `文字按钮`: save-as, disabled save-as, overwrite save, abandon, replace.
- `拖拽决策区`: default, supported, unsupported.
- `保存反馈横幅`: saving, save success, save failure, optimizing.
- `错误恢复面板`: load failed, playback failed, unsupported format.
- `图层列表行`: default, hidden.
- `优化候选项行`: executable, review required, unsupported.
- `状态徽标`: safe executable, review required, unsupported, replaced.
- `toast`: save success, save failure.

### Batch Result

The first design read successfully established:

- page map
- excluded page
- screen/state list
- core token collections
- component library entry points

No app implementation changes were made.

### Follow-up Read Recommendations

Next Figma read should not repeat this inventory unless the file is reorganized.

Recommended next batch after Owner requests implementation:

1. Capture key state screenshots only:
   - launch
   - preview default
   - preview dirty
   - optimization detail
   - optimization result comparison
   - compare empty
   - compare two files loaded
   - drag supported
   - drag unsupported
   - edit default
   - settings
2. Download screenshot URLs immediately to a stable non-Git archive.
3. Then inspect one state at a time only when implementation needs exact
   layout/token data.

### Protocol Feedback

This batch confirmed the protocol direction is mostly right, but the component
library read returned too much nested data and the response tail was truncated.
Future component reads should:

- first request only top-level component/component-set IDs, names, sizes, and
  variant counts
- avoid nested component details in the first call
- read a single component set by ID only when that component is about to be
  implemented or compared

This reduces context waste and makes the log more complete.

## Batch 02 - R1 Target Screenshot Archive

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R1 - Target Screenshot Archive
Owner approval: Owner approved cautious progress from R1.

### Objective

Create stable local design-target screenshots for the short-term UI/UX
implementation pass before any Figma-guided UI code changes.

This batch intentionally did not read structured node metadata and did not
modify app UI.

### Planned Budget

- Planned screenshot calls: 12-15
- Planned quota-counted reads: 12-15
- Hard stop for this batch: 16 screenshot calls
- Request mode: URL output, no base64
- Archive policy: save PNGs outside Git and commit text manifest only

### Actual Usage

| # | Tool | Node ID | Purpose | Counts against read quota | Time |
| ---: | --- | --- | --- | --- | ---: |
| 1 | `get_screenshot` | `37:154` | 启动 / 默认 pilot capture | Yes | 4.4508s |
| 2 | `get_screenshot` | `27:2` | 预览 / 默认 | Yes | 4.2941s |
| 3 | `get_screenshot` | `82:1821` | 预览 / imageKey 重命名 Dirty 状态 | Yes | 8.6070s |
| 4 | `get_screenshot` | `82:2669` | 预览 / 优化详情 | Yes | 16.1712s |
| 5 | `get_screenshot` | `64:2040` | 预览 / 优化结果对比 | Yes | 19.5493s |
| 6 | `get_screenshot` | `66:522` | 对比 / 空态 | Yes | 12.0197s |
| 7 | `get_screenshot` | `64:1320` | 对比 / 双文件已加载 | Yes | 4.7689s |
| 8 | `get_screenshot` | `55:197` | 拖拽 / 已有文件_拖入对比 | Yes | 8.6486s |
| 9 | `get_screenshot` | `64:361` | 拖拽 / 格式不支持_拖拽中 | Yes | 16.3922s |
| 10 | `get_screenshot` | `86:1271` | 拖拽 / 格式不支持_Drop后 | Yes | 12.3855s |
| 11 | `get_screenshot` | `55:535` | 编辑 / 默认 | Yes | 20.7243s |
| 12 | `get_screenshot` | `83:2069` | 参考 / 设置面板 | Yes | 5.4349s |
| 13 | `get_screenshot` | `80:16365` | 加载 / 加载中 | Yes | 9.7750s |
| 14 | `get_screenshot` | `80:16612` | 加载 / 加载失败 | Yes | 13.8555s |
| 15 | `get_screenshot` | `83:1136` | 保存 / 保存失败 | Yes | 16.5507s |

Actual total MCP calls: 15

Actual quota-counted reads, conservative: 15

Measured MCP screenshot tool wall time total: 173.6277s

Remaining practical daily budget after Batch 02: about 141 quota-counted reads.

### Archive

Stable local archive:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/2026-07-07-r1-target-screenshots/`

Repository text manifest:

`docs/research/figma-mcp-read-packets/r1-target-screenshot-manifest-20260707.md`

Local files:

- 15 target PNG screenshots
- `contact-sheet.png`
- `README.md`

### Verification

- Downloaded every screenshot URL before expiry.
- `file` confirmed all downloaded files are PNG images.
- `shasum -a 256` recorded hashes for all target screenshots.
- A local contact sheet was generated and visually inspected.

### Batch Result

R1 is complete. The project now has stable visual target evidence for:

- Launch
- Preview default
- Preview dirty Save As
- Optimization detail
- Optimization result comparison
- Compare empty
- Compare two-file loaded
- Drag decision
- Unsupported drag/drop
- Edit reserved
- Settings
- Loading
- Load failed
- Save failed

### Protocol Feedback

- The pilot-first approach was useful: it caught that rendered screenshot
  dimensions can include outer window/shadow treatment and differ from the
  frame inventory dimensions.
- Full app screenshots should continue to be read in small batches. One frame
  crossed the 20s soft threshold, although the result was still usable.
- Contact-sheet visual QA is a cheap guard against storing blank or wrong
  target screenshots.

## Batch 03 - R2 Token Values And Code Mapping

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R2 - Exact Token Values And Code Mapping
Owner approval: Owner asked to continue after R1.

### Objective

Read exact Figma variable values for the five known token collections and map
them to the existing Auto SVGA CSS token layer before WP1 implementation.

This batch intentionally did not modify app UI or CSS.

### Planned Budget

- Planned structured reads: 2-4
- Expected target collections: 5
- Expected variables: 95
- Hard stop for this batch: 8 structured reads

### Actual Usage

| # | Tool | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `use_figma` | Initial all-collections token read | Yes | 4.7888s | Tool response truncated; not used as final source |
| 2 | `use_figma` | `基础/色彩` compact collection read | Yes | 4.2505s | Complete |
| 3 | `use_figma` | `语义/色彩` compact collection read | Yes | 1.0871s | Complete |
| 4 | `use_figma` | `基础/间距` compact collection read | Yes | 1.7691s | Complete |
| 5 | `use_figma` | `基础/圆角` compact collection read | Yes | 1.1602s | Complete |
| 6 | `use_figma` | `语义/间距` compact collection read | Yes | 1.0716s | Complete |

Actual total MCP calls: 6

Actual quota-counted reads, conservative: 6

Measured MCP tool wall time total: 14.1273s

Remaining practical daily budget after Batch 03: about 135 quota-counted reads.

### Result

R2 captured all target variables:

- Collections: 5 / 5
- Variables: 95 / 95
- Color alias references: present and recorded by target variable name
- Base64 responses: 0
- Screenshots: 0

Repository token map:

`docs/research/figma-mcp-read-packets/r2-token-map-20260707.md`

### Verification

- The initial all-token output was detected as truncated and not used as the
  final R2 source.
- The five split collection reads each returned `truncated:false` and complete
  variable counts matching Batch 01 inventory.
- Local code token mapping was checked against
  `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`.

### Protocol Feedback

- The original R2 plan said 2-4 reads, but 95 variables with IDs, scopes,
  modes, values, and aliases exceeded the practical response size.
- Future token reads should split by collection from the start.
- Compact color values should be returned as CSS hex strings and aliases as
  `{alias, aliasName}` pairs. This preserves implementation value while
  avoiding response truncation.

## Batch 04 - R3 Atomic Component Hierarchy

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R3 - Atomic Component Hierarchy Map
Owner approval: Owner explicitly authorized entering R3.

### Objective

Read the `🧱 组件库` page's atomic component hierarchy after the Owner organized
the library into three top-level sections. This batch intentionally did not
read component descendants, visual style dumps, screenshots, or product
behavior.

### Planned Budget

- Expected structured reads: 1
- Hard cap: 3 structured reads if section matching or payload size required
  recovery
- Target page: `🧱 组件库` (`88:4275`)
- Target sections: `Atom`, `Molecule`, `Module`

### Actual Usage

| # | Tool | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `use_figma` | Initial lower-case section lookup | Yes | 4.3418s | Complete but actual section names are title case |
| 2 | `use_figma` | Title-case section map with richer direct refs | Yes | 4.8640s | Tool response truncated around 20 KB; not used as final source |
| 3 | `use_figma` | Ultra-compact section map | Yes | 11.1492s | Complete final source |

Actual total MCP calls: 3

Actual quota-counted reads, conservative: 3

Measured MCP tool wall time total: 20.3550s

Remaining practical daily budget after Batch 04: about 132 quota-counted
reads.

### Result

R3 captured all target sections:

- `Atom` - 15 direct children
- `Molecule` - 16 direct children
- `Module` - 8 direct children

Repository hierarchy packet:

`docs/research/figma-mcp-read-packets/r3-atomic-component-hierarchy-20260707.md`

### Verification

- The final compact read returned `missingSections: []`.
- The final compact read returned `outsideTopLevel: []`.
- The final compact read returned `sectionsFound: 3` and `directChildren: 39`.
- The final compact read returned `truncated:false`; the earlier richer read
  was discarded as a final source because the tool output channel truncated it.

### Protocol Feedback

- Match section names case-insensitively and normalize them locally to
  `atom`, `molecule`, and `module`.
- R4 should start from the `Module` section and read one module contract at a
  time.
- Even a direct-child component map can exceed response limits if every direct
  instance reference is returned with coordinates and redundant metadata. Keep
  component reads ultra-compact by default, then expand one named component
  only when implementation needs it.

## Batch 05 - R4 Launch Module Contract

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - Module-first component contract
Owner approval: Owner explicitly confirmed authorization for this R4 read.

### Objective

Read only the launch-page module contract needed for WP3 launch implementation.
This batch intentionally did not read all atoms, all molecules, full page-state
metadata, screenshots, assets, or any Figma write operations.

### Planned Budget

- Planned structured reads: 1
- Target node: `Module/启动页模块/默认` (`125:42`)
- Hard cap: 2 structured reads if compact retry was required
- Output shape: compact contract essentials only

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `use_figma` | `125:42` | Initial launch module contract read | Yes | 4.5312s | Completed in Figma but response was truncated around 20 KB; not used as final source |
| 2 | `use_figma` | `125:42` | Compact retry with contract essentials only | Yes | 3.5509s | Complete final source |

Actual total MCP calls: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 8.0821s

Remaining practical daily budget after Batch 05: about 130 quota-counted
reads.

### Result

R4 captured the launch module contract:

- module root: `Module/启动页模块/默认` (`125:42`)
- module size: `640 x 592`
- direct children: `棋盘格背景`, `Molecule/空态画布`, `最近文件区`
- empty canvas instance: `Molecule/空态画布` (`124:58`)
- launch action visible text: `打开文件`
- recent list: nested directly in launch module
- recent rows visible: 5
- invalid recent row example: present, using `文件不可访问`
- clear-all recent control: present in the recent header

Repository packet:

`docs/research/figma-mcp-read-packets/r4-launch-module-contract-20260707.md`

### Verification

- The first read was discarded as final source because the output was
  truncated.
- The second read returned the needed module facts within the planned hard cap.
- The R4 result matches PRD S1 and S16 at the contract level: one launch canvas
  with drag/open affordance and five recent records.

### Protocol Feedback

- For module contracts, a broad descendant read can still overflow even when
  scoped to one module.
- The retry should explicitly request only names, IDs, geometry, visible text,
  instance main component IDs, component properties, and implementation
  findings.
- Raw Figma node/component names are not always product copy or role truth.
  In this batch, the launch button variant name included `另存为` while the
  visible text was `打开文件`, and the clear-all icon node was named `上传图标`.
  Implementation must follow PRD plus visible design intent, not raw layer
  naming alone.

## Batch 06 - R4 Right Surface State Index

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - Module-first component contract attempt
Owner approval: Owner explicitly confirmed authorization before this read.

### Objective

Read only the right-surface module information needed to start WP4/WP5/WP6.
This batch intentionally did not read all atoms, all molecules, all page-state
frames, screenshots, assets, or any Figma write operations.

### Planned Budget

- Planned structured reads: 1
- Target node: `Module/右侧栏` (`227:2861`)
- Hard cap: 2 structured reads if the root only returned state shells
- Output shape: compact contract essentials only

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_metadata` | `227:2861` | Right-surface module state index | Yes | 15.2526s | Complete state index; no truncation |
| 2 | `_get_metadata` | `227:2796` | Test whether default Preview symbol internals expand | Yes | 11.6318s | Returned only symbol shell; no internal structure |

Actual total MCP calls: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 26.8844s

Remaining practical daily budget after Batch 06: about 128 quota-counted
reads.

### Result

R4 captured a useful right-surface state index but not a complete implementation
contract:

- module root: `Module/右侧栏` (`227:2861`)
- module frame size: `6408 x 848`
- state symbols: 16
- each state symbol size: `360 x 800`
- covered modes: Preview, Optimization, Edit, Compare
- default Preview state ID: `227:2796`

Repository packet:

`docs/research/figma-mcp-read-packets/r4-right-surface-state-index-20260707.md`

### Verification

- The first metadata read returned complete XML and was not truncated.
- The second metadata read confirmed that metadata-only symbol reads do not
  expose the internal child structure needed for pixel-level implementation.
- This batch is therefore marked partial rather than complete.

### Protocol Feedback

- Metadata-only reads are useful for state indexes, not detailed module
  contracts, when component-set children are returned as symbols.
- Do not spend additional reads repeating `_get_metadata` on right-surface
  symbols; the next useful read needs a structured child/context path such as a
  compact `use_figma` script or an equivalent design-context expansion.
- If that path is unavailable, use archived R1 screenshots for rough visual
  analysis only and do not claim pixel-level right-surface implementation
  readiness.

## Batch 07 - R4 WP4 Right Surface Dependency Contracts

Date: 2026-07-07
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - WP4 molecule/atom dependency contracts
Owner approval: Owner explicitly approved this follow-up batch.

### Objective

Read only the high-value WP4 right-surface molecule/atom dependencies needed to
decide whether pixel-oriented implementation should proceed from component
contracts, instead of reading the entire component library or repeating
metadata-only module reads.

### Planned Budget

- Planned structured reads: 3
- Hard cap: 5
- Initial pilot: `Molecule/统计信息网格` (`236:4479`)
- Follow-up targets only if the pilot returned usable structure

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_design_context` | `236:4479` | Fact grid and metric block contract | Yes | 6.6398s | Complete usable component context |
| 2 | `_get_design_context` | `95:81` | Resource/replacement row contract | Yes | 7.6002s | Complete usable component context |
| 3 | `_get_design_context` | `115:1114` | File header and Save As contract | Yes | 11.1256s | Complete usable component context |
| 4 | `_get_design_context` | `154:2476` | Asset filter tab contract | Yes | 4.5797s | Complete usable component context |
| 5 | `_get_design_context` | `298:7215` | Empty-state contract | Yes | 9.5353s | Complete usable component context |

Actual total MCP calls: 5

Actual quota-counted reads, conservative: 5

Measured MCP tool wall time total: 39.4806s

Remaining practical daily budget after Batch 07: about 123 quota-counted
reads.

### Result

R4 captured enough WP4 dependency contracts for a first Preview right-surface
implementation pass:

- `Molecule/统计信息网格` (`236:4479`)
- `Molecule/资源列表行` (`95:81`)
- `Atom/文件信息头部/默认` (`115:1114`)
- `Atom/筛选标签栏` (`154:2476`)
- `Molecule/缺省` (`298:7215`)

Repository packet:

`docs/research/figma-mcp-read-packets/r4-wp4-right-surface-dependency-contracts-20260707.md`

### Verification

- The pilot molecule read returned concrete structure, token names, typography,
  spacing, variants, visible copy, and screenshot context.
- The remaining four reads also returned usable component context.
- No Figma screenshots or remote assets were committed.
- This batch changes the implementation decision: WP4 should proceed from
  R1 screenshots + R2 tokens + these molecule/atom contracts, without waiting
  for a full component-library read.

### Protocol Feedback

- Do not judge pixel implementation feasibility from module reads alone.
  Component-set metadata can fail while targeted molecule/atom design context
  still provides useful contracts.
- Avoid full component-library reads. The dependency-driven subset was enough
  for WP4 first pass and stayed within the five-call hard cap.
- Treat generated React/Tailwind code only as a design-context carrier; convert
  it into the existing Electron HTML/CSS/token/component structure.

## Batch 08 - R4 Canvas And Playback Contracts

Date: 2026-07-08
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R4 - canvas, playback, mode switch, and icon-button contracts
Owner approval: Standing authorization applied because local-day conservative
usage was 0/160 before this batch.

### Objective

Read the next shared visual contracts needed for the short-term canvas-first
client: center canvas module, bottom playback controls, top-center mode switch,
and shared compact icon-button styling.

### Planned Budget

- Planned structured reads: 4
- Hard cap: 5
- Optional fifth read allowed only for one concrete child node if the first four
  responses were unusable or truncated

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_design_context` | `238:4602` | Center canvas shell and embedded control context | Yes | 6.6146s | Complete usable module context |
| 2 | `_get_design_context` | `115:1098` | Playback control bar contract | Yes | 5.2083s | Complete usable module context |
| 3 | `_get_design_context` | `95:37` | Preview/Edit mode switch contract | Yes | 4.2247s | Complete usable atom context |
| 4 | `_get_design_context` | `105:23` | Primary/secondary icon-button contract | Yes | 4.1495s | Complete usable atom context |

Actual total MCP calls: 4

Actual quota-counted reads, conservative: 4

Measured MCP tool wall time total: 20.1971s

Current local-day conservative usage after Batch 08: 4/160.

### Result

R4 captured enough canvas/playback contracts for the next implementation pass:

- `Module/中间面板` (`238:4602`)
- `Module/播放控制栏/播放中` (`115:1098`)
- `Atom/模式切换器` (`95:37`)
- `Atom/图标按钮` (`105:23`)

Repository packet:

`docs/research/figma-mcp-read-packets/r4-canvas-playback-contracts-20260708.md`

### Verification

- All planned reads completed.
- No optional fifth read was used.
- No response appeared truncated.
- No Figma write operation, Figma Make action, or asset commit occurred.

### Protocol Feedback

- Component-targeted reads remain efficient for implementation-ready contracts.
- The returned center module still contains the older left/right drag-decision
  overlay. Current PRD top/bottom 25/75 drag-decision behavior overrides that
  stale Figma detail.

## Batch 09 - R5 Preview Right Surface Rhythm

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R5 - Preview default right-surface rhythm
Owner approval: Standing authorization applied because local-day conservative
usage was 0/160 before this batch.

### Objective

Read the smallest useful context needed to align the Auto SVGA `0.1.x` Preview
right information surface with the Figma default Preview frame, specifically
right-panel padding and section rhythm.

### Planned Budget

- Planned structured reads: 2
- Hard cap: 3
- Stop after locating the Preview default frame and extracting right-surface
  rhythm, or earlier on quota/rate/permission errors.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_get_metadata` | file root | Cheap page index | Conservative yes | 1.6275s | Failed: tool not found; no design data returned |
| 2 | `_use_figma` | file root | Compact page and top-level frame inventory | Yes | 3.2292s | Complete usable page/frame index |
| 3 | `_use_figma` | `预览 / 默认` (`27:2`) | Compact right-surface layout and typography inventory | Yes | 6.5214s | Usable; response truncated after key facts |

Actual total MCP attempts: 3

Actual quota-counted reads, conservative: 3

Measured MCP tool wall time total: 11.3781s

Current local-day conservative usage after Batch 09: 3/160.

### Result

R5 captured enough right-surface rhythm facts for a token-only implementation
slice:

- `预览 / 默认` frame (`27:2`)
- right content instance `右侧内容区` (`158:2709`)
- right content size `360 x 800`
- right content padding `16px`
- right content vertical gap `4`
- file header width `328px`
- resource row size `328 x 56`

Repository packet:

`docs/research/figma-mcp-read-packets/r5-preview-right-surface-rhythm-20260709.md`

### Verification

- No Figma write operation, Figma Make action, screenshot archive, or asset
  commit occurred.
- The failed `_get_metadata` exposure should not be used again unless the MCP
  tool list changes.
- The truncated third response was sufficient for this WP; no extra read was
  made after the hard cap.

## Batch 10 - R5 Optimization Detail Surface

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R5 - Preview optimization detail surface
Owner approval: Standing authorization applied because local-day conservative
usage was 3/160 before this batch.

### Objective

Read the smallest useful context needed to align the Auto SVGA `0.1.x`
optimization detail surface with the Figma candidate-row rhythm, without
reading unrelated pages or redefining product scope.

### Planned Budget

- Planned structured reads: 1
- Hard cap: 2
- Stop after extracting the optimization detail row contract, or earlier on
  quota/rate/permission errors.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `预览 / 优化详情` (`82:2669`) | Compact right-surface and optimization-row layout inventory | Yes | 5.1170s | Complete usable JSON; no truncation |

Actual total MCP attempts: 1

Actual quota-counted reads, conservative: 1

Measured MCP tool wall time total: 5.1170s

Current local-day conservative usage after Batch 10: 4/160.

### Result

R5 captured enough optimization detail row facts for a tokenized implementation
slice:

- `预览 / 优化详情` frame (`82:2669`)
- right module size `360 x 800`
- right module padding `16px`
- optimization candidate row size `328 x 62`
- candidate row gap `8`
- candidate row padding `12px`
- candidate title `12px / 18px`
- candidate summary `11px / 16px`
- state backgrounds for safe, review, and unsupported rows

Repository packet:

`docs/research/figma-mcp-read-packets/r5-optimization-detail-surface-20260709.md`

### Verification

- No Figma write operation, Figma Make action, screenshot archive, or asset
  commit occurred.
- The first read returned enough compact data; the optional second read was not
  used.

## Batch 11 - R6 Design System System Read

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R6 - system-level design-system read
Owner approval: Standing authorization applied because local-day conservative
usage was 4/160 before this batch.

### Objective

Read the current Figma design system in implementation order instead of by
page-level polish target:

1. token/variable collections;
2. `Atom` / `Molecule` / `Module` component catalog;
3. page-state frame index and top-level module composition.

This batch exists to support WP-A token/theme and WP-B component-system
implementation before further page-state polish.

### Planned Budget

- Planned structured reads: 3
- Hard cap: 5
- Optional reads allowed only for truncation or one narrower retry of the same
  system-level target.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | Figma variables | Compact current variable collections and mode values | Yes | 10.3451s | Complete usable JSON |
| 2 | `_use_figma` | `🧱 组件库` | Compact direct-child component catalog | Yes | 4.5688s | Complete usable JSON |
| 3 | `_use_figma` | `auto-svga` page | Page-state index with deeper system instances | Yes | 13.5602s | Truncated around 20 KB |
| 4 | `_use_figma` | `auto-svga` page | Ultra-compact page-state retry | Yes | 6.8827s | Complete usable JSON |

Actual total MCP attempts: 4

Actual quota-counted reads, conservative: 4

Measured MCP tool wall time total: 35.3568s

Current local-day conservative usage after Batch 11: 8/160.

### Result

R6 confirmed:

- 5 variable collections and 95 variables.
- Component library top-level sections:
  - `Atom`: 14 direct implementation entries.
  - `Molecule`: 15 direct implementation entries.
  - `Module`: 7 direct implementation roots.
- `auto-svga` page-state frames: 25.
- Launch target: `640 x 640`, titlebar `640 x 48`, launch module
  `640 x 592`.
- Main workbench frames: `1280 x 800`, center module `920 x 800`, right
  module `360 x 800`.
- Edit frame: left `360`, center `560`, right `360`.

Repository packet:

`docs/research/figma-mcp-read-packets/r6-design-system-system-read-20260709.md`

### Verification

- No Figma write operation, screenshot archive, Figma Make action, or asset
  commit occurred.
- The truncated third response was followed by one narrower retry within the
  predeclared hard cap.
- R6 does not authorize page-level micro-polish by itself; it feeds WP-A,
  WP-B, and then WP-C.

## Batch 12 - R7 Right Surface Default Contract

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R7 - targeted right-surface structure
Owner approval: Standing authorization applied because local-day conservative
usage was 8/160 before this batch.

### Objective

Read the internal structure for `Module/右侧栏` default Preview state
`模式=预览, 状态=默认` (`227:2796`) so the next RightSurface implementation
pass can follow the Figma module contract instead of page-level guessing.

### Planned Budget

- Planned structured reads: 1
- Hard cap: 2
- Optional retry allowed only for truncation or a symbol-shell response.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `227:2796` | Compact right-surface structure with descendants | Yes | 6.8383s | Direct children complete; response tail truncated |
| 2 | `_use_figma` | `227:2796` | Direct-child-only compact retry | Yes | 3.2104s | Complete usable JSON |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 10.0487s

Current local-day conservative usage after Batch 12: 10/160.

### Result

R7 confirmed:

- right surface default Preview state is `360 x 800`;
- padding is `16px` on all sides;
- direct child width is `328px`;
- direct vertical rhythm is header `50px`, divider, metric grid `204px`,
  divider, replaceable section `147px`, divider, asset list `301px`;
- the contract is sufficient for the next RightSurface module alignment pass.

Repository packet:

`docs/research/figma-mcp-read-packets/r7-right-surface-default-contract-20260709.md`

### Verification

- No Figma write operation, screenshot archive, Figma Make action, or asset
  commit occurred.
- The first response was useful but truncated, and the second response stayed
  within the predeclared hard cap.

## Batch 13 - R8 State Module Contract Batch

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R8 - compact state/module contract batch
Owner approval: Standing authorization applied because local-day conservative
usage was 10/160 before this batch.

### Objective

Read remaining high-impact state/module contracts in one batch instead of
page-by-page: Launch, Optimization detail/result, Save states, Drag states,
Compare states, Edit, and Settings.

### Planned Budget

- Planned structured reads: 1
- Hard cap: 2
- Optional retry allowed only for truncation before target-state data.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `auto-svga` page | Compact state index plus selected state/module summaries | Yes | 9.6103s | State index complete; selected payload truncated in Preview states |
| 2 | `_use_figma` | `auto-svga` page | Target-state-only retry for Launch / Optimization / Save / Drag / Compare / Edit / Settings | Yes | 9.7076s | Target list complete; payload still truncated before full Compare/Edit/Settings interiors |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 19.3179s

Current local-day conservative usage after Batch 13: 12/160.

### Result

R8 confirmed:

- the `auto-svga` page contains 25 visible implementation page-state frames;
- all 14 requested target states were found;
- Launch is `640 x 640`, titlebar `640 x 48`, launch module `640 x 592`;
- Optimization detail and optimization result both use center/right module
  composition with right module `360 x 800`, padding `16`, gap `4`;
- Save states use Preview center plus status-specific Preview right surface;
- Drag states use Compare center plus Preview right surface and include
  `打开文件`, `添加对比文件`, and `不支持的文件格式` labels.

R8 limitation:

- The hard cap was reached and the second response still truncated before full
  Compare loaded, Edit, and Settings interiors. R8 is not pixel-level authority
  for those interiors.

Repository packet:

`docs/research/figma-mcp-read-packets/r8-state-module-contract-batch-20260709.md`

### Verification

- No Figma write operation, screenshot archive, Figma Make action, or asset
  commit occurred.
- The second call stayed within the predeclared hard cap.
- Future Compare/Edit/Settings implementation should use a narrower R9 read if
  existing R6 top-level composition is insufficient.

## Batch 14 - R9 Compare Edit Settings Target Read

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R9 - narrow missing-interior read
Owner approval: Standing authorization applied because local-day conservative
usage was 12/160 before this batch.

### Objective

Read only the interiors that R8 failed to return before truncation:

- `对比 / 双文件已加载`;
- `编辑 / 默认`;
- `参考 / 设置面板`;
- optional `对比 / 空态` if it fits in the same payload.

This batch intentionally did not re-read screenshots, variables, the component
library, all page states, or all descendant layers.

### Planned Budget

- Planned structured reads: 1
- Hard cap: 2
- Optional retry allowed only if the first call failed or returned no usable
  target payload.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `auto-svga` page | Compact interiors for Compare loaded, Edit default, Settings, and optional Compare empty | Yes | 4.5433s | Compare loaded, Edit default, and Settings returned usable interiors; response tail truncated before optional Compare empty |

Actual total MCP attempts: 1

Actual quota-counted reads, conservative: 1

Measured MCP tool wall time total: 4.5433s

Current local-day conservative usage after Batch 14: 13/160.

### Result

R9 confirmed:

- Compare loaded uses a `920 x 800` compare center module with two `460 x 800`
  canvas regions and a `360 x 800` compare right surface;
- Compare right surface uses padding `16`, gap `4`, header `312 x 54`,
  divider `328 x 1`, and a two-column metric area `328 x 347`;
- Edit default uses left `360`, center `560`, right `360`, with the left layer
  list composed from `Molecule/图层列表行` rows sized `328 x 56`;
- Settings uses a centered `Module/设置面板` at `360 x 298`, vertical gap `16`,
  title row, appearance block, divider, and button area.

Boundary note:

- Figma includes Edit right placeholder text, but implementation must follow
  the stricter PRD/DESIGN rule: short-term Edit right panel remains reserved and
  must not expose inactive controls or future-function copy.

Repository packet:

`docs/research/figma-mcp-read-packets/r9-compare-edit-settings-target-read-20260709.md`

### Verification

- No Figma write operation, screenshot archive, Figma Make action, or asset
  commit occurred.
- The optional second read was skipped because the first read returned the
  blocking target interiors.

## Batch 15 - R10 Atom Molecule Contract Batch

Date: 2026-07-09
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R10 - component-library Atom/Molecule contracts
Owner approval: Standing authorization applied because local-day conservative
usage was 13/160 before this batch.

### Objective

Read high-reuse component contracts from `🧱 组件库` instead of page-state
screens:

- button, icon button, mode switch, text input, metric optimization entry;
- metric grid and metric block;
- resource row, layer row, optimization candidate row, toast;
- filter tabs, tab item, settings module when the payload allows.

### Planned Budget

- Planned structured reads: 1
- Hard cap: 2
- Optional retry allowed only if the first payload did not answer the priority
  component contracts.

### Actual Usage

| # | Tool | Target | Purpose | Counts against read quota | Time | Result |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | `_use_figma` | `🧱 组件库` | Priority Atom/Molecule contract batch | Yes | 4.3990s | Usable early payload; truncated during `Molecule/数据指标块` |
| 2 | `_use_figma` | `🧱 组件库` | Remaining priority components only | Yes | 4.1878s | Complete usable JSON for row/toast/filter/settings targets |

Actual total MCP attempts: 2

Actual quota-counted reads, conservative: 2

Measured MCP tool wall time total: 8.5868s

Current local-day conservative usage after Batch 15: 15/160.

### Result

R10 confirmed reusable component details for:

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
- `Atom/筛选标签栏`
- `Atom/Tab Item`
- `Module/设置面板`

Repository packet:

`docs/research/figma-mcp-read-packets/r10-atom-molecule-contract-batch-20260709.md`

### Verification

- No Figma write operation, screenshot archive, Figma Make action, or asset
  commit occurred.
- The second call was not a broad retry; it read only the remaining priority
  components after the first response truncated.

## Batch 16 - R11 Current-Head Fidelity Audit

Date: 2026-07-10
Operator: Codex UI/UX lane
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Read round: R11 - current-head fidelity audit
Owner approval: Standing authorization applied because reconstructed
current-day usage was `0/160` before this batch.

### Objective

Fresh-read the current Figma page-state targets required by the fidelity gate
for exact source and installed build
`552bf77991bcf3a85d1e438454b888a734984ec8`.

This batch intentionally did not use Figma Make, Figma AI, write tools, broad
token inventories, broad component inventories, or the excluded `备份` page.

### Planned Budget

- Planned quota-counted reads: 11
- Hard cap: 12
- Optional retry allowed only if required target metadata was truncated or
  unusable.

### Actual Usage

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

Actual total MCP attempts: 12

Actual quota-counted reads, conservative: 12

Measured MCP tool wall time total: 59.2419s

Current local-day conservative usage after Batch 16: 12/160.

### Result

R11 confirmed the fresh Figma target screenshots and compact metadata for:

- Launch `37:154`
- Loading `80:16365`
- Load failed `80:16612`
- Preview default `27:2`
- Preview replaceable `82:616`
- Preview optimization `82:2669`
- Compare empty `66:522`
- Compare loaded `64:1320`
- Edit reserved `55:535`
- Settings `83:2069`

Repository packet:

`docs/research/figma-mcp-read-packets/r11-current-head-fidelity-audit-20260710.md`

Local non-Git screenshot archive:

`/Users/huangtengxin/.codex/visualizations/2026/07/10/019f4aaa-c716-7e23-99a0-27823726a5be/r11-figma-fidelity/`

### Discrepancy Summary

The largest Phase A mismatch candidate is the Loading / Load failed page-state
family:

- R11 Figma keeps these states inside the workbench shell with center canvas,
  right information surface, titlebar, and mode/playback context.
- Current source uses standalone full-window `stateView` recovery panels.
- This may be an intentional product/accessibility divergence because the
  execution plan also requires no stale metadata in loading/failure states.

No UI source repair was performed in Phase A. Phase B must bind packaged-app
foreground screenshots to R11 targets before deciding whether a bundled Figma
fidelity repair is needed.

### Verification

- No Figma write operation, Figma Make action, or Figma AI action occurred.
- No PNG was committed to the repository.
- The batch stopped exactly at the predeclared hard cap.
