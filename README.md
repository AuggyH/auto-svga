# Auto_SVGA

Exporter-ready intermediate protocol MVP

一个用于自动化生成“头像框”类型 SVGA 动效工程的最小可行项目。当前版本优先建设可稳定接入真实 SVGA exporter 的中间工程协议，输出 `project.json`、`svga-map.json`、真实 generated assets、由协议驱动的 `preview.gif`、`report.json` 和真实 `.svga` 文件。

## Scope

- 资产类型：仅支持 `avatar_frame`
- 输入：透明背景 PNG 头像框素材 + `asset.config.json`
- 输出：`project.json`、`svga-map.json`、真实生成后的 assets、`preview.gif`、`report.json`、`avatar_frame_basic.svga`
- 模板：`breathing_glow`、`metal_edge_sweep`、`gem_twinkle`
- 技术栈：TypeScript + Node.js + pnpm

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

## CLI

```bash
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
pnpm preview:player
```

打开：

```text
http://localhost:4173/tools/svga-player-preview/
```

页面会自动加载：

```text
examples/avatar_frame_basic/output/preview.gif
examples/avatar_frame_basic/output/avatar_frame_basic.svga
examples/avatar_frame_basic/output/report.json
```

页面左侧是 `preview.gif`，右侧是公开 SVGA Web Player 包 `svgaplayerweb@2.3.1` 播放的真实 `.svga`。播放器脚本来自 jsDelivr CDN；`.svga`、GIF 和 report 通过本地 dev server 访问，不能直接用 `file://` 打开页面。

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

当前 `report.json.playbackTest` 会记录播放验证要求，但不会伪造视觉成功。如果工具能加载真实 `.svga`，仍需要人工目视确认 `preview.gif` 与真实 SVGA 播放是否一致。

`preview.gif` 仅用于本地调试和视觉对比，不作为线上交付资源。线上交付应以真实 `.svga` 及其播放验证结果为准。

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
