# SVGA Packaging Strategy

This repository now includes `src/exporters/svga-exporter.ts` and produces a minimal protobuf + zlib `.svga` file. The local [proto/svga.proto](../proto/svga.proto) is based on the official [`svga/SVGA-Format` proto](https://raw.githubusercontent.com/svga/SVGA-Format/master/proto/svga.proto).

The adapter currently:

- reads `output/project.json`
- reads `output/svga-map.json`
- verifies schema version `0.4.0`
- verifies timeline consistency
- verifies each sprite has `exportAssetPath`
- verifies referenced assets exist under `output/assets/`
- loads `proto/svga.proto`
- builds a `MovieEntity`
- encodes protobuf with `protobufjs`
- compresses with Node.js `zlib.deflateSync`
- writes `output/avatar_frame_basic.svga`
- validates by inflate + protobuf decode

## Current Input Mapping

The exporter must use `svga-map.json` only:

- `sprites[].exportAssetPath`
- `sprites[].zIndex`
- `sprites[].transform`
- `sprites[].keyframes`
- `sprites[].blendMode`
- `sprites[].fallbackBlendMode`
- `sprites[].fallbackOpacityMultiplier`
- `sprites[].bakedMaskAssetPath`

## Proto Mapping

The current minimal mapping is:

- `MovieEntity.version`: `"2.0"`
- `MovieEntity.params.viewBoxWidth`: `svga-map.canvas.width`
- `MovieEntity.params.viewBoxHeight`: `svga-map.canvas.height`
- `MovieEntity.params.fps`: `svga-map.fps`
- `MovieEntity.params.frames`: `svga-map.durationFrames`
- `MovieEntity.images`: map of stable short image keys to PNG binary data
- `MovieEntity.sprites[].imageKey`: stable image key for `exportAssetPath`
- `MovieEntity.sprites[].frames`: one frame entity for each project frame
- `FrameEntity.alpha`: interpolated opacity, multiplied by fallback opacity
- `FrameEntity.layout`: `{ x: 0, y: 0, width, height }`
- `FrameEntity.transform`: affine matrix converted from anchor-based transform

It must not branch on template IDs or template semantics.

## Why frame-level imageKey is not supported

The local [proto/svga.proto](../proto/svga.proto) confirms the field ownership:

- `SpriteEntity` contains `string imageKey = 1`
- `FrameEntity` contains `alpha`, `layout`, `transform`, `clipPath`, and `shapes`
- `FrameEntity` does not contain `imageKey`

Therefore, standard SVGA proto does not support switching `imageKey` per frame inside a single sprite. `imageKey` is a sprite-level field, not a frame-level field.

This means the baked sweep sequence cannot be represented as one sprite that changes to a different image on each frame. The exporter must not write an `imageKey` field into `FrameEntity`, must not customize `proto/svga.proto`, and must not optimize file size in a way that breaks standard SVGA compatibility.

Current compatible options are:

- multi-sprite baked frame strategy, where each baked sweep frame is represented by a sprite and visibility is controlled by frame opacity
- runtime mask or `matteKey` strategy, if implemented with standard SVGA player support
- `clipPath` strategy, if the visual shape can be represented accurately with standard clip paths
- reducing the number of baked sweep frames, while keeping visual correctness acceptable

The current project intentionally keeps the multi-sprite baked frame strategy because it is standards-compatible and does not require runtime mask support.

## Current Limitations

- Runtime mask is not exported; baked masked assets are used.
- `FrameEntity` has no `imageKey`; frame-level image switching is not supported by the standard proto.
- Text, dynamic avatar replacement, complex shapes, audio, matte layers, and clip paths are not exported.
- Easing is currently linearized.
- Blend modes are represented through fallback opacity because the minimal proto mapping does not carry blendMode.
