# Avatar-frame Specification Calibration

Date: 2026-06-13

## Recommendation

- `maxFileSizeBytes`: `524,288` bytes (`512 KiB`)
- `maxResourceCount`: `32`
- Status: provisional; product calibration still required

The canvas, FPS, and duration limits remain unchanged at `300 x 300`, `24 FPS`,
and `3000 ms`.

## Repository Samples

Only unique SVGA bytes were counted. Delivery copies with the same content
would be deduplicated by SHA-256.

| Sample | Size | Resources | Canvas | FPS | Duration | Use |
|---|---:|---:|---:|---:|---:|---|
| `examples/avatar_frame_basic/output/avatar_frame_basic.svga` | 107,034 B | 28 | 300 x 300 | 24 | 3000 ms | production baseline |
| `jobs/avatar_frame_gold_green_real_002/output/avatar_frame_gold_green_real_002.svga` | 346,987 B | 25 | 300 x 300 | 30 | 2400 ms | size/resource calibration only; FPS exceeds production spec |
| historical delivery output | 931,514 B | 14 | 600 x 600 | 30 | 2400 ms | excluded from production threshold; violates canvas and FPS limits |

The repository also contains 56 observable generated/output PNG files totaling
465,972 bytes. The current 300x300 SVGA samples already include baked sweep
resources in their measured resource counts.

## Rationale

- `512 KiB` leaves about 51% headroom above the largest current 300x300 sample
  while rejecting the historical 600x600 output.
- `32` resources leaves four resources of headroom above the current maximum
  of 28 and is materially tighter than the previous placeholder of 64.
- Two valid-canvas samples are not enough to establish final product policy.
  `needsProductCalibration` therefore remains set for both fields.

Revisit the limits after collecting at least 10 representative production
deliveries across simple, medium, and baked-sequence-heavy avatar frames.
