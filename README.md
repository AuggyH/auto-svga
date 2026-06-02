# Auto_SVGA

SVGA Avatar Frame MVP

一个用于自动化生成“头像框”类型 SVGA 动效工程的最小可行项目。当前版本聚焦工程结构、模板系统和 CLI 工作流，输出的是可被后续 exporter 消费的中间工程格式，不直接生成真实 `.svga` 二进制文件。

## Scope

- 资产类型：仅支持 `avatar_frame`
- 输入：透明背景 PNG 头像框素材 + `asset.config.json`
- 输出：`project.json`、生成后的 assets、`preview.gif`、`report.json`
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
```

构建后也可以使用：

```bash
node dist/cli.js build examples/avatar_frame_basic
```

## Input Contract

每个输入目录至少包含：

```text
asset.config.json
assets/frame.png
```

`asset.config.json` 描述资产、画布和启用的模板。schema 位于 `schemas/asset.config.schema.json`。

## Output Contract

`build` 会生成：

```text
output/
  project.json
  report.json
  preview.gif
  assets/
    frame.png
```

`project.json` 是中间工程格式，包含 layers、timeline、keyframes 和 template metadata。schema 位于 `schemas/project.schema.json`。

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
    project-builder.ts
    template-engine.ts
    validator.ts
  preview/
    gif-encoder.ts
    preview-renderer.ts
  types/
  utils/
```

模块边界刻意保持简单：

- asset loader 只负责读取输入素材和基础 PNG 信息
- validator 负责配置、素材和模板约束
- template engine 负责把模板参数转换为关键帧
- project builder 负责组装标准化 `project.json`
- preview renderer 负责输出轻量 GIF 预览

## Real SVGA Exporter Integration

下一阶段建议新增 `src/exporters/`：

```text
src/exporters/
  exporter.ts
  intermediate-exporter.ts
  svga-exporter.ts
```

建议先定义统一接口：

```ts
export interface Exporter {
  export(project: AvatarFrameProject, outputDir: string): Promise<ExportResult>;
}
```

当前 `project.json` 可以作为 exporter 的输入。接入真实 SVGA exporter 时，优先保持模板系统不变，只替换输出阶段：

1. 将 project layers 映射为 SVGA sprites
2. 将 keyframes 映射为 transform、alpha、mask 或 shape animation
3. 将 copied assets 转为 SVGA image resources
4. 在 `build` 命令中增加 `--exporter intermediate|svga`
5. 为 exporter 增加快照测试，避免模板关键帧回归

## Notes

这个 MVP 有意不实现复杂粒子、重型滤镜、真实材质模拟和可视化编辑器。头像框动画的第一版应保持克制：稳定循环、少量高光、低噪声、轻文件体积。
