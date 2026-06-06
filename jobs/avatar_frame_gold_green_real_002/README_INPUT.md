# auto-svga 输入资料（重构版）

这是基于当前头像框源图重新整理的一套更适合 auto-svga 动效生产的分层输入。

## 设计原则
- 提供完整 `base_frame_full` 作为稳定主体，确保拼合完整；
- 只拆出真正适合微动的顶部外侧翼尖；
- 侧翼、底翼改为 glow-only，避免不自然扇动；
- 宝石核心从徽章金属底座中拆出，便于 `gem_twinkle` 生效；
- 输入同时包含 `layerMode`，兼容 full-canvas 与 cropped 两类层。

## 推荐执行顺序
```bash
node dist/cli.js plan jobs/avatar_frame_gold_green_real_002
node dist/cli.js preview jobs/avatar_frame_gold_green_real_002
node dist/cli.js report jobs/avatar_frame_gold_green_real_002
node dist/cli.js export jobs/avatar_frame_gold_green_real_002
node dist/cli.js package jobs/avatar_frame_gold_green_real_002
```

## 注意
- `01_base_frame_full.png` 是 full-canvas layer；
- 其余图层均为 cropped layers；
- 如果当前 auto-svga 还未支持 `layerMode`，请优先为输入链路补充该字段的读取逻辑：
  - full_canvas: x=0, y=0, localAnchor=anchor
  - cropped: x=bbox[0], y=bbox[1], localAnchor=anchor-bbox.xy
