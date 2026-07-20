# Role-aware Transparent-padding Calibration

Date: 2026-06-19

## Decision

1. Keep `maxTransparentPaddingRatio = 0.5` provisional.
2. Keep the role-aware policy advisory; do not migrate it into the production gate.
3. Keep static-image diagnostics explicit at the current threshold.
4. Keep sequence-frame diagnostics grouped. The cohort supports group-level
   review and does not support per-frame production failure.
5. Do not calibrate `baked_sweep_frame`, `mask_or_matte`, or `unknown` behavior
   from this cohort because no resources were classified into those roles.

## Sample Labels and Confidence

- Cohort: 21 user-provided avatar-frame groups, each with one SVGA and one
  reference PNG. `assetType = avatar_frame` has high label confidence.
- Delivery status: historical catalog / compatibility evidence, not an approved
  production-delivery cohort. Confidence is medium because no per-sample
  production approval label was supplied.
- Resource roles: deterministic classifier output, not human visual labels.
  Sequence/static role confidence is medium; effect intent is not proven.
- Visual waste labels: unavailable. This calibration cannot calculate policy
  precision or false-positive rate against human review.

The external assets remained read-only and were not added to Git. Eighteen
samples use a `300 x 300` canvas and three use `240 x 240`. Eleven samples
contain detected sequence resources; nine have sequence resources representing
at least half of their embedded images.

## Method

Each unique SVGA was processed through the existing production composition:

```text
AvatarFrameInspectionReportService
  -> SvgaFormatAdapter
  -> FastPngAlphaAnalyzer
  -> resource role classification
  -> sequence residency diagnostics
  -> role-aware transparent-padding policy
```

The calibration script now reports alpha status and ratio statistics per role,
policy severity and uncertainty distributions, and sequence-group padding
distributions. Temporary JSON output was written outside the repository.

```bash
npm run build
node scripts/calibrate-avatar-frame-alpha-bounds.mjs <external-sample.svga> ...
```

## Resource-role Results

| Role | Resources | Known | Unknown | Fully transparent | Min | Max | Average | Median | Over 50% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `static_image` | 827 | 824 | 0 | 0 | 0.000000 | 0.672848 | 0.059742 | 0.010000 | 2 |
| `sequence_frame` | 784 | 784 | 0 | 0 | 0.000000 | 0.993647 | 0.318336 | 0.265573 | 170 |
| `baked_sweep_frame` | 0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a | 0 |
| `mask_or_matte` | 0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a | 0 |
| `unknown` | 0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a | 0 |

Three static resources were `opaqueOnly`; they are included as measured zero
padding in ratio statistics. No resource had unavailable alpha metadata.

## Policy Diagnostics

| Role | Diagnostics | Error | Warning | Advisory | Info | Unknown |
|---|---:|---:|---:|---:|---:|---:|
| `static_image` | 2 | 2 | 0 | 0 | 0 | 0 |
| `sequence_frame` | 14 | 0 | 5 | 9 | 0 | 0 |
| Other roles | 0 | 0 | 0 | 0 | 0 | 0 |

Uncertainty distribution:

- `low`: 2 static diagnostics.
- `medium`: 14 inferred sequence-group diagnostics.
- `high`: 0.

The two static resources over 50% were:

1. `累计登录头像框3 / img_2103118028`: `500 x 500`, ratio `0.672848`.
2. `酷鹅玫影头像框 / img_2103125977`: `40 x 40`, ratio `0.518750`.

The first is strong evidence of oversized transparent padding. The second is
only 1.875 percentage points above the threshold and needs visual review before
being treated as a confirmed defect. With only two static exceptions and no
human defect labels, the cohort does not justify tightening or loosening 50%.

## Sequence-group Results

| Metric | Result |
|---|---:|
| Detected groups | 31 |
| Frames per group | 12 min / 48 max / 25.290323 average / 24 median |
| Group average padding | 0.000000 min / 0.777356 max / 0.317279 average / 0.333011 median |
| High-padding frame ratio | 0.000000 min / 0.950000 max / 0.212182 average / 0.000000 median |
| Majority-high warnings | 5 |
| Partial-high advisories | 9 |
| Groups without padding diagnostics | 17 |

The policy reduced 170 per-frame threshold exceptions to 14 group-level review
items. Five groups had more than half of measured frames above 50%; nine groups
had some high-padding frames but not a majority. This supports group-level
diagnostics and demonstrates why a per-frame production failure would be noisy.

The strongest majority-high groups were observed in `164181-伊斯兰新年`,
`月汐星珠头像框`, `海盗头像框1`, `玫瑰王子头像框`, and `黄金海盗头像框`.
These are classifier-derived groups; without visual alignment labels, high
padding may still preserve intentional full-canvas registration.

## Coverage Gaps and Misclassification Risk

- No resource was classified as baked sweep, mask/matte, or unknown. Those role
  policies remain uncalibrated rather than validated.
- Generic image keys such as `img_...` make sequence grouping dependent on
  numeric continuity and repeated dimensions. This is explainable but not a
  human effect-intent label.
- No fully transparent resource appears in this cohort, so role-specific fully
  transparent severity is covered by tests rather than sample evidence.
- Reference PNGs confirm the sample groups are avatar-frame assets but do not
  label individual embedded resources or alignment requirements.

No classifier change is made in this round. Future calibration needs manually
reviewed resource/group labels, especially for masks, baked sweeps, and
intentional canvas-aligned sequences.

## Client Readiness

The scan is deterministic, offline, and local. The reusable policy remains
host-neutral; only the calibration script uses Node filesystem APIs. A future
macOS or Windows client can run the same report composition behind its host
file boundary. No sample upload, network service, AI capability, dependency,
license, installer-size, privacy, or redistribution risk was added.
