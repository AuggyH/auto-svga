# Auto SVGA Product Backlog

This backlog records product candidates, not committed delivery dates. Items
must still pass mainline, evidence, dependency, and client-readiness review.
Committed mid-term scope lives in `docs/product/PRODUCT_ROADMAP.md`; this file
is a candidate pool and must not override that PRD.

## Roadmap

### Phase 1: Export acceptance and diagnostics

Priority candidates:

- [ ] aggregate baked sweep resources into semantic groups
- [ ] distinguish outer glow, inner glow, bloom, aura, rim glow, shiny ray,
  metal highlight, and gem highlight
- [ ] detect and summarize particle sprite reuse, frame coverage, sprite
  expansion, and estimated resource/runtime cost
- [ ] extend asset visibility with thumbnail, imageKey, dimensions, bytes,
  usage count, sprite count, frame range, replaceability, and effect group
- [ ] strengthen imageKey replacement reliability checks
- [ ] expand SVGA/reference-media comparison evidence
- [ ] keep production acceptance report aligned with audit evidence

### Phase 2: Safe post-export refinement

- [ ] define blend-mode capability and target-runtime compatibility matrix
- [ ] preview preserve/warn/bake/degrade/block outcomes for blend modes
- [ ] preview replaceable image and imageKey changes
- [ ] add bounded sweep, glow, ray, or particle layers without rewriting source
  transforms
- [ ] copy and paste effect parameters
- [ ] batch and mirrored parameter application for symmetric parts
- [ ] provide exact numeric controls, recommended/risk ranges, reset, and
  before/after comparison
- [ ] make every modification reversible and acceptance-report visible

### Phase 3: Long-term generation research

- [ ] consume prepared layered-result packages
- [ ] recommend bounded motion treatments from deterministic structure metadata
- [ ] generate basic motion and optional enhancements
- [ ] evaluate file size, resource count, memory, and compatibility before export

## Backlog By Capability

### Blend modes

Research Normal, Screen, Add, Lighten, Overlay, Soft Light, and Multiply as a
shared effect primitive. Do not bind blend support only to sweep.

### Particles

Near-term: recognition, grouping, reuse statistics, transform/alpha analysis,
sprite expansion, and performance diagnostics.

Mid-term: non-invasive presets for stardust, coin glints, gem sparkles, magic
dust, and confetti with count, size, speed, direction, life, and alpha.

Long-term: size/alpha/color over life, glow, trails, multiple emitters,
turbulence, attraction, and complex paths. A Particular-class editor is not an
MVP objective.

### Sweep and light semantics

- group masked sweep sequences and preserve target-layer linkage
- distinguish necessary canvas alignment from transparent waste
- classify glow/ray/highlight intent before suggesting optimization
- expose baking costs and target-runtime compatibility

### Editing ergonomics

- parameter copy/paste and effect-specific paste
- mirrored application for left/right structures
- presets, batch application, ratio locks, exact numbers, steps, reset, and
  modification comparison

## Explicitly Deferred

- direct Figma, PSD, Sketch, After Effects, C4D, or Blender project import
- universal layer and composition authoring
- complete timeline and advanced keyframe-curve editor
- complete particle authoring system
- broad multi-format production editor
- automatic optimization or destructive repair without evidence and rollback
- AI or external-model analysis without a separately approved capability module
