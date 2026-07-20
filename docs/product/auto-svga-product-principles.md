# Auto SVGA Product Principles

## Product Positioning

Auto SVGA is the designer's SVGA export and acceptance workbench.

It does not take over visual direction or replace motion designers. It turns
SVGA format constraints, target-device constraints, resource risks,
performance risks, and production specifications into visible, explainable,
and actionable evidence before delivery.

Short form:

> Auto SVGA is not a small After Effects. It is a workbench for pre-release
> SVGA acceptance, performance diagnosis, and safe optimization.

Core value:

- make SVGA structure readable
- make visual output comparable
- make resource and performance cost diagnosable
- make compatibility failures locatable
- make refinements reversible
- make production acceptance deliverable

## Design Principles

1. **Designer authority**: visual quality, creative direction, and effect intent
   remain the designer's decisions.
2. **Guardrails, not authorship**: provide diagnostics, compatibility checks,
   optimization opportunities, playback comparison, safe refinement, and
   acceptance reports.
3. **Post-production first**: initially receive completed or near-completed
   motion results rather than becoming a source-design application.
4. **Inspection primitives first**: build stable metadata and deterministic
   checks before productizing higher-level audit or recommendation features.
5. **Evidence before action**: every warning or suggestion must cite measurable
   file, resource, timing, memory, role, or format evidence.
6. **Non-destructive by default**: preserve original animation structure and
   transforms; support comparison and rollback for every refinement.
7. **Local and explainable**: ordinary inspection, performance analysis, format
   decisions, and optimization use local deterministic rules, not external AI.

## Input Boundary

Early accepted asset sources should be result-oriented:

- `.svga`
- MP4 or WebM reference video
- animated WebP or APNG reference output
- transparent PNG
- frame sequences
- layered PNG packages

Figma, PSD, Sketch, After Effects, C4D, Blender, and AI-assisted pipelines are
important upstream sources, but early Auto SVGA work should consume their
exported results. Direct source-project ingestion would require a much larger
authoring, layer, timeline, and export platform.

## Editing Boundary

Classify every proposed editing feature before implementation:

1. **Export acceptance**: parse, play, compare, inspect, diagnose, and report.
2. **Post-export refinement**: bounded additive effects, replacement preview,
   compatibility-safe fixes, rollback, and before/after comparison.
3. **Full motion authoring**: general timeline, complex curves, broad source
   imports, full particle systems, and arbitrary composition editing.

MVP may prioritize export acceptance and bounded post-export refinement. Full
motion authoring is long-term only and requires a separate product decision.

## Engineering Constraints

- Keep parsing, playback, diagnostics, recommendations, and export independent.
- Keep business rules out of Web UI components.
- Do not claim target-format or target-runtime support without evidence.
- Treat blend mode as a cross-effect capability, not a sweep-only property.
- For unsupported blend/effect semantics, distinguish preserve, warn, bake,
  degrade, and block; always expose size or quality costs.
- Group semantic resources such as sweeps and frame sequences instead of
  flattening hundreds of images into an unusable asset list.
- Keep macOS/Windows, offline use, local paths, privacy, licenses, and package
  size visible in architecture decisions.

## Anti-Drift Rules

- Do not reproduce the Figma SVGA Editor feature-for-feature.
- Do not turn Auto SVGA into a universal motion-production suite.
- Do not let visual UI work outrun parsing, inspection, evidence, and report
  contracts.
- Do not add direct Figma/PSD/AE/C4D/Blender project ingestion without a
  separate scope decision.
- Do not promote complete timelines, complex keyframe curves, full particle
  editors, or multi-format source authoring into the short-term mainline.
- Do not use historical or competitor outputs to silently weaken production
  specifications.
