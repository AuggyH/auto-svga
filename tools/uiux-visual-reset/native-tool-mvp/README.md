# Auto SVGA Native Tool Static Direction

This folder contains static UI direction screens for the short-term Auto SVGA
desktop client. It is a design-direction artifact only.

It is not:

- an interactive prototype
- a small app
- a production client implementation
- a source of product scope

## Static Screens

The current board includes these static screens:

- Launch
- Preview
- Compare empty
- Compare loaded
- Drag decision
- Drag unsupported file
- Optimization result comparison
- Edit mode reserved
- Preview dark
- Settings sheet

The screens are intentionally static. There is no JavaScript, interaction
state, animation, playback, parsing, optimization, replacement, or save logic.

## Direction Being Tested

- The whole window is the canvas.
- The transparent checkerboard surface is the primary visual field.
- Launch keeps the macOS traffic-light controls, drop affordance, Open File
  action, and a low-emphasis recent-file list in one vertical canvas rhythm.
- Preview keeps the canvas immersive after a file is opened. The SVGA artwork,
  playback control, and a white right information area share one borderless
  window surface.
- Preview dirty state is expressed by the file-name `*` and the right-side Save
  As button.
- Compare is represented as a state, not a persistent main-surface button.
- Drag-to-open and drag-to-compare use canvas overlays rather than toolbar
  prompts.
- Optimization result comparison replaces the right information area.
- Edit mode shows only the short-term layer-list boundary; the right operation
  area remains intentionally empty.
- Dark mode keeps the same canvas-first structure and component hierarchy.
- Settings is represented as a restrained sheet opened from the menu, with only
  the appearance choices needed for theme switching.
- No toolbar, card stack, status badge, helper copy, or non-PRD text is
  included in this minimal direction slice.
- Visible in-app copy limited to PRD-traceable information.
- Tokenized CSS variables for color, spacing, border, shadow, and typography.

## Local Preview

```bash
cd tools/uiux-visual-reset/native-tool-mvp
python3 -m http.server 4197 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4197/
http://127.0.0.1:4197/preview.html
http://127.0.0.1:4197/compare-empty.html
http://127.0.0.1:4197/compare-loaded.html
http://127.0.0.1:4197/drag-compare.html
http://127.0.0.1:4197/drag-invalid.html
http://127.0.0.1:4197/optimization-compare.html
http://127.0.0.1:4197/edit.html
http://127.0.0.1:4197/preview-dark.html
http://127.0.0.1:4197/settings.html
```

## References

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple Design Resources: https://developer.apple.com/design/resources/
