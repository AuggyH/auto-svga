# Figma SVGA Editor Competitor Research

Date: 2026-06-19

Research type: public-page review and black-box analysis

Competitor: [SVGA Editor](https://www.figma.com/community/plugin/1648649590830419001/svga-editor)

## Competitor Research

The analysis used public plugin information, one exported `.svga`, and a full
interaction recording. It does not claim access to the plugin source or
internal implementation.

Observed sample:

| Metric | Value |
|---|---:|
| Container | zlib-compressed SVGA 2.0 protobuf |
| Canvas | 300 x 300 |
| FPS | 24 |
| Frames | 72 |
| Duration | 3 seconds |
| PNG resources | 185 |
| Sprites | 308 |
| Audio / shapes | 0 / 0 |

Approximate resource structure:

- about 11 base layers
- seven sweep groups with 24 masked PNGs each, about 168 PNGs total
- about four glow-ray resources expanded into about 69 sprites
- about two particle resources expanded into about 60 sprites

These counts describe one black-box sample, not a universal implementation
contract.

## Product Value Observed

The plugin compresses a traditional Figma/Sketch/Photoshop to After Effects to
SVGA pipeline into a lower-friction Figma workflow:

1. select Figma layers
2. synchronize layers into the plugin
3. configure basic motion, sweep, ray/glow, particles, or frame sequences
4. export SVGA or WebP

It validates a real designer need: lightweight SVGA production should require
less tool switching and less knowledge of After Effects and SVGA limitations.

## Capability and Limit Assessment

Observed or advertised coverage includes layer intake, asset management, basic
motion parameters, sweep, shiny-ray effects, particles, frame sequences,
project settings, and export.

Its likely value ceiling is different from Auto SVGA's intended mainline:

- limited motion and visual-effect ceiling
- no demonstrated advanced keyframe-curve workflow
- high baked-resource expansion in the inspected sample
- limited visible production-spec validation
- limited asset-size, decoded-memory, and runtime-risk diagnosis
- limited export acceptance and reference-media comparison

## Product Positioning Difference

The plugin primarily answers:

> How can a designer create and export a lightweight SVGA faster from Figma?

Auto SVGA should primarily answer:

> How can a designer understand, validate, compare, safely refine, and deliver
> an animation once the motion result or SVGA export exists?

Therefore Auto SVGA should not reproduce this plugin or become a small After
Effects. Its differentiation is structure visibility, production checks,
resource/performance diagnosis, issue localization, reversible refinement, and
delivery evidence.

## Capabilities Worth Learning From

### Blend modes

Blend modes should be a foundational effect capability for sweep, glow, rays,
particles, bloom, gem highlights, metal highlights, color overlays, and local
lighting. Future research should cover Normal, Screen, Add, Lighten, Overlay,
Soft Light, and Multiply.

Any export path must distinguish target support, partial-support risk, baking,
file-size growth, visual degradation, and blocking conditions.

### Particle semantics

Particle work should be staged:

1. detect particle sprites, texture reuse, frame coverage, transform/alpha
   curves, sprite expansion, and performance cost
2. later allow bounded additive particle presets without rewriting original
   animation structure
3. leave advanced lifecycle curves, trails, turbulence, multiple emitters, and
   Particular-class authoring for long-term evaluation

### Sweep grouping

Recognize baked names such as
`sweep_<time>_<id>_<layer>_masked_<frame>` and show one semantic sweep group
with target layer, frame count, byte size, playback range, loop state, risk,
and optimization evidence. Do not display hundreds of sweep PNGs as unrelated
images.

### Light-effect taxonomy

Do not collapse every light effect into `glow`. Keep distinct concepts for
outer glow, inner glow, bloom, aura, rim glow, shiny ray, metal highlight, and
gem highlight.

### Parameter reuse

Symmetric avatar frames benefit from copy, batch paste, mirrored paste,
effect-specific paste, and reusable presets. These are Phase 2 refinement
ideas, not current MVP commitments.

### Asset visibility and parameter controls

Future asset rows should expose thumbnail, imageKey, layer name, dimensions,
bytes, usage count, sprite count, frame range, replaceability, and semantic
effect group.

Future numeric controls should expose exact input, steps, recommended/risk
ranges, direction, reset, aspect lock, batch apply, and before/after state.

## Research Conclusion

The competitor proves demand for a shorter production path, but its features
should enter Auto SVGA only when they support export acceptance or safe
post-export refinement. Full Figma-first authoring, general timelines, and a
complete particle editor remain outside the short-term mainline.
