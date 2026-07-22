# Auto SVGA Product Backlog

This backlog records product candidates, not committed delivery dates. Items
must still pass mainline, evidence, dependency, and client-readiness review.
Committed mid-term scope lives in `docs/product/PRODUCT_ROADMAP.md`; this file
is a candidate pool and must not override that PRD.
The Owner-approved AE to Auto SVGA production bridge is no longer a backlog
candidate. Its committed scope lives in `docs/product/PRODUCT_ROADMAP.md` and
its subordinate brief is `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`.

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
- [ ] accept Asset Pack + Motion Plan as the headless engine input contract
- [ ] integrate the separately delivered ComfyUI MVP through an explicit
  local/LAN/self-hosted endpoint contract
- [ ] prove the first Agent-first avatar-frame vertical through generated SVGA,
  validation, optimization, desktop preview, and human acceptance

### Product discovery

- [ ] define what LTR and RTL identify in the requested conversion workflow
- [ ] decide source/target formats, direction/mirroring semantics, BiDi/font
  behavior, batch interaction, preview/diff, output naming, and rollback
- [ ] assign a version and requirement ticket only after that discovery closes

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

- direct PSD, Sketch, C4D, Blender, or unbounded source-project import
- arbitrary Figma document import or live Figma editing; the controlled
  FBP/Figma Bridge package path is an existing bounded exception
- direct After Effects source-project import outside the Owner-approved
  `AE_BRIDGE_PRODUCT_BRIEF.md` package/scanner/bake pipeline
- universal layer and composition authoring
- complete timeline and advanced keyframe-curve editor
- complete particle authoring system
- broad multi-format production editor beyond the versioned PAG preview and
  VAP generation requirements in the product roadmap
- automatic optimization or destructive repair without evidence and rollback
- Agent/ComfyUI implementation before the separately developed ComfyUI MVP is
  handed off and the roadmap's engine-readiness, privacy, runtime, and package
  gates are satisfied
