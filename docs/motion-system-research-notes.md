# Motion System Research Notes

这份文档记录外部成熟动画系统对 auto-svga 的工程启发。目标是指导头像框模板库演进，不是引入大型动画运行时，也不是把当前 MVP 扩展成通用编辑器。

## 思路来源类型

- 时间曲线与补间系统：GSAP、CSS easing 一类时间函数设计。
- Alpha mask 与 compositing：SVG mask 一类逐像素约束模型。
- Anchor 与关节运动：Spine transform constraint、local/world transform 一类 rigging 思路。
- Timeline 与运行状态：Rive state machine 的时间推进和状态分层思路。
- 结构化动画格式：Lottie 的语义规划、工程展开、资源映射和交付报告分层。

不在这里维护大量外部链接；重点是这些思路如何落到当前 TypeScript、project.json 和 SVGA exporter 链路。

## Easing 与 Interpolation

### 工程启发

时间感是基础设施，不应由每个模板各自实现插值。PreviewRenderer 和 SVGAExporter 如果使用不同补间算法，辅助预览与真实播放会产生不可接受的漂移。

### 当前立即实现

- `src/mvp/easing.ts` 统一 easing 函数。
- `src/mvp/interpolation.ts` 统一属性插值。
- PreviewRenderer 与 SVGAExporter 共用同一入口。
- 支持 `linear`、Sine、Quad 和可选 `easeOutBack`。
- keyframe 未指定 easing 时使用 `linear`。
- 未知 easing 记录 warning 并回退到 `linear`。

### 后续预留

- cubic-bezier 参数。
- steps。
- 每属性 easing。
- 曲线可视化和模板参数校验。

### 暂时不做

- 引入 GSAP 等完整运行时。
- Web 动画编辑器。
- 任意用户脚本曲线。

## Mask 与 Compositing

### 工程启发

Mask 是 compositing 阶段的 alpha 或 luminance 约束。已经 mask 完成的整张画布不能继续作为普通移动图片，否则 mask 会跟随图片移动，产生白膜、残片和错误覆盖。

### 当前立即实现

- moving sweep position。
- base frame alpha mask。
- safeArea exclusion。
- per-frame compositing。
- 输出 `generated/sweep_baked/sweep_###.png`。
- 每张 baked PNG 先按 alpha bbox 裁切，并通过 layer x/y 恢复画布位置。
- balanced 默认每 3 帧采样一次；透明帧、低贡献帧跳过，完全相同帧按 hash 复用。
- report 和 svga-map 记录 mask source、frame index 和 baked mode。

### 后续预留

- 专用 metal mask 或 base_underlay mask。
- feather、padding 和多 mask 合成。
- 更动态的内存预算降级和 effect resolution scale。
- exporter 支持可靠 runtime matte 时切换策略。

### 暂时不做

- 移动已经 mask 的 full-canvas 图片。
- 自定义非标准 SVGA proto。
- 为 mask 引入大型图形库。

## Anchor 与 Rigging

### 工程启发

翅膀等具有关节感的部件必须在明确的 local anchor 周围运动。auto-svga 暂不做 mesh deformation，但必须保持 canvas anchor 到 local anchor 的稳定转换。

### 当前立即实现

- `anchor.role = root_joint`。
- `anchor.space = canvas`。
- project layer 保存 `anchor.localX / localY`。
- Preview 与 Exporter 围绕同一 local anchor 旋转。
- wing motionProfile 支持 `amplitudeDeg`、`phase`、`easing` 和 `mode`。
- 当前真实素材 job 使用 `flap`，峰峰值约 `15°`，左右翼可配置 phase。

### 后续预留

- `soft_sway` 和 `flap` 参数曲线。
- 父子关节与 transform constraints。
- 左右部件更明确的 phase 编排。

### 暂时不做

- 骨骼蒙皮。
- mesh deformation。
- 权重绘制工具。

## Timeline 与 State

### 工程启发

当前系统应保持 timeline + keyframes 的确定性。复杂 state machine 会显著扩大协议、预览和导出边界。

### 当前立即实现

- 按 frame 推进 timeline。
- 插值基础 transform 与 alpha 属性。
- 保持 loop 的首尾关键帧可验证。

### 后续预留

- motionState。
- entry、loop、settle 三阶段语义。
- motion-plan 层区分入场、循环和收束动画。

### 暂时不做

- 运行时交互状态机。
- 条件图和事件系统。

## Structured Animation Format

### 工程启发

不同文件承担不同职责，避免模板语义、工程图层、SVGA 映射和交付验收混成一个不可维护对象。

### 当前分层

- `motion-plan.json`：语义动效方案。
- `project.json`：可渲染、可导出的具体图层与 keyframes。
- `svga-map.json`：project layer、图片资源、sprite/imageKey 和 mask 追踪。
- `preview-report.json`：辅助预览产物与编码状态。
- `report.json`：交付摘要、警告和人工验收边界。

### 后续预留

- composition / precomp。
- 更稳定的模板参数 schema。
- 调试资源和正式交付资源分层。

### 暂时不做

- 将所有职责压入 project.json。
- 让 exporter 理解 `wing_flap`、`metal_sweep` 等模板语义。
- 通用动画编辑器协议。
