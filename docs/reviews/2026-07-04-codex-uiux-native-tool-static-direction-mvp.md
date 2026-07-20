# UI/UX Native Tool Static Direction MVP

## Summary

Created and expanded an isolated static design-direction board for the
short-term Auto SVGA client:

- `DESIGN.md`
- `tools/uiux-visual-reset/native-tool-mvp/index.html`
- `tools/uiux-visual-reset/native-tool-mvp/preview.html`
- `tools/uiux-visual-reset/native-tool-mvp/styles.css`
- `tools/uiux-visual-reset/native-tool-mvp/README.md`

This is a static UI direction artifact only. It is not an interactive
prototype, not a small app, and not production implementation. After Owner
feedback, the artifact was reduced to small launch and preview direction
slices to avoid over-completion.

## Boundary

- No product documentation was modified.
- `DESIGN.md` was updated as the UI/UX design-system manifest, not as product
  scope authority.
- No production client code was modified.
- No JavaScript, interaction state, animation, parsing, playback, optimization,
  replacement, or save logic is included.
- The board exists only to validate the Owner-confirmed "window as canvas"
  visual direction and its main page-state slices.

## Static Screens

- Launch
- Preview
- Compare empty
- Compare loaded
- Drag decision
- Drag unsupported file
- Optimization result comparison
- Edit reserved
- Preview dark
- Settings sheet

## Design Direction

- The whole app window is treated as one immersive canvas.
- The transparent checkerboard field provides the primary visual surface.
- No toolbar, cards, heavy borders, status badges, or helper copy appears in
  the launch slice.
- The launch slice shows drag in, Open File, and a low-emphasis recent-file
  list with icon-only clear action.
- The preview slice keeps the opened SVGA artwork on the same canvas and uses a
  white right information area instead of a boxed inspector panel.
- The preview slice uses PRD-traceable file facts, optimization status,
  imageKey rows, asset filters, and asset rows without turning them into a
  boxed engineering report.
- The dirty preview slice uses the file-name `*` and right-side Save As
  affordance.
- Compare has no persistent main-surface entry in this direction. It is
  represented through compare empty, compare loaded, and drag-decision states.
- Optimization result comparison replaces the right information area.
- Edit reserved shows only the short-term layer-list boundary; the right
  operation area remains empty.
- Preview dark validates that the canvas-first language has a dark-mode
  counterpart.
- Settings sheet validates the menu-driven theme switch surface without
  reviving the old Workbench settings panel.
- Playback controls stay on the canvas bottom edge with icon-first controls.
- The macOS traffic-light controls remain as the minimum window chrome.

## References

- Apple Human Interface Guidelines:
  https://developer.apple.com/design/human-interface-guidelines/
- Apple HIG Toolbars:
  https://developer.apple.com/design/human-interface-guidelines/toolbars
- Apple HIG Materials:
  https://developer.apple.com/design/human-interface-guidelines/materials
- Apple Design Resources:
  https://developer.apple.com/design/resources/

## Verification

- Local preview served at `http://127.0.0.1:4197/`.
- Static page availability check passed for:
  - `index.html`
  - `preview.html`
  - `compare-empty.html`
  - `compare-loaded.html`
  - `drag-compare.html`
  - `drag-invalid.html`
  - `optimization-compare.html`
  - `edit.html`
  - `preview-dark.html`
  - `settings.html`
- HTML parser check passed for all static pages.
- Script count is `0` for every static page.
- Repository check:
  - `git diff --check` passed for the static direction files and `DESIGN.md`.
- Playwright screenshot validation was not run because the local Playwright
  browser executable is not installed in this environment. This does not affect
  the static direction artifact boundary; real client visual acceptance still
  requires foreground macOS screenshots.

## Next Step

PM should review the Owner-confirmed product-behavior deltas in
`docs/reviews/2026-07-04-codex-uiux-owner-confirmed-canvas-direction-sync.md`
before production client implementation treats them as PRD-authoritative.
