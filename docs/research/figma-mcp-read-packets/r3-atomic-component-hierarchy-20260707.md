# R3 Atomic Component Hierarchy

Date: 2026-07-07
Owner lane: UI/UX
Figma file: `7hIydrsyIzxs6E5dJQ53tu`
Page: `🧱 组件库` (`88:4275`)

This packet records the R3 Figma MCP read for the component-library atomic
hierarchy. It is an implementation input, not PRD authority.

## Scope

Owner authorized R3 with this scope:

- read the component-library page only
- target the top-level atomic sections
- return direct child component summaries only
- avoid descendant trees, fills, effects, text styles, screenshots, and product
  decisions

## MCP Usage

| Call | Purpose | Tool wall time | Result |
| ---: | --- | ---: | --- |
| 1 | Read lower-case `atom` / `molecule` / `module` targets | 4.3418s | Complete but actual section names are title case |
| 2 | Read title-case section map with richer direct refs | 4.8640s | Tool response truncated around 20 KB; not final source |
| 3 | Read ultra-compact section map | 11.1492s | Complete final source |

Actual quota-counted reads: 3

R3 stayed within the approved hard cap of 3 reads.

## Result Summary

| Item | Result |
| --- | --- |
| Sections found | 3 / 3 |
| Actual section names | `Atom`, `Molecule`, `Module` |
| Missing sections | none |
| Top-level entries outside sections | none |
| Direct children | 39 total |
| Atom children | 15 |
| Molecule children | 16 |
| Module children | 8 |

The authored section names are title case. Implementation docs should use the
canonical lower-case layer names `atom`, `molecule`, and `module`, but R4
scripts should match section names case-insensitively.

## Atom Section

| Name | ID | Type | Properties / variants | Direct refs |
| --- | --- | --- | --- | --- |
| `Atom/文字输入框` | `216:3039` | `COMPONENT_SET` | `激活状态` boolean; `有错误` boolean; `禁用` boolean; `输入文字` text; `状态` = `焦点` / `常态` | none |
| `Atom/分割线` | `94:23` | `COMPONENT_SET` | `方向` = `水平` / `垂直` | none |
| `Atom/加载指示器` | `94:33` | `COMPONENT_SET` | `尺寸` = `小` / `中` / `大` / `尺寸4` | none |
| `Atom/缩略图框` | `94:83` | `COMPONENT_SET` | `类型` = `图片` / `序列帧` / `音频` / `文本` | none |
| `Atom/模式切换器` | `95:37` | `COMPONENT_SET` | `模式切换` = `false` / `true` | none |
| `Atom/图标按钮` | `105:23` | `COMPONENT_SET` | `主要样式` boolean; `禁用` boolean; `激活` boolean; `样式` = `主要` / `次要`; `交互状态` = `默认` | none |
| `Atom/文字按钮` | `95:90` | `COMPONENT_SET` | `类型` = `另存为` / `放弃` / `覆盖保存` / `替换操作`; `状态` = `启用` / `禁用` | none |
| `Atom/文件信息头部/默认` | `115:1114` | `COMPONENT` | `已修改` boolean | `按钮_另存为` -> `类型=另存为, 状态=禁用` |
| `Atom/指标优化入口` | `121:1110` | `COMPONENT_SET` | `类型` = `可优化` / `可安全优化` / `建议查看` | none |
| `Atom/最近文件行/正常` | `124:71` | `COMPONENT` | `悬浮` boolean; `文件失效` boolean | none |
| `Atom/筛选标签栏` | `154:2476` | `COMPONENT` | `选中标签` text | `Tab Item` -> `State=Focused`; 3 x `Tab Item` -> `State=Default` |
| `⚛ Atoms — 原子层` | `253:6706` | `TEXT` | section label only | ignore for R4 contracts |
| `Atom/面板区块标题` | `266:3327` | `COMPONENT` | `标题文字` text; `显示子页签` boolean; `Show 文字按钮` boolean | `子页签` -> `Atom/筛选标签栏` |
| `Atom/Tab Item` | `286:2564` | `COMPONENT_SET` | `Label` text; `State` = `Focused` / `Default` | none |
| `Atom/状态徽标` | `94:14` | `COMPONENT_SET` | `类型` = `可安全执行` / `已替换` / `暂不支持` / `需复核` | none |

## Molecule Section

| Name | ID | Type | Properties / variants | Direct refs |
| --- | --- | --- | --- | --- |
| `Molecule/动画占位` | `155:2668` | `COMPONENT_SET` | `尺寸` = `300` / `200`; `状态` = `加载中` / `播放中` / `空态` / `加载失败` / `播放异常` / `文件不支持` | none |
| `Molecule/加载提示文字` | `185:2668` | `COMPONENT` | `提示文字` text | `加载指示器` -> `尺寸=大` |
| `Molecule/统计信息网格` | `236:4479` | `COMPONENT` | none | 5 x `数据指标块` -> `类型=常规` |
| `Molecule/拖拽决策` | `294:20629` | `COMPONENT` | none | `拖拽决策区_左侧` -> `状态=默认`; `拖拽决策区_右侧` -> `状态=支持` |
| `Molecule/资源列表行` | `95:81` | `COMPONENT_SET` | `类型` = `普通图片` / `可替换文字` / `音频` / `可替换图片` / `序列帧` | none |
| `Molecule/拖拽决策区` | `121:1134` | `COMPONENT_SET` | `状态` = `默认` / `支持` / `不支持` | none |
| `Molecule/保存反馈横幅` | `121:1165` | `COMPONENT_SET` | `状态` = `保存中` / `保存成功` / `保存失败` / `优化中` | none |
| `Molecule/空态画布` | `124:58` | `COMPONENT` | none | `文字按钮` -> `类型=另存为, 状态=启用` |
| `Molecule/错误恢复面板` | `124:123` | `COMPONENT_SET` | `类型` = `加载失败` / `播放异常` / `格式不支持` | none |
| `Molecule/进度状态` | `159:2814` | `COMPONENT_SET` | `Show 文字按钮` boolean; `状态` = `执行中` | none |
| `🧪 Molecules — 分子层` | `253:6707` | `TEXT` | section label only | ignore for R4 contracts |
| `Molecule/数据指标块` | `268:7836` | `COMPONENT_SET` | `标签` text; `数值` text; `单位` text; `显示徽标` boolean; `类型` = `常规` / `优化结果` | none |
| `Molecule/图层列表行` | `294:15420` | `COMPONENT_SET` | `选中` boolean; `绑定镜像图层` boolean; `状态` = `隐藏` / `默认` | none |
| `Molecule/优化候选项行` | `95:109` | `COMPONENT_SET` | `安全等级` = `可执行` / `暂不支持` / `需复核` | none |
| `Molecule/缺省` | `298:7215` | `COMPONENT_SET` | `Property 1` = `可替换元素_空态` / `音频资产_空态` / `序列帧资产_空态` | none |
| `Molecule/toast` | `319:5660` | `COMPONENT_SET` | `Property 1` = `保存失败Toast` / `保存成功Toast` | none |

## Module Section

| Name | ID | Type | Properties / variants | Direct refs |
| --- | --- | --- | --- | --- |
| `Module/右侧栏` | `227:2861` | `COMPONENT_SET` | `模式` = `预览` / `优化` / `编辑` / `对比`; `状态` = `默认` / `Dirty` / `-` / `空态` / `等待另一文件` / `双文件` / `保存中` / `保存成功` / `保存失败` / `优化执行中` / `优化详情` / `优化结果对比` / `无可替换元素` / `无序列帧资产` / `无音频资产` | none at direct-child level |
| `Module/设置面板` | `237:4292` | `COMPONENT` | none | 2 x `分割线` -> `方向=水平` |
| `Module/中间面板` | `238:4602` | `COMPONENT_SET` | `顶部横幅内容` instance swap; `显示拖拽决策` boolean; `模式` = `预览` / `对比` | none at direct-child level |
| `Module/窗口标题栏` | `115:1089` | `COMPONENT` | none | none |
| `Module/播放控制栏/播放中` | `115:1098` | `COMPONENT` | `已暂停` boolean | `按钮_重播`, `按钮_播放暂停`, `按钮_循环`, `按钮_全屏` -> `Atom/图标按钮` variants |
| `Module/启动页模块/默认` | `125:42` | `COMPONENT` | none | `Molecule/空态画布` |
| `Module/左侧栏` | `125:71` | `COMPONENT` | none | `Atom/文件信息头部/默认`; `分割线`; `Atom/筛选标签栏`; 8 x `图层列表行` |
| `Molecule/📦 Modules — 模块层（11）` | `253:6708` | `TEXT` | section label only; name prefix appears stale | ignore for R4 contracts |

## Immediate R3b Implications

- R4 should start from module roots:
  - `Module/启动页模块/默认` (`125:42`)
  - `Module/右侧栏` (`227:2861`)
  - `Module/中间面板` (`238:4602`)
  - `Module/左侧栏` (`125:71`)
  - `Module/设置面板` (`237:4292`)
  - `Module/播放控制栏/播放中` (`115:1098`) when playback controls are touched
- Section title text nodes should be excluded from component-contract reads.
- The direct R3 map is enough to plan R4, but not enough to implement precise
  layout. R4 should read module contracts one WP at a time.
- `Module/右侧栏` carries most Preview / Optimization / Edit / Compare right
  surface states. It should be treated as a high-priority R4 target.
- `Module/中间面板` owns Preview / Compare canvas composition and drag-decision
  display through `显示拖拽决策`.

## Lessons For Later Reads

- Actual section names are `Atom`, `Molecule`, and `Module`; scripts should
  match them case-insensitively to canonical lower-case layers.
- The richer R3 response was too large for the tool output channel even though
  the Figma script completed. Future component reads should default to compact
  payloads and expand only for one named component.
- R4 should not request all component descendants. It should read one module or
  one referenced molecule at a time.
