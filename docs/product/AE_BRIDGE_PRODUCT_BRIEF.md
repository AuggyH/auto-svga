# AE Bridge Product Brief

Date: 2026-07-03
Status: committed product mainline; subordinate to `PRODUCT_ROADMAP.md`
Authority: `docs/product/PRODUCT_ROADMAP.md`

## Purpose

This brief captures the Owner-approved AE to Auto SVGA production bridge.

The bridge lets designers continue authoring motion in After Effects, then send
the current composition to Auto SVGA for compatibility scanning, bake planning,
SVGA generation, preview, optimization, validation, and production handoff. It
is intended to solve current team production problems and reduce manual
SVGAConverter-specific preparation.

This document is not a second PRD. If it conflicts with
`docs/product/PRODUCT_ROADMAP.md`, the roadmap wins.

## Product Decision

The AE bridge is a must-do Auto SVGA capability.

It is higher near-term priority than ComfyUI, external AI, multimodal
generation, or agent-driven automatic design because it directly serves current
human designers and the team's existing production workflow.

It does not cancel the mid-term template-editing line. Mid-term work may
continue where it produces reusable foundations, but AE bridge delivery should
receive integration and planning priority when capacity conflicts arise.

## Problem

The current production path requires designers to understand which After Effects
features SVGA cannot represent, avoid unsupported effects while designing, or
pre-render unsupported areas manually before using SVGAConverter. This produces
friction, repeated export failures, oversized files, memory risk, and late
handoff loops.

Auto SVGA can own those decisions better than a manual exporter flow:

- identify unsupported AE features
- decide native conversion versus bake
- estimate file-size and decoded-memory risk
- protect replaceable elements
- optimize output
- validate SVGA bytes and preview before handoff

## Target Users

- Designers authoring motion in After Effects.
- Producers or reviewers checking whether an AE motion asset is SVGA-ready.
- Integrators who need a validated SVGA package instead of a black-box export.
- Product Owner and internal production team seeking shorter iteration cycles.

## Product Positioning

The bridge is not a mini After Effects and not an AI generation system.

After Effects remains the high-expressiveness creative tool. Auto SVGA becomes
the deterministic production export, inspection, optimization, and validation
tool. The bridge connects those two roles.

## Scope Summary

In scope:

- AE extension, script, or panel entry for `Export to Auto SVGA`.
- Local `ae-export-package` manifest and asset handoff.
- AE composition scanner and compatibility report.
- Bounded native conversion subset.
- Bake plan and AE-side transparent sequence rendering for unsupported but
  bakeable content.
- Auto SVGA import, preview, diagnostics, optimization, and real SVGA output.
- macOS/Windows and AE-version compatibility matrix.
- Failure-safe cleanup and source-project non-mutation.

Out of scope:

- Lossless conversion of arbitrary AE projects.
- Full timeline/keyframe editing inside Auto SVGA for human designers.
- Cloud, AI, ComfyUI, multimodal, or hosted model analysis.
- Uploading user projects, assets, bake frames, logs, or reports.
- Public plugin marketplace distribution before internal compatibility and
  signing/install strategy are validated.

## Architecture Direction

Keep the AE-side extension thin.

AE bridge responsibilities:

- launch from AE
- detect active composition
- scan composition/layer/property facts
- write a local export package
- execute bake instructions through temporary comps and render workflow
- return bake manifests and rendered assets
- preserve and clean up the source project

Auto SVGA responsibilities:

- import package
- normalize into internal package/animation IR
- decide native/bake/block/degrade/suggestion paths
- estimate file size and decoded memory
- protect replaceable keys
- encode real SVGA bytes
- validate inflate/decode/reopen/playback load
- show preview, diagnostics, optimization, comparison, and save flows

## Handoff Strategy

The baseline handoff is local file/folder exchange:

```text
ae-export-package/
  manifest.json
  environment.json
  comp.json
  layers.json
  assets/
  bake/
  reports/
```

Reasons:

- works better across old AE versions
- avoids firewall, local port, socket, and extension-permission problems
- supports offline teams
- is easy to inspect, retry, zip, redact, and attach to review evidence

Optional later handoffs:

- localhost HTTP
- WebSocket
- deep link into Auto SVGA
- app-to-app bridge

These are enhancements, not the MVP baseline.

## Foreground Coordination Boundary

AEB work may require foreground access to After Effects, Finder, Open/Save
dialogs, Render Queue, script dialogs, plugin panels, browser documentation,
or Auto SVGA preview handoff. These are shared macOS foreground resources and
must follow `docs/engineering/DESKTOP_CLIENT_COORDINATION_PROTOCOL.md`.

AEB workers must not steal focus from QA, UI/UX, short-term implementation, or
release packaging work. Prefer scriptable, package-based, non-foreground, or
second-display evidence when possible. When AE foreground control is required,
record the AE app path/version, PID/process identity when available,
composition/project context, window/dialog, display/workspace, clipboard use,
and foreground lease strategy in the review or handoff.

## Native Conversion Subset

The first native subset is intentionally small:

- composition width, height, FPS, duration, transparent background
- image/footage layers with exported image resources
- layer order
- anchor point
- position
- scale
- rotation
- opacity
- frame-based sampled transform values

The bridge may sample AE values per frame first, then later add curve fitting
or keyframe compression once visual risk is understood.

## Unsupported Feature Handling

Unsupported AE features must not silently become normal image layers.

Initial unsupported or risk features:

- effects and third-party plugins
- expressions
- 3D layers
- cameras and lights
- complex shape/path animation
- text animators
- track mattes
- adjustment layers
- complex masks
- particles
- blur, glow, distortion, displacement, and procedural effects
- time remap and nested timing that cannot be represented safely

Each unsupported feature must receive one of these outcomes:

- native supported
- bake required
- bake candidate
- degrade with warning
- blocked
- suggestion-only/manual-fix required

## Bake Planning

Bake planning is the primary realism layer between AE and SVGA.

Bakeable content may be rendered as transparent sequences through AE temporary
comps. Auto SVGA must decide whether to bake a single layer, precomp, or
candidate group.

Safe bake group requirements:

- no required replaceable element inside the group
- no native layer crossing the group in a way that would break z-order
- compatible time range
- acceptable bbox and transparent-padding cost
- acceptable empty-frame and duplicate-frame ratios
- expected output remains inside active production spec or clearly warns

Possible decisions:

- native conversion
- separate bake
- merged bake group
- ask designer to manually precompose
- block export

## Replaceable Element Protection

Designer-intended replaceable elements are production-critical.

The bridge must detect likely replaceable image/text keys and protect them from
accidental bake loss. If the user chooses to bake a replaceable element anyway,
the report must state that runtime replacement is lost or degraded.

## Compatibility Matrix

Compatibility claims must be evidence-based.

Recommended initial targets:

| Support tier | AE versions | OS target | Expected capability |
| --- | --- | --- | --- |
| Formal | AE 2024, AE 2025, AE 2026 | macOS and Windows | Extension/script launch, scan, package export, package import, native subset, bake MVP where supported. |
| Compatibility | AE 2020, AE 2021, AE 2022, AE 2023 | macOS and Windows | Basic script/package export, scanner, package import; panel UX and automatic bake may degrade. |
| Legacy best-effort | Earlier CC versions | Case-by-case | Thin script export only; no guarantee for automatic bake or modern panel. |

Every formal support cell needs proof for:

- launch from AE
- active comp detection
- manifest export
- asset export
- scanner report
- temporary bake comp creation
- transparent sequence output
- Auto SVGA package import
- Preview or clear failure state
- source project unchanged

## Product Workflow

1. Designer completes a motion asset in AE.
2. Designer opens Auto SVGA bridge and clicks `Export to Auto SVGA`.
3. Bridge scans the active comp and writes a local export package.
4. Auto SVGA opens the package and shows a compatibility report.
5. Auto SVGA recommends native conversion, bake, degrade, block, or manual fix.
6. If bake is needed, Auto SVGA emits bake instructions.
7. AE bridge renders transparent bake outputs and updates the package.
8. Auto SVGA imports native and baked content into its internal IR.
9. Auto SVGA generates preview, diagnostics, and optimization findings.
10. Auto SVGA writes real SVGA bytes only after validation.
11. Designer or reviewer uses Preview, Compare, Overwrite Save, or Save As.

## Work Packages

| Work package | Goal | Stop condition |
| --- | --- | --- |
| AEB-WP0 | Inventory team AE versions, OS versions, install constraints, and representative AE projects. | Compatibility matrix draft and sample set defined. |
| AEB-WP1 | Define `ae-export-package` schema and redacted manifest. | Schema fixture imports in Auto SVGA without AE. |
| AEB-WP2 | Build thin AE script prototype for scan and package export. | A real AE comp exports manifest/assets and leaves source unchanged. |
| AEB-WP3 | Auto SVGA package importer and compatibility report. | Package opens in Auto SVGA and produces native/bake/block findings. |
| AEB-WP4 | Native subset converter. | Supported image/transform comp produces validated SVGA and Preview handoff. |
| AEB-WP5 | Bake instruction and AE-side bake execution. | Unsupported bakeable layer renders transparent sequence and imports back. |
| AEB-WP6 | Bake planner and replaceable protection. | Safe/unsafe group decisions are evidence-backed and protect replaceable keys. |
| AEB-WP7 | Production optimization and save integration. | Bridge output uses short-term optimization, compare, Overwrite Save, and Save As paths. |
| AEB-WP8 | Cross-version installer/support strategy. | Formal/compatibility/legacy support claims match evidence. |

## Relationship To Mid-term Work

The mid-term template-editing line remains useful, especially for:

- SVGA parsing and normalization
- transform math
- preset easing and sampled animation
- compile reports
- preview handoff
- save-state proofs
- file-size and memory budget reporting
- sequence and baked asset diagnostics

However, AE bridge is the higher near-term product priority because it helps
human designers use their existing AE workflow today. Mid-term features should
not become blockers for bridge implementation unless they are direct
foundational dependencies.

## Relationship To AI / ComfyUI

The Product Owner has approved Agent + ComfyUI + Auto SVGA as a planned
long-term, Agent-first engine direction. It remains deferred relative to the AE
bridge and is not active implementation scope until the separately developed
ComfyUI MVP is handed into this repository and Auto SVGA reaches its matching
engine-readiness gate.

Reason:

- AE bridge solves an immediate production workflow.
- It keeps designers in their best creative tool.
- It is local, deterministic, and explainable.
- It produces validation artifacts and does not require model cost, uploads, or
  privacy review.

Later Agent modules should reuse the bridge's immutable package identities,
layer/asset facts, bake decisions, timebase, budgets, and validation records as
inputs to Asset Pack and Motion Plan. Desktop UI and Agent API remain separate
callers of a shared headless engine. Integration must stay isolated behind an
explicit local/LAN/self-hosted endpoint, privacy, lifecycle, and rollback
contract.

PAG export is also a later format-specific AEB lane. The shared bridge may own
preflight, source identity, scan facts, stage records, and bake outputs, while
the PAG adapter owns exporter selection, translation, serialization, runtime
validation, pixel/timing comparison, editability, and format-specific failure
handling. PAG preview support alone does not approve AEB-to-PAG export.

## Evidence And References

External research references:

- Adobe After Effects Developer page: `https://developer.adobe.com/after-effects/`
- Adobe scripts documentation: `https://helpx.adobe.com/after-effects/desktop/automate-in-after-effects/automate-animation/scripts.html`
- Adobe render/export documentation: `https://helpx.adobe.com/after-effects/desktop/render-and-export/basics-of-rendering-and-exporting/basics-rendering-exporting.html`
- Adobe CEP getting started: `https://github.com/Adobe-CEP/Getting-Started-guides`
- SVGA official proto: `https://github.com/svga/SVGA-Format/blob/master/proto/svga.proto`
- SVGA AEConverter repository: `https://github.com/svga/SVGA-AEConverter`

Internal references:

- `docs/product/PRODUCT_ROADMAP.md`
- `proto/svga.proto`
- `src/exporters/svga-exporter.ts`
- `docs/svga-packaging-strategy.md`
- `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
