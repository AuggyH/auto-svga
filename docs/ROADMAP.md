# Roadmap

Status: historical roadmap lineage. Do not use this file as the project PRD or
current product roadmap authority. The only project-level PRD authority is
`docs/product/PRODUCT_ROADMAP.md`.

## Product Positioning

Auto SVGA is a designer-facing SVGA export and acceptance workbench. It does
not replace the designer's creative judgment and is not a small After Effects.
Its job is to reduce uncertainty around format compatibility, production
specifications, resource cost, runtime risk, visual parity, safe refinement,
and delivery acceptance.

The early product should accept completed or near-completed result assets such
as SVGA, MP4, WebP, transparent PNG, frame sequences, and layered PNG packages.
Direct ingestion of Figma, PSD, After Effects, C4D, Blender, or other source
projects is not an early mainline goal.

See:

- `docs/product/auto-svga-product-principles.md`
- `docs/research/figma-svga-editor-competitor-research.md`
- `docs/product/auto-svga-backlog.md`

## Current: MVP 0.1 avatar_frame

- [x] Planning chain (config + structure → motion-plan → project.json)
- [x] 5 animation templates
- [x] Generated assets + image optimization (trimming, scaling)
- [x] Baked sweep mask system
- [x] Unified easing/interpolation
- [x] Preview pipeline (PNG frames + WebM + MP4 + GIF)
- [x] Report + svga-map generation
- [x] Real SVGA protobuf+zlib export
- [x] Delivery packaging
- [x] Acceptance workflow
- [x] Web playback validation tool
- [x] Agent collaboration docs + review process
- [x] Web preview rebuild: grouped latest artifacts, SVGA-first loading, readable panels
- [x] Unified dropdown, playback state, settings groups, and reduced motion
- [ ] WCAG AAA verification (axe, contrast, complete keyboard and resize checks)
- [ ] Full 1600/1440/1280/1024/900/768 visual matrix

## Next: MVP 0.2

- Visual tuning (wing phase, gem glint, breath glow)
- Sweep quality/stride evaluation
- Additional template parameters (easing curves, amplitude ranges)
- CI pipeline for automated build+test verification

## P1 Infrastructure: Multi-format workbench preparation

- [x] Audit current SVGA-specific parser, playback, export, and host coupling
- [x] Define host-neutral workbench contracts and capability maturity language
- [x] Record initial capability matrix for SVGA, VAP, Lottie, animated WebP, WebM, APNG, and sprite sequences
- [x] Record dependency, license, maintenance, and desktop redistribution risks
- [x] Wrap current SVGA inspection behind `FormatAdapter` without changing output
- [x] Integrate SVGA inspection into one non-UI application service
- [ ] Extract browser SVGA playback behind `PlaybackAdapter`
- [ ] Replace CDN runtime loading with an approved local bundle
- [x] Define versioned delivery specifications and deterministic checks
- [ ] Define sprite-sequence manifest and bounded frame cache
- [ ] Run separate Lottie, VAP, and desktop-host technical spikes

This track is infrastructure only. It does not expand the production asset
scope beyond `avatar_frame`, and it does not authorize new format dependencies
or conversion features.

## P2 Motion Asset Audit MVP

- [x] Inspection primitives: resource dimensions, alpha bounds, roles, memory,
  sequence residency, and deterministic duplicate/empty-frame evidence
- [x] Additive Motion Asset Audit summary
- [x] Read-only presentation contract
- [x] Localization key catalog and shared `en` / `zh-CN` bundle
- [x] Versioned serialization compatibility v1 and strict version negotiation
- [x] Web read-only Motion Asset Audit panel

The production gate remains the avatar-frame specification result. Audit status
and opportunities are advisory and cannot trigger repair, conversion, export,
or optimization actions.

Not included in this milestone: a format recommendation engine, automatic
optimization, one-click repair, export workbench, desktop client, complex audit
UI, or additional motion formats.

## Product Phases

### Phase 1: Export acceptance and diagnostics

This is the active product direction:

- SVGA parsing and playback
- SVGA/reference-media comparison
- asset, imageKey, resource, sprite, and sequence visibility
- sweep, glow, ray, and particle semantic grouping
- production specification checks
- file-size, decoded-memory, and performance-risk diagnostics
- delivery acceptance reports and explainable evidence

Phase 1 remains read-only or advisory unless an existing production gate
explicitly says otherwise.

### Phase 2: Safe post-export refinement

Only after Phase 1 is reliable:

- replaceable image/imageKey preview
- additive sweep, glow, and lightweight particle layers
- blend-mode preview with target-runtime compatibility checks
- animation parameter copy, batch apply, and mirrored apply
- non-destructive changes with before/after comparison and rollback

Prefer additive, reversible edits. Do not rewrite original transforms or
animation structure without explicit evidence and recovery.

### Phase 3: Semi-automatic motion generation

Long-term only:

- consume prepared layered assets
- recommend bounded motion treatments
- generate basic motion and optional sweep/glow/particle enhancements
- evaluate resource and runtime cost before export

This phase is not MVP authorization for a universal timeline, source-project
import platform, complete particle editor, or cross-tool production suite.

## Roadmap Principle: Inspection Primitives First

Auto SVGA should make stable, reusable inspection primitives reliable before
building higher-level product features. Current P1/P2 work should prioritize:

1. format recognition and parsing
2. normalized `MotionAssetInfo`
3. file size, dimensions, FPS, frame count, and duration
4. embedded resource metadata and image dimensions
5. `alphaBounds` and `transparentPaddingRatio`
6. resource role classification
7. versioned spec profiles and role-aware policies
8. decoded memory estimation and resource-level diagnostics
9. stable report output contracts

Higher-level features must be composed from those primitives:

- Motion Asset Audit
- Performance Audit
- Format Recommendation Engine
- Optimization Suggestions
- Export Preflight
- Batch Inspection
- Legacy Asset Cleanup
- Multi-format Comparison

Do not implement these as isolated one-off UI logic. Their evidence should come
from deterministic local metadata and rules: parsed metadata, resource
dimensions, alpha statistics, decoded memory estimates, timing, resource
counts, file size, roles, profile thresholds, and the format capability matrix.

Do not use AI, external models, multimodal models, or network services to
replace deterministic inspection, performance analysis, format decisions, or
optimization recommendations. Any separately approved generative capability
must remain outside this inspection foundation.

## Future Phases

- Additional asset types: medal, title, bubble
- Safe post-export editor for bounded, reversible changes
- Runtime mask support in SVGA export
- Composition/precomp support

## Anti-Drift Gate

Before accepting an editing feature, classify it as export acceptance,
post-export refinement, or full motion authoring. MVP work may prioritize the
first two only. Complete timelines, complex keyframe curves, full particle
editors, and multi-source authoring belong to long-term planning.

Before accepting a new input format, check whether it expands Auto SVGA into a
general production platform. Early work should consume result files from
Figma, PSD, After Effects, C4D, Blender, and AI-assisted workflows rather than
their original project formats.
