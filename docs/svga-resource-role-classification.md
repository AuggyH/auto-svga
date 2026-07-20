# SVGA Embedded Resource Role Classification

Date: 2026-06-13

## Purpose

Avatar-frame resources do not all have the same alignment requirements.
Ordinary cropped textures, full-canvas sequence frames, baked sweep frames, and
mask/matte resources should not eventually share one transparent-padding
policy. This classification adds metadata only; it does not change the current
50% threshold or pass/fail behavior.

## Roles

- `static_image`: referenced by a sprite with no stronger role evidence.
- `sequence_frame`: part of a same-prefix, same-dimensions, continuous numbered
  segment containing at least three resources.
- `baked_sweep_frame`: the image key contains sweep semantics plus baked,
  masked, core, soft, light, or a numeric frame suffix.
- `mask_or_matte`: referenced through `matteKey` or contains an explicit
  `mask`/`matte` name token.
- `unknown`: unreferenced or insufficient evidence.

Each resource stores the role in `MotionResourceInfo.role` and an explainable
`metadata.roleEvidence` list.

## Precedence

1. Actual `matteKey` reference.
2. Explicit mask or matte naming token.
3. Baked sweep naming evidence.
4. Continuous sequence evidence.
5. Ordinary sprite reference.
6. Unknown.

The order prevents a numbered matte or baked sweep from being reduced to a
generic sequence frame.

## Conservative Boundaries

- Sequence detection requires at least three continuous numeric suffixes after
  sorting, so ascending and descending source order both work.
- Sequence members must have identical known dimensions.
- Generic numeric keys are not enough when dimensions are unavailable.
- Approximate visual similarity is not used.
- Classification does not read `svga-map.json`; it operates only on portable
  metadata available from the SVGA itself.

## Current Sample Audit

| Sample | Static | Sequence | Baked sweep | Mask/matte | Unknown |
|---|---:|---:|---:|---:|---:|
| Current basic 300 x 300 | 2 | 26 | 0 | 0 | 0 |
| Current gold/green 300 x 300 | 13 | 0 | 12 | 0 | 0 |
| Historical gold/green 600 x 600 | 13 | 0 | 1 | 0 | 0 |
| Historical basic 256 x 256 | 1 | 72 | 0 | 0 | 0 |

The basic exporter uses generic numbered image keys, so those frames can be
recognized as a sequence but cannot be truthfully labeled as baked sweep
without stronger embedded metadata.

## Follow-up

Future transparent-padding policy can evaluate role-specific evidence, for
example:

- keep strict cropping guidance for `static_image`;
- distinguish intentional full-canvas alignment for `sequence_frame`;
- evaluate `baked_sweep_frame` as a group rather than isolated frames;
- treat `mask_or_matte` according to matte alignment requirements;
- keep `unknown` advisory until evidence improves.

That policy is deliberately not implemented in this task.

## Client Readiness

The classifier is host-neutral TypeScript. It depends only on decoded SVGA
metadata and image dimensions, not Node, DOM, Canvas, filesystem, browser APIs,
AI, or network services. It can be reused unchanged by macOS and Windows
desktop hosts.
