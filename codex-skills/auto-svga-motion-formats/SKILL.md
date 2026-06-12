---
name: auto-svga-motion-formats
description: Auto SVGA 格式能力规则。涉及 SVGA、VAP、Lottie、WebP、WebM、APNG 或 Sprite 的识别、解析、播放、预览、替换、转换、导出和性能评估时使用；同时加载 auto-svga-core-guard。
---

# Auto SVGA Motion Formats

## Formats

- SVGA
- VAP
- Lottie
- animated WebP
- WebM
- APNG
- Sprite sequence or sprite sheet

## Capability Boundary

- SVGA, VAP, and Lottie: plan for real-time replacement and preview of avatars,
  nicknames, text, images, gift icons, badges, campaign art, colors, text
  styles, and layer visibility.
- WebP, WebM, APNG, and Sprite: prioritize playback, preview, metadata,
  specification checks, conversion, export, and performance evaluation.

## Core Abstractions

- `FormatAdapter`
- `MotionAssetInfo`
- `PlaybackAdapter`
- `ExportPipeline`
- `FrameSequenceIntermediate`

## Rules

1. Integrate one bounded format capability at a time.
2. Do not add a dependency before license, maintenance, size, offline, and
   redistribution review.
3. Do not present planned or partial capability as supported.
4. State semantic, visual, alpha, timing, and replaceability loss for conversion.
5. Regression-check current SVGA preview when adding a player or playback path.
6. Keep parsing, playback, conversion, and export independently replaceable.
