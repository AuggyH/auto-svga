# Avatar-frame 21-sample Calibration

Date: 2026-06-13

## Source

- 21 user-provided avatar-frame groups.
- Every group contains one `.svga` and one reference `.png`.
- All 21 SVGA files have unique SHA-256 hashes.
- Source archive SHA-256:
  `61e070a303d350afd7ddc12adec7ca26c00cec5c3705b418965e9003d1b1b93b`.
- Samples remain external and read-only; no production asset is committed.

## Decision

1. Keep `maxTransparentPaddingRatio = 0.5` provisional.
2. Do not change the current production preset from this cohort alone.
3. Use resource roles before proposing any role-specific padding policy.
4. Keep `needsProductCalibration` because the cohort describes existing
   material, not an approved future production target.

The strongest result is not a new global threshold. It is evidence that
sequence frames and static images have materially different padding
distributions.

## Cohort Summary

| Metric | Result |
|---|---:|
| Unique SVGA samples | 21 |
| SVGA embedded image resources | 1,611 |
| `known` alpha bounds | 1,608 |
| `opaqueOnly` | 3 |
| `fullyTransparent` | 0 |
| `unknown` / `unsupported` | 0 |
| Resources over 50% padding | 172 |
| Aggregate padding minimum | 0.000000 |
| Aggregate padding maximum | 0.993647 |
| Aggregate padding average | 0.185588 |
| Aggregate padding median | 0.106978 |

Canvas distribution:

- `300 x 300`: 18 samples.
- `240 x 240`: 3 samples.

Reference PNG distribution:

- `300 x 300`: 18 files.
- `500 x 500`: 3 files paired with the `240 x 240` SVGA samples.
- PNG size range: 85,590 to 415,875 bytes.

## Resource-role Distribution

| Role | Resources | Average padding | Median padding | Over 50% |
|---|---:|---:|---:|---:|
| `static_image` | 827 | 0.059742 | 0.010000 | 2 |
| `sequence_frame` | 784 | 0.318336 | 0.265573 | 170 |
| `baked_sweep_frame` | 0 | n/a | n/a | 0 |
| `mask_or_matte` | 0 | n/a | n/a | 0 |
| `unknown` | 0 | n/a | n/a | 0 |

Of the 172 resources above 50%, 170 are classified as sequence frames. A
single global padding gate therefore carries a much higher false-positive risk
for sequence resources than for static images.

No sample exposes strong embedded naming or `matteKey` evidence for
`baked_sweep_frame` or `mask_or_matte`. Their absence is an evidence limitation,
not proof that the visual effects are absent.

## Per-sample Alpha Summary

| Sample | Canvas | FPS | Duration | Resources | Static | Sequence | Median padding | Over 50% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `164181-伊斯兰新年` | 240 | 30 | 2000 ms | 56 | 35 | 21 | 0.000000 | 15 |
| `28451-伊斯兰新年头像框1` | 240 | 30 | 2000 ms | 54 | 24 | 30 | 0.086052 | 0 |
| `28452-伊斯兰新年头像框2` | 240 | 30 | 2000 ms | 58 | 58 | 0 | 0.000000 | 0 |
| `任务头像框1` | 300 | 30 | 4000 ms | 125 | 15 | 110 | 0.156875 | 18 |
| `圣域君临头像框1` | 300 | 30 | 4000 ms | 49 | 25 | 24 | 0.047059 | 0 |
| `战狼头像框` | 300 | 30 | 3000 ms | 90 | 90 | 0 | 0.097511 | 0 |
| `月汐星珠头像框` | 300 | 30 | 4000 ms | 56 | 20 | 36 | 0.172125 | 20 |
| `海盗头像框1` | 300 | 30 | 4000 ms | 61 | 12 | 49 | 0.425244 | 20 |
| `猛虎头像框` | 300 | 30 | 3000 ms | 90 | 90 | 0 | 0.132011 | 0 |
| `玫瑰王子头像框` | 300 | 20 | 4000 ms | 128 | 35 | 93 | 0.238200 | 23 |
| `累计登录头像框3` | 300 | 20 | 4000 ms | 13 | 13 | 0 | 0.000000 | 1 |
| `红金龙争虎斗头像框2` | 300 | 15 | 2000 ms | 30 | 30 | 0 | 0.009978 | 0 |
| `老虎头饰` | 300 | 30 | 2533 ms | 38 | 38 | 0 | 0.081667 | 0 |
| `蓝色豪车头像框` | 300 | 30 | 2000 ms | 60 | 60 | 0 | 0.016600 | 0 |
| `贵族头像框7` | 300 | 20 | 4000 ms | 210 | 22 | 188 | 0.015406 | 18 |
| `酷鹅玫影头像框` | 300 | 20 | 4000 ms | 27 | 27 | 0 | 0.000000 | 1 |
| `金奢玫瑰` | 300 | 20 | 3000 ms | 72 | 72 | 0 | 0.000000 | 0 |
| `金焰藏宝箱头像框` | 300 | 30 | 4000 ms | 35 | 16 | 19 | 0.020000 | 6 |
| `雄鹰头像框` | 300 | 30 | 3000 ms | 90 | 90 | 0 | 0.193000 | 0 |
| `黄金海盗头像框` | 300 | 20 | 4000 ms | 131 | 25 | 106 | 0.363294 | 38 |
| `龙头像框` | 300 | 20 | 4000 ms | 138 | 30 | 108 | 0.134598 | 12 |

## Existing-material Distribution vs Production Preset

This section describes mismatch only. It does not recommend relaxing the
production preset.

| Current preset field | Samples above limit |
|---|---:|
| 512 KiB file size | 12 / 21 |
| 32 resources | 18 / 21 |
| 300 x 300 maximum canvas | 0 / 21 |
| 24 FPS | 13 / 21 |
| 3000 ms duration | 11 / 21 |
| Passed all current limits | 0 / 21 |

Observed cohort medians:

- file size: 549,220 bytes;
- resource count: 60;
- FPS: 30;
- duration: 4000 ms.

Existing asset distribution and desired production standards answer different
questions. Product owners still need to decide whether the preset is an
optimization target for new deliveries, a compatibility gate for legacy
assets, or separate profiles for both.

## Recommendation

Before changing pass/fail:

1. Keep 50% as a provisional global warning.
2. Consider a stricter static-image recommendation because only 2 of 827 static
   resources exceed 50%.
3. Evaluate sequence frames as groups, including alignment purpose, frame
   continuity, dimensions, and total texture cost.
4. Do not exempt all sequence frames automatically.
5. Define separate `production_target` and `legacy_compatibility` profiles if
   existing catalog acceptance is required.

## Reproduction

Build first, then pass the external `.svga` paths to:

```bash
node scripts/calibrate-avatar-frame-alpha-bounds.mjs <sample-1.svga> ...
```

The script outputs structured JSON with alpha status, role counts, per-role
statistics, threshold exceptions, and SHA-256 deduplication.

## Client Readiness

The analysis is offline and local. The reusable classifier and analyzer remain
host-neutral; only the calibration script owns Node filesystem access. No new
dependency, upload, AI service, platform-specific path, or native tool is
required.
