# Auto_SVGA

Exporter-ready intermediate protocol MVP

一个用于自动化生成“头像框”类型 SVGA 动效工程的最小可行项目。当前版本输出 exporter-ready 工程协议、真实 generated assets、透明 PNG 帧序列、WebM/MP4 辅助预览、报告和真实 `.svga` 文件。

## Scope

- 资产类型：仅支持 `avatar_frame`
- 输入：透明背景 PNG 头像框素材 + `asset.config.json`
- 输出：`project.json`、`svga-map.json`、generated assets、`preview_frames/`、`preview.webm`、`preview.mp4`、fallback `preview.gif`、`report.json` 和真实 `.svga`
- 模板：`breathing_glow`、`metal_edge_sweep`、`gem_twinkle`
- 技术栈：TypeScript + Node.js + pnpm

## Design Direction

Product and UI design guidance lives in [DESIGN.md](DESIGN.md). `AGENTS.md` describes engineering constraints; `DESIGN.md` describes how auto-svga product surfaces should look and behave.

Current UI direction:

- default local playback review uses one large SVGA preview plus an information panel
- export review compares exported SVGA against a reference video, preferably MP4/WebM
- local compare mode is explicit and used for SVGA A/B comparisons
- Chinese labels are primary, while English labels and original report keys remain visible for debugging

## Multi-format workbench preparation

The current production scope is still `avatar_frame` to SVGA. A host-neutral
architecture proposal for future SVGA, VAP, Lottie, animated WebP, WebM, APNG,
and sprite-sequence inspection is documented in:

- [docs/multiformat-workbench-architecture.md](docs/multiformat-workbench-architecture.md)
- [docs/decisions/ADR-003-multiformat-workbench-boundaries.md](docs/decisions/ADR-003-multiformat-workbench-boundaries.md)

The initial contracts under `src/workbench/` are isolated from the current CLI,
exporter, and Web preview runtime. No additional player, encoder, or runtime
dependency is enabled by this preparation work.

The first adapter slice is available under `src/workbench/svga/`. It maps
standard SVGA protobuf metadata to `MotionAssetInfo` without changing the
existing exporter, CLI, or Web player. The adapter itself consumes bytes and an
injected inspector; Node-specific zlib and proto loading remain in a separate
host implementation.

## Quick Start

```bash
pnpm install
pnpm build
pnpm build:example
```

示例输出会生成在：

```text
examples/avatar_frame_basic/output/
```

## MVP 0.1 Planning Chain

当前 MVP 0.1 链路聚焦 layered avatar frame job；现阶段已支持生成 `motion-plan.json`、`project.json`、generated assets、透明预览帧、WebM/MP4 辅助预览、fallback GIF、报告、真实 `.svga`、验收状态和 `delivery.zip`。

`avatar_frame` 的默认生产画布为 `300 × 300`。真实素材可以通过 `sourceCanvas` 保留原始坐标规格，例如 `600 × 600 → 300 × 300`；planning chain 会生成缩放并按 alpha 极限裁切后的 `generated/optimized/*.png`，SVGA 不直接打包带有大面积透明空白的源图。

`jobs/` is a local runtime workspace and is ignored by Git. Real input assets and generated outputs should stay local. Use `examples/` or `fixtures/` only for approved mock assets.

标准 job 示例：

```text
jobs/avatar_frame_local_001/
  input/
    config.json
    structure.json
    requirement.txt
    base_frame.png
    left_wing.png
    right_wing.png
    top_gem.png
  generated/
  project/
    motion-plan.json
    project.json
  output/
```

运行规划链路：

```bash
pnpm autosvga:plan -- jobs/avatar_frame_local_001
```

如果当前环境没有全局 `pnpm`，也可以在已安装依赖后使用：

```bash
./node_modules/.bin/tsc -p tsconfig.json
node dist/cli.js plan jobs/avatar_frame_local_001
```

该命令会：

- 读取并校验 `input/config.json`
- 读取并校验 `input/structure.json`
- 根据结构和 `motionAllowed` 自动生成 `project/motion-plan.json`
- 将 motion plan 展开成 `project/project.json`
- 将 canvas anchor 转换为 local anchor，例如 `left_wing` 的 `{ x: 145, y: 238 }` 和 bbox `[40, 150, 170, 300]` 会得到 `{ localX: 105, localY: 88 }`

渲染 MVP preview：

```bash
pnpm autosvga:preview -- jobs/avatar_frame_local_001
```

或：

```bash
./node_modules/.bin/tsc -p tsconfig.json
node dist/cli.js preview jobs/avatar_frame_local_001
```

该命令会读取 `jobs/avatar_frame_local_001/project/project.json`，自动补齐本阶段需要的 generated assets，并输出：

```text
jobs/avatar_frame_local_001/generated/
  sweep_light.png
  sweep_light_masked.png
  glow_frame.png
  glow_dot.png

jobs/avatar_frame_local_001/output/
  preview_frames/
    frame_000.png
    ...
  preview.webm
  preview.mp4
  preview.gif
  review_frames_contact_sheet.png
  preview-report.json
```

验收优先级：

1. 真实 `.svga` 在 Web 验收页中的播放效果
2. `preview.webm`、`preview.mp4` 和 RGBA `preview_frames/`
3. `preview.gif`，仅用于 fallback、快速浏览或文档展示

`preview_frames` 保留透明 RGBA；`preview.webm` 优先使用 VP9 alpha；`preview.mp4` 合成到 `#111827` 深色背景。ffmpeg 不可用时 WebM/MP4 会记录 warning，但不会阻断 PNG frames、GIF 或后续主链路。

MVP PreviewRenderer 支持：

- `canvas`
- `fps`
- `durationMs`
- `frames`
- `layers`
- `zIndex`
- `source`
- `bbox`
- `anchor.canvasX / anchor.canvasY`
- `anchor.localX / anchor.localY`
- keyframes 中的 `x`、`y`、`scaleX`、`scaleY`、`rotation`、`alpha`
- keyframe `easing`，PreviewRenderer 与 SVGAExporter 共用同一套插值器

渲染时 rotation 和 scale 围绕 `anchor.localX/localY` 执行，不围绕图片中心或左上角。

当前 easing 支持：

```text
linear
easeInSine
easeOutSine
easeInOutSine
easeInQuad
easeOutQuad
easeInOutQuad
easeOutBack
```

`metal_sweep` 使用逐帧 baked mask：moving sweep 先与 base frame alpha 合成，再排除 `structure.safeArea`，输出 `generated/sweep_baked/sweep_###.png`。默认 balanced 模式使用 `sweepFrameStride = 3`，透明帧和低贡献帧会跳过，保留帧按 alpha bbox 裁切并做完全相同 hash 去重。每个 sprite 保存自己的画布偏移，不再把 full-canvas baked PNG 写入 SVGA。

`report.json.memoryEstimate` 按唯一图片的 `width × height × 4` 估算解码内存。头像框硬预算为 `8 MB`，推荐控制在 `6.5 MB` 以下；超过推荐值会产生 performance warning。`technicalStatus` 表示工程链路状态，`visualStatus` 和 `acceptance.status` 表示人工视觉验收状态，两者不会混用。

运行 report 链路：

```bash
pnpm autosvga:report -- jobs/avatar_frame_local_001
```

或：

```bash
./node_modules/.bin/tsc -p tsconfig.json
node dist/cli.js report jobs/avatar_frame_local_001
```

该命令会读取 `input/config.json`、`input/structure.json`、`project/motion-plan.json`、`project/project.json`，并尽量合并 `output/preview-report.json` 的预览结果，输出：

```text
jobs/avatar_frame_local_001/output/
  report.json
  svga-map.json
```

`report.json` 记录生成摘要、预览结果、基础验收状态和 applied effects。`svga-map.json` 记录 project layer、source part、source effect、资源引用关系，以及真实 SVGA exporter 可使用的 `svgaSpriteId` / `svgaImageKey` 字段。

导出 MVP SVGA：

```bash
pnpm autosvga:export -- jobs/avatar_frame_local_001
```

或：

```bash
./node_modules/.bin/tsc -p tsconfig.json
node dist/cli.js export jobs/avatar_frame_local_001
```

该命令会读取 `project/project.json`，自动补齐缺失的 generated assets，使用 `proto/svga.proto` 和 `protobufjs` 生成真实可解析的 zlib-compressed protobuf `.svga`，并输出：

```text
jobs/avatar_frame_local_001/output/
  avatar_frame_local_001.svga
  report.json
  svga-map.json
```

完整 MVP 0.1 链路命令：

```bash
node dist/cli.js plan jobs/avatar_frame_local_001
node dist/cli.js preview jobs/avatar_frame_local_001
node dist/cli.js report jobs/avatar_frame_local_001
node dist/cli.js export jobs/avatar_frame_local_001
node dist/cli.js package jobs/avatar_frame_local_001
```

可对任意本地 SVGA 头像框运行生产规范检查：

```bash
node dist/cli.js inspect-avatar-frame path/to/avatar-frame.svga
```

命令输出 JSON，包含资产摘要、`avatar-frame-production` 检查结果、
结构化 issues 和仍需产品校准的文件体积/资源数量说明。检查不通过时
退出码为 `1`，但仍会输出完整报告。

当前 MVP SVGA exporter 只支持 image layer、keyframes、zIndex、alpha、x/y、scale、rotation 和 anchor transform；暂不支持 mask、text、audio、shape、nested composition 或复杂编辑能力。

`package` 会验证交付必需文件，创建默认 `output/acceptance.json`，并生成：

```text
jobs/avatar_frame_local_001/output/delivery.zip
```

ZIP 内保留 job 相对路径。必需文件为 `.svga`、report、svga-map、project、motion-plan、config 和 structure；推荐包含 WebM、MP4、preview-report、generated PNG 和 requirement。`preview.gif` 是可选 fallback，不再是打包前置条件；逐帧 PNG 默认不进入 ZIP。

验收状态可以通过 CLI 更新：

```bash
node dist/cli.js accept jobs/avatar_frame_local_001
node dist/cli.js reject jobs/avatar_frame_local_001 --notes "需要调整扫光节奏"
```

命令会更新：

```text
output/acceptance.json
output/report.json
```

完整输出包括：

```text
output/preview.gif
output/preview_frames/
output/preview.webm
output/preview.mp4
output/avatar_frame_local_001.svga
output/report.json
output/svga-map.json
output/delivery.zip
output/acceptance.json
```

本阶段内置 5 个语义模板：

- `wing_flap`
- `gem_twinkle`
- `metal_sweep`
- `frame_breath`
- `pop_settle`，仅定义，不默认启用

基础测试：

```bash
pnpm test:mvp
```

或：

```bash
./node_modules/.bin/tsc -p tsconfig.json
node --test dist/tests/mvp-planner.test.js
```

## CLI

```bash
pnpm dev plan jobs/avatar_frame_local_001
pnpm dev init my_avatar_frame
pnpm dev validate examples/avatar_frame_basic
pnpm dev build examples/avatar_frame_basic
pnpm dev preview examples/avatar_frame_basic
pnpm dev export examples/avatar_frame_basic
```

构建后也可以使用：

```bash
node dist/cli.js build examples/avatar_frame_basic
node dist/cli.js export examples/avatar_frame_basic
```

## Real SVGA Playback Verification

生成 `.svga` 后，应优先使用真实 Web Player 做播放验证，而不是只依赖 zlib inflate 或 protobuf decode。

先生成示例输出：

```bash
pnpm build:example
pnpm export:example
```

启动本地播放器验证页：

```bash
pnpm local:preview
```

该命令会检查本地 preview 服务是否已启动；未启动时会启动服务并打开浏览器。手动回退方式仍然保留：

```bash
pnpm preview:player
```

打开：

```text
http://localhost:4173/tools/svga-player-preview/
```

页面默认进入 `本地预览 / Local Preview`，优先显示一个大尺寸 SVGA 播放窗口。播放器脚本来自 jsDelivr CDN；`.svga`、参考视频和 report 通过本地 dev server 访问，不能直接用 `file://` 打开页面。

Web 播放验证页的信息架构：

- 顶层模式只有 `本地预览 / Local Preview` 和 `导出验收 / Export Review`
- `Compare` 是 Local Preview 下的开关，不是第三个顶层模式
- `SVGA 信息 / SVGA Info` 只包含 `概览 / Overview` 和 `资源 / Assets`
- `图层 / Layers` 和 `图片资源 / Images` 已合并为 `资源 / Assets`
- `运行日志 / Runtime Logs` 是独立右侧 panel，可与 SVGA 信息 panel 同时打开
- 文件选择按钮属于对应预览卡片
- 显示模式属于对应预览卡片
- 播放控件属于对应预览卡片
- 同步控件只影响双窗口共同状态

也可以通过 job 相对路径直接进入导出验收：

```text
http://127.0.0.1:4173/tools/svga-player-preview/?job=jobs/avatar_frame_local_001
```

页面会自动读取该 job 的 `output/report.json`、`output/svga-map.json` 和导出 `.svga`。辅助预览按 `preview.webm`、`preview.mp4`、`preview.gif` 的顺序加载；WebM 实际解码失败时也会继续尝试 MP4。右侧视频支持原生 controls 和页面同步控制。GIF 只作为 fallback，缺失单个辅助预览不会影响真实 SVGA 播放。

导出验收模式下，左侧显示导出的 SVGA，右侧显示参考视频，优先使用 MP4 或 WebM。GIF 仍可作为本地调试 fallback，但不作为线上交付资源。

播放器尺寸来自真实 SVGA viewBox，而不是由页面容器强行决定。工具会优先从 SVGA Web Player 的 `videoItem` 读取尺寸；如果播放器 API 没暴露尺寸，会 inflate `.svga` 并读取 protobuf `MovieEntity.params.viewBoxWidth/viewBoxHeight`。页面按 `aspectRatio = viewBoxWidth / viewBoxHeight` 计算播放器显示尺寸，默认使用 `Fit contain`，也可以切换到 `Original size` 或 `Fit width`。

如果画面被压扁，优先检查：

- `.svga` 中的 `viewBoxWidth` / `viewBoxHeight` 是否正确
- 播放器 canvas 的 CSS 是否强制设置了不同比例的 width/height
- GIF 或 canvas 是否缺少 `object-fit: contain` 或等价的比例约束

对比时看这些点：

- 是否能自动加载并循环播放真实 `.svga`
- replay 按钮是否能重新播放
- 外圈呼吸光的节奏是否一致
- 金属扫光的方向、速度和层级是否接近
- 宝石闪烁的位置、延迟和透明度变化是否接近
- 画布尺寸、内容居中、裁切和透明背景是否正常
- 下方 report 中的 `fileSizeBytes`、`imageCount`、`spriteCount`、`frameCount`、`fps`、`durationSeconds`、`exporterReady`、`svgaExport.success` 是否符合预期

真实 `.svga` 能 inflate、decode 或加载并不等于视觉验收成功。仍需在 Web 播放器中人工确认主体叠加、翼尖幅度、宝石 glint、扫光范围、透明边缘和循环接缝。

不要使用 GIF 判断最终视觉效果是否达标。`preview.gif` 仅用于 fallback、快速浏览和文档展示；线上交付与主验收以真实 `.svga` 及其 Web 播放结果为准。

## Input Contract

每个输入目录至少包含：

```text
asset.config.json
assets/frame.png
```

`asset.config.json` 描述资产、画布和启用的模板。schema 位于 `schemas/asset.config.schema.json`。

`canvas.width`、`canvas.height`、`fps` 和 `durationMs` 都来自配置。模板和生成逻辑不应硬编码 256x256。gem glint 点位也来自配置：

```json
{
  "gemGlints": [
    { "id": "top", "x": 165, "y": 20, "delayFrame": 0 },
    { "id": "right", "x": 194, "y": 137, "delayFrame": 19 },
    { "id": "left", "x": 27, "y": 155, "delayFrame": 37 }
  ]
}
```

如果 `gemGlints` 为空，`gem_twinkle` 不生成 glint layer，并在 report 中给出 warning。

## Output Contract

`build` 会生成：

```text
output/
  project.json
  svga-map.json
  report.json
  preview.gif
  assets/
    frame.png
    outer_glow.png
    sweep_core.png
    sweep_soft.png
    sweep_core_masked.png
    sweep_soft_masked.png
    gem_glint.png
```

`project.json` 是 exporter-ready 中间工程协议，schema 位于 `schemas/project.schema.json`。顶层结构为：

```text
version
projectId
assetType
canvas
fps
durationFrames
loop
assets
layers
animations
export
```

时间轴统一使用 `frame`。`timeMs` 不作为 keyframe 主字段。

模板会在 build 阶段展开成标准 image layers 和 keyframes。后续 exporter 不需要理解 `breathing_glow`、`metal_edge_sweep`、`gem_twinkle` 的语义，只需要读取：

- `assets`
- `layers`
- `animations`

当前会输出这些固定头像框图层：

- `frame_base`
- `outer_glow`
- `sweep_core`
- `sweep_soft`
- `gem_glint_top`
- `gem_glint_right`
- `gem_glint_left`

第三轮协议增强：

- canvas 尺寸完全配置化
- `metal_edge_sweep` 改为位移式 Light Sweep：rotation 固定，x 从画布一侧移动到另一侧
- gem glint 点位配置化
- sweep 图层增加 `mask` 协议字段，表达使用 `frame_base` alpha 作为遮罩
- `report.json` 增加 `exporterCompatibility`
- `svga-map.json` 增加未来 SVGA sprites/keyframes 映射预览

第四轮协议冻结：

- 坐标语义冻结：`transform.x/y` 是图层锚点在画布坐标系中的位置，`anchor.x/y` 是图层本地锚点，rotation/scale 围绕 anchor 发生
- `frame_base` 和所有当前 sprite 的 `replaceable` 均为 `false`
- sweep masked asset 预烘焙：`sweep_core_masked.png`、`sweep_soft_masked.png`
- 非 normal blendMode 均带 `fallbackBlendMode` 和 `fallbackOpacityMultiplier`
- 默认示例循环为 72 frames / 24 fps / 3 seconds
- 新增 exporter contract 文档：[docs/exporter-contract.md](docs/exporter-contract.md)
- 新增最小 SVGA exporter adapter 边界：[docs/svga-packaging-strategy.md](docs/svga-packaging-strategy.md)

当前 MVP 不新增 `avatar_slot`。如果未来要支持用户头像动态替换，应新增 `avatar_slot` 或 `user_avatar` 作为 replaceable sprite，而不是把 `frame_base` 标记为 replaceable。

## Templates

模板定义位于 `templates/avatar_frame/`：

- `breathing_glow.template.json`：外圈轻微呼吸光，适合作为低频氛围层
- `metal_edge_sweep.template.json`：金属边缘扫光，适合表现高端材质
- `gem_twinkle.template.json`：宝石局部闪烁，适合少量点状高光

当前模板文件使用 JSON，并通过 `description`、`notes`、`parameters[].description` 字段承载注释说明，避免 JSON 注释带来的解析问题。

## Architecture

```text
src/
  cli.ts
  commands/
  core/
    asset-loader.ts
    generated-assets.ts
    project-builder.ts
    report-builder.ts
    svga-map-builder.ts
    template-engine.ts
    validator.ts
  exporters/
    exporter.ts
    index.ts
    json-exporter.ts
    svga-exporter.stub.ts
  preview/
    gif-encoder.ts
    preview-renderer.ts
  types/
  utils/
```

模块边界刻意保持简单：

- asset loader 只负责读取输入素材和基础 PNG 信息
- validator 负责配置、素材和模板约束
- template engine 负责把模板展开为标准 image layers 和 frame-based keyframes
- project builder 负责组装标准化 `project.json`
- json exporter 负责输出中间协议
- preview renderer 负责按 `project.json` 的 layers、animations、keyframes 逐帧渲染 GIF
- svga map builder 负责生成未来 exporter 可参考的 sprites/keyframes 映射文件

## Real SVGA Exporter Integration

当前已经提供 `src/exporters/`：

```text
src/exporters/
  exporter.ts
  index.ts
  json-exporter.ts
  svga-exporter.stub.ts
```

建议先定义统一接口：

```ts
export interface Exporter {
  export(project: AvatarFrameProject, outputDir: string): Promise<ExportResult>;
}
```

当前 `project.json` 就是 exporter 的输入协议。接入真实 SVGA exporter 时，优先保持模板系统不变，只替换输出阶段：

1. 将 project layers 映射为 SVGA sprites
2. 将 keyframes 映射为 transform、alpha、mask 或 shape animation
3. 将 copied assets 转为 SVGA image resources
4. 在 `build` 命令中增加 `--exporter json|svga`
5. 为 exporter 增加快照测试，避免模板关键帧回归

## Export Command

```bash
pnpm export:example
node dist/cli.js export examples/avatar_frame_basic
```

当前 `svga-exporter.ts` 使用 `protobufjs` 和 Node.js `zlib` 生成最小真实 `.svga` 文件。proto 文件位于 [proto/svga.proto](proto/svga.proto)，基于官方 `svga/SVGA-Format` 仓库的 [`proto/svga.proto`](https://raw.githubusercontent.com/svga/SVGA-Format/master/proto/svga.proto)，用于编码 SVGA 2.x `MovieEntity`。

当前 exporter 支持：

- `output/svga-map.json`
- `output/assets/`
- `sprites[].exportAssetPath`
- `zIndex`
- `transform.x / y`
- `scaleX / scaleY`
- `rotation`
- `opacity`
- `keyframes`
- `fps`
- `durationFrames`
- `MovieEntity.version`
- `MovieEntity.params`
- `MovieEntity.images`
- `MovieEntity.sprites[].imageKey`
- `MovieEntity.sprites[].frames[].alpha/layout/transform`

当前不支持：

- 复杂 runtime mask
- 文本
- 动态头像替换
- 复杂 shape
- 音频
- 让 exporter 理解模板语义
- 非线性 easing；当前导出时线性化

export 命令会把结果写入 `report.json.svgaExport`。`exporterReady` 表示中间工程已准备好接 exporter；`svgaExport.success` 才表示真实 `.svga` 是否成功输出。两者不要混淆。

可用 SVGA player 验证输出，例如 Web 侧 SVGA parser/player 加载 `output/avatar_frame_basic.svga`。本项目 export 后也会做基础校验：文件存在、zlib inflate、protobuf decode、检查 params/images/sprites。

### Frame-level imageKey

[proto/svga.proto](proto/svga.proto) 中 `SpriteEntity` 包含 `imageKey`，但 `FrameEntity` 不包含 `imageKey`。因此标准 SVGA proto 不支持单个 sprite 逐帧切换图片；`imageKey` 是 sprite 级字段。

当前 baked sweep 不能通过“一个 sprite 每帧切换多张图片”来实现。为了保持标准 SVGA 兼容性，本项目继续使用多 sprite baked frame 方案，或未来评估标准 runtime mask / `matteKey`、`clipPath`、减少 baked frame 数量等方案。不要向 `FrameEntity` 写入不存在的 `imageKey` 字段，也不要自定义 proto 来规避这个限制。

### Baked sweep frameStride

`asset.config.json` 支持配置 baked sweep 采样：

```json
{
  "bakedSweep": {
    "enabled": true,
    "frameStride": 2,
    "skipTransparentFrames": true,
    "dedupeIdenticalFrames": true
  }
}
```

`frameStride` 是视觉流畅度和文件体积之间的无损输入采样取舍：

- `1` = 最高质量，每一帧采样，体积最大
- `2` = 推荐默认，每 2 帧采样一次，体积和流畅度平衡
- `3` = 更小体积，每 3 帧采样一次，可能出现轻微跳帧感

可以用 CLI 临时覆盖配置做本地对比：

```bash
node dist/cli.js export examples/avatar_frame_basic --sweep-stride 1
node dist/cli.js export examples/avatar_frame_basic --sweep-stride 2
node dist/cli.js export examples/avatar_frame_basic --sweep-stride 3
```

该策略仍然使用标准 SVGA 多 sprite baked frame 方案，不写 frame-level `imageKey`，不自定义 proto。

## Notes

这个 MVP 有意不实现复杂粒子、重型滤镜、真实材质模拟和可视化编辑器。头像框动画的第一版应保持克制：稳定循环、少量高光、低噪声、轻文件体积。
