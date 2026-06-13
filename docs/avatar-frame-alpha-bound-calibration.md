# Avatar-frame Alpha-bound Calibration

Date: 2026-06-13

## Decision

- Keep `maxTransparentPaddingRatio` at `0.5`.
- Keep `maxTransparentPaddingRatio` in `needsProductCalibration`.
- Do not treat this sample set as a final product standard.

This initial repository-only baseline has since been supplemented by 21
external real avatar-frame samples. See
`docs/avatar-frame-21-sample-calibration.md`. The larger cohort supports
role-aware analysis but still does not justify changing the global threshold.

Only two available samples use the current `300 x 300` production canvas, and
their distributions differ sharply. One contains canvas-sized baked frames
with substantial transparent bounds; the other has full-canvas alpha bounds
for every resource. More representative deliveries are required before
changing the threshold.

## Method

The analysis uses the production host composition:

```text
SvgaFormatAdapter
  -> FastPngAlphaAnalyzer
  -> MotionAssetInspectionService
  -> MotionAssetInfo.resources[].alphaBounds
```

Run the reproducible report with:

```bash
npm run build
node scripts/calibrate-avatar-frame-alpha-bounds.mjs \
  examples/avatar_frame_basic/output/avatar_frame_basic.svga \
  jobs/avatar_frame_gold_green_real_002/output/avatar_frame_gold_green_real_002.svga \
  jobs/avatar_frame_gold_green_real_002/output/delivery/output/avatar_frame_gold_green_real_002.svga \
  outputs/output/avatar_frame_basic.svga
```

Inputs are deduplicated by SHA-256. All four discovered files contain unique
bytes. `ratioStats` includes `known` resources and treats `opaqueOnly` as zero;
it excludes `fullyTransparent`, `unknown`, and `unsupported` resources.

`transparentPaddingRatio` measures unused area outside the non-zero-alpha
bounding rectangle. It is not the ratio of every transparent pixel inside that
rectangle.

## Aggregate

| Metric | Result |
|---|---:|
| Unique SVGA samples | 4 |
| Embedded image resources | 140 |
| `known` | 122 |
| `fullyTransparent` | 18 |
| `opaqueOnly` | 0 |
| `unknown` | 0 |
| `unsupported` | 0 |
| Measured ratio minimum | 0.000000 |
| Measured ratio maximum | 0.999300 |
| Measured ratio average | 0.463189 |
| Measured ratio median | 0.562256 |
| Resources over 50% | 77 |

## Per-sample Results

| Sample | Canvas | FPS / duration | Resources | Known | Fully transparent | Opaque only | Unknown | Unsupported | Min | Max | Average | Median | Over 50% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `examples/avatar_frame_basic/output/avatar_frame_basic.svga` | 300 x 300 | 24 / 3000 ms | 28 | 28 | 0 | 0 | 0 | 0 | 0.084789 | 0.999300 | 0.698134 | 0.724000 | 25 |
| `jobs/avatar_frame_gold_green_real_002/output/avatar_frame_gold_green_real_002.svga` | 300 x 300 | 30 / 2400 ms | 25 | 25 | 0 | 0 | 0 | 0 | 0.000000 | 0.000000 | 0.000000 | 0.000000 | 0 |
| `jobs/avatar_frame_gold_green_real_002/output/delivery/output/avatar_frame_gold_green_real_002.svga` | 600 x 600 | 30 / 2400 ms | 14 | 14 | 0 | 0 | 0 | 0 | 0.000000 | 0.587533 | 0.058499 | 0.000000 | 1 |
| `outputs/output/avatar_frame_basic.svga` | 256 x 256 | 24 / 3000 ms | 73 | 55 | 18 | 0 | 0 | 0 | 0.084091 | 0.995361 | 0.657133 | 0.612457 | 51 |

The `600 x 600` and `256 x 256` files are historical evidence only and do not
define the current production threshold.

## Resources Over 50%

- `examples/avatar_frame_basic/output/avatar_frame_basic.svga`:
  `img_2` through `img_26`, inclusive.
- `jobs/avatar_frame_gold_green_real_002/output/avatar_frame_gold_green_real_002.svga`:
  none.
- `jobs/avatar_frame_gold_green_real_002/output/delivery/output/avatar_frame_gold_green_real_002.svga`:
  `img_sweep_light_masked`.
- `outputs/output/avatar_frame_basic.svga`:
  `img_11` through `img_36`, `img_46` through `img_64`, and `img_66` through
  `img_71`, inclusive.

## Fully Transparent Resources

- Current `300 x 300` samples: none.
- Historical `600 x 600` sample: none.
- Historical `256 x 256` sample:
  `img_2` through `img_10` and `img_37` through `img_45`, inclusive.

## Interpretation

1. The 50% warning catches real canvas-sized sequence-frame padding and the
   historical fully transparent frame problem.
2. The two current samples are not representative enough to determine whether
   50% is too strict or too loose across avatar-frame styles.
3. A ratio of zero only means the alpha bounds touch every canvas edge; it does
   not prove that the texture has no transparent pixels inside the bounds.
4. Keep the current warning provisional until at least 10 production
   deliveries cover static, glow-heavy, and baked-sequence-heavy frames.

## Client Readiness

The calibration script is a Node host utility. Core decoding and alpha metadata
remain behind `EmbeddedImageAlphaAnalyzer`, so a future macOS or Windows
desktop host can reuse the same inspection service. The analysis is offline,
uses local bytes only, adds no dependency, and does not upload user assets.
