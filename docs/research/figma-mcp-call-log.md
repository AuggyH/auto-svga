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
