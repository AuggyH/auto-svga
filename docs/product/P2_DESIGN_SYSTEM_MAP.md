# P2 Design System Map

Date: 2026-06-20
Milestone: P2 — Desktop Product Shell And Web Preview Parity

## Token Source

Primary reference: `tools/svga-player-preview/styles.css`.

Electron should reuse the same visual vocabulary, translated into a desktop
shell with no new dependencies and no framework migration.

## Token Map

| Token family | Web reference | P2 desktop mapping |
| --- | --- | --- |
| Background | `--background`, `--backgroundGradient` | App window background and shell gradient |
| Surface | `--surface`, `--surfaceElevated`, `--floatingSurface` | App bar, player panel, inspector panel |
| Subtle surface | `--surfaceSubtle` | Metadata strip and low-priority status zones |
| Text primary | `--textPrimary` | Product title, panel headings, metadata values |
| Text secondary | `--textSecondary` | Descriptions, status text, metadata labels |
| Text tertiary | `--textTertiary` | Internal/prototype badge and debug details |
| Border | `--border`, `--borderStrong`, `--hairline` | Panels, stage edge, inspector separators |
| Accent | `--blue`, `--blue-2`, `--accent` | Primary file action, focused controls, active status |
| Status | `--green`, `--orange`, `--red` | Success, warning, error badges |
| Panel shadow | `--shadow-panel` | Major surfaces only; no nested decorative cards |

## Typography

| Level | Web reference | P2 desktop use |
| --- | --- | --- |
| Product name | `.brand strong` | App bar title: `Auto SVGA` |
| Secondary copy | `.brandCopy span` | `Desktop Preview` / internal status |
| Panel title | `.cardHeader h2`, `.infoHeader h2` | Player, inspector, report groups |
| Body | `--font-body` | Empty/loading/error descriptions |
| Metadata | `--font-meta` | File, size, canvas, FPS, duration |

No viewport-scaled font sizes. Letter spacing stays non-negative.

## Spacing And Radius

| Web reference | P2 desktop use |
| --- | --- |
| `--gap-tight: 6px` | Metadata and button internals |
| `--gap-body: 10px` | Control groups |
| `--gap-section: 14px` | Panel sections |
| Radius 8-16px | Buttons 8px, panels 12px, brand mark 14-16px |

## Components

| Component | Web reference | P2 rule |
| --- | --- | --- |
| App bar | `.toolbar` | Compact top bar, no full-width warning banner |
| Product mark | `.brandMark` | Keep blue mark style |
| Buttons | `.cardFileButton`, `.smallIconButton` | Icon + text when space allows; accessible labels required |
| Player stage | `.stage`, `.mediaFrame` | Framed central stage with visible empty/drop/loading states |
| Metadata | `.quickInfo` | Compact strip directly below controls |
| Inspector | `.infoPanel`, `.tabs` | Right-side panel at desktop width; below player when narrow |
| Status pill | `.statusPill`, `.badge` | Low visual weight state indicators |
| Error | `.isError`, red status | Productized main message plus collapsible technical detail |

## Responsive Breakpoints

1. `>= 1280px`: two-column desktop shell with right inspector.
2. `< 1180px`: inspector stacks below workspace; no horizontal overflow.
3. Minimum P2 validation viewports: 1280 x 800 and 1440 x 900.

## Dark Theme

P2 desktop defaults to the same dark-capable token family as Web preview.
Production screenshots should use the runtime default; dark-mode parity remains
within the token map and can be expanded later.

## Accessibility Rules

1. Focus-visible outlines for every interactive element.
2. Buttons have accessible labels or clear text.
3. Status is not conveyed by color alone.
4. Invalid state uses understandable Chinese main text.
5. Technical details are collapsible and secondary.
