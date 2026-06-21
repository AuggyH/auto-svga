# P6 Web Feature Inventory

Date: 2026-06-22
Baseline commit: `d16fb380c0ff82b9aca3af58b0335708e0b0ef73`

This inventory is the required Web surface for P6 Desktop parity. Desktop may differ only in approved host behavior.

## Required Regions

- `shell`: main product shell
- `toolbar`: product toolbar
- `brand`: product identity
- `modeControl`: local preview / export review mode selector
- `actionRow`: info, logs, theme, settings controls
- `workspace`: preview workspace
- `svgaPanelA`: primary SVGA card
- `svgaPanelB`: comparison SVGA card
- `referencePanel`: reference media card
- `playerBarA`: primary player controls
- `playerBarB`: comparison player controls
- `referencePlayerBar`: reference playback controls
- `syncBar`: synchronized review controls
- `infoPanel`: inspection side panel
- `logsPanel`: runtime logs side panel
- `settingsModal`: settings modal
- `assetPreviewModal`: asset preview modal
- `reportGrid`: report summary and details
- `errorBox`: visible error surface
- `floatingRoot`: overlays and floating UI

## Required Features

- local SVGA file select
- local SVGA drag/drop
- optional SVGA comparison
- secondary SVGA file select
- secondary SVGA drag/drop
- reference media select
- reference media drag/drop
- local preview mode
- export review mode
- latest artifact scan and load
- SVGA play/pause
- SVGA replay
- SVGA progress range
- loop toggle
- fit menu: contain
- fit menu: original size
- fit menu: fit width
- synchronized review playback
- synchronized replay
- inspection overview
- asset/resource details
- runtime logs
- copy logs
- clear logs
- settings modal
- theme toggle
- reduced motion setting
- reduced blur setting
- status announcements
- invalid/error state
- responsive narrow layout
- keyboard Escape modal close
- keyboard Space synchronized playback toggle

## Required Interactions

- click mode dropdown trigger -> menu opens
- select export review mode -> latest artifact loads
- open info panel -> overview visible
- switch info panel tab -> assets visible
- switch diagnostics to runtime logs
- open settings modal
- enable reduce motion and reduce blur toggles
- Escape closes settings before side panel
- Space toggles synchronized playback in export review
- enable local compare switch

## Required States

- local empty
- mode menu open
- export review loaded
- info overview open
- info assets open
- logs open
- settings open
- accessibility toggles on
- settings closed by Escape
- synchronized playback toggled by Space
- local compare empty
- responsive export review loaded at `900 x 720`

## Required Motion

CSS keyframes captured from the running baseline:

- `cardEnter`
- `emptyIconFloat`
- `fitMenuIn`
- `sidePanelEnter`
- `tabIn`
- `overlayIn`
- `modalIn`
- `drawerIn`
- `dropdownIn`

Reduced-motion CSS is present and must be preserved.

## Required Source Files

- `tools/svga-player-preview/index.html`
- `tools/svga-player-preview/styles.css`
- `tools/svga-player-preview/main.js`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/server.mjs`
- `tools/shared/product-tokens.css`

## Explicit Non-parity Surface

P3-P5 editor incubation features are preserved but excluded from P6 Web parity required counts unless they are visible in the Web Preview baseline.
