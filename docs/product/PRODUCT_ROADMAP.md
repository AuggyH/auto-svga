# Auto SVGA Product Roadmap

Date: 2026-06-22
Owner reset: P5 product acceptance is deferred. P6 becomes the active product mainline.

## Current Mainline

Auto SVGA now prioritizes Web Preview parity in a macOS internal desktop app before adding more editing capability.

The running Web Preview at the frozen P6 baseline is the source of truth for:

- product functionality
- UI structure
- copy and visible states
- interactions
- player controls
- inspection report display
- Motion Asset Audit display
- responsive behavior
- UI motion

Electron must reuse the shared product frontend rather than maintain an imitation page.

## Phase 1: Web Preview Full Desktopization

Goal: ship an unsigned, unnotarized macOS internal `.app` that opens directly from Finder and matches the current Web Preview product surface.

Scope:

- shared Web/Electron product frontend
- WebHostAdapter and ElectronHostAdapter
- local-only desktop runtime
- Finder file open and drag/drop
- SVGA playback
- inspection report
- Motion Asset Audit read-only panel
- parity evidence for features, regions, interactions, states, and motion
- browser workflow preserved as rollback

Non-goals:

- new editor features
- format conversion
- export workbench
- automatic optimization
- cloud, account, sync, telemetry
- production signing, notarization, installer, or public release

## Phase 2: SVGA Asset Detection And Optimization

Goal: analyze SVGA assets and suggest deterministic optimization opportunities.

Planned capabilities:

- resource inventory
- imageKey and Sprite/layer/resource reference checks
- sequence group detection
- unreferenced resource detection
- oversized resource detection
- transparent padding diagnostics
- blank or near-empty resource evidence
- duplicate byte/pixel/mirror evidence
- decoded memory and file-size ranking
- before/after visual and size comparison
- safe manual-confirm optimization paths
- Save As and reopened validation

This phase must not start until P6 is accepted.

## Phase 3: imageKey And Replaceable Element Editing

Goal: reconnect P3-P5 editor incubation into the product after Web/Desktop parity is accepted.

Planned capabilities:

- imageKey view, rename, conflict detection, and reference update
- local or URL image replacement with realtime preview
- text replacement only within actual format support
- Undo/Redo
- Save As
- round-trip validation
- multi-resource mapping and review

P3-P5 work remains valuable technical reserve, but it is not part of the default P6 product surface.

## Phase 4: Sequence-frame Anti-flicker Optimization

Goal: detect and repair sequence frame flicker, ghosting, adjacent overlap, and redundant transparency.

Planned capabilities:

- sequence group frame analysis
- visible target frame evidence
- controlled crossfade or stepped key state repair
- group-level crop with offset preservation
- duplicate and empty frame review
- before/after preview
- Undo/Redo
- re-export validation

## Mid-term Direction

Auto SVGA evolves toward a multi-format motion acceptance and conversion workbench. Each format adapter should eventually expose:

- Decode
- Preview
- Inspect
- Validate
- Optimize
- Replace
- Convert
- Export

## Long-term Direction

Longer term, Auto SVGA may provide a local deterministic engine for agent-assisted motion generation pipelines. Generative AI, ComfyUI, or external model modules require separate explicit approval and must stay isolated from the core deterministic pipeline.
