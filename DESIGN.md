---
name: auto-svga design system
description: Preview-first tool UI adapted from Apple HIG for SVGA production validation. NOT a marketing page — higher density, inspectable, accessible.
language:
  primary: zh-CN
  secondary: en
product_type: creator_tool
visual_tone:
  - precise
  - calm
  - technical
  - premium
design_source: adapted from Apple design analysis (DESIGN-apple.md), Apple HIG, WCAG 2.2 AAA
---

# Auto SVGA Design System

## Core Philosophy

**Preview first, UI retreats.** The SVGA playback canvas is the hero. Toolbars, panels, menus, and logs reduce visual noise so the designer can judge the animation, not the interface.

Apple's marketing pages use extreme whitespace, 56px headlines, and photography-as-hero. Auto SVGA is a **production tool** — it needs higher information density, inspectable debug data, readable logs, and file metadata at a glance. We adapt Apple's color/token/typography discipline but redirect it from "museum gallery" to "professional instrument."

### Principles

1. Preview canvas dominates viewport
2. Single Action Blue (`#0066cc`) for all interactive elements
3. Neutral surfaces — white, near-white, near-black — no decorative gradients
4. Hairline borders (`rgba(0,0,0,0.08)`) for separation, never heavy shadows
5. System fonts (SF Pro / Inter fallback)
6. 8px spacing grid for layout; typographic adjustments use finer sub-steps
7. Motion serves state change, not decoration — `prefers-reduced-motion` mandatory
8. WCAG AAA: 7:1 text contrast, 44px touch targets, keyboard accessible
9. Chinese primary labels, English secondary for debug traceability
10. Glass effects are optional and must never compromise readability

### What We Do NOT Copy from Apple's Marketing Pages

- 56px hero headlines → our max is 21px tool titles
- 80px section padding → our max is 24px panel padding
- Product photography shadows → we don't have product photos
- Extreme whitespace → we need information density
- Marketing narrative copy → we show technical data

---

## Color Tokens

```css
:root {
  /* Action — single interactive blue */
  --color-action: #0066cc;
  --color-action-focus: #0071e3;
  --color-action-on-dark: #2997ff;

  /* Text */
  --color-text: #1d1d1f;
  --color-text-secondary: #333333;
  --color-text-muted: #6e6e73;
  --color-text-on-dark: #ffffff;
  --color-text-on-dark-muted: #cccccc;

  /* Surfaces — light mode */
  --color-canvas: #ffffff;
  --color-canvas-soft: #f5f5f7;
  --color-surface: #fafafc;
  --color-panel: rgba(250, 250, 252, 0.86);
  --color-panel-solid: #fafafc;
  --color-hairline: rgba(0, 0, 0, 0.08);
  --color-divider: #f0f0f0;

  /* Surfaces — dark mode */
  --color-dark-canvas: #1d1d1f;
  --color-dark-surface: #272729;
  --color-dark-surface-alt: #2a2a2c;
  --color-dark-panel: rgba(39, 39, 41, 0.88);
  --color-dark-hairline: rgba(255, 255, 255, 0.12);

  /* Semantic */
  --color-success: #30b158;
  --color-warning: #ff9500;
  --color-error: #ff3b30;
  --color-info: #007aff;
}
```

### Contrast Requirements (WCAG AAA)

| Pair | Ratio | Target |
|------|-------|--------|
| `--color-text` on `--color-canvas` | ~17:1 | ≥7:1 ✓ |
| `--color-text-secondary` on `--color-canvas` | ~11:1 | ≥7:1 ✓ |
| `--color-text-on-dark` on `--color-dark-surface` | ~14:1 | ≥7:1 ✓ |
| `--color-action` on `--color-canvas` | ~5.4:1 | ≥4.5:1 (large) ✓ |
| `--color-text-muted` on `--color-canvas` | ~4.7:1 | ≥4.5:1 (large only) ⚠️ |

---

## Typography

```css
:root {
  --font-system: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
  --font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;

  /* Tool UI scale — NOT marketing scale */
  --text-title: 17px;
  --text-body: 14px;
  --text-ui: 13px;
  --text-caption: 12px;
  --text-log: 12px;

  --leading-title: 1.24;
  --leading-body: 1.47;
  --leading-ui: 1.35;
  --leading-log: 1.5;

  --weight-title: 600;
  --weight-body: 400;
  --weight-ui: 500;
}
```

### Typography Rules

- Body at 14px for tool UI (not Apple's 17px — we need density)
- Titles at 17px/600
- Logs at 12px monospace
- Captions at 12px
- Never use negative letter-spacing (Apple's "tight" is for 40px+ marketing headlines)
- Line-height: body 1.47, UI 1.35, logs 1.5

---

## Spacing (8px Grid)

```css
:root {
  --space-xxs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
}
```

### Layout Rules

- Structural layout snaps to 8/12/16/24
- Panel padding: 16px (cards), 12px (compact)
- Section gaps: 12–16px
- Button padding: 6–10px vertical, 12–16px horizontal
- Toolbar height: 44–48px
- No 80px section gaps — this is a tool, not a landing page

---

## Border Radius

```css
:root {
  --radius-sm: 8px;
  --radius-md: 11px;
  --radius-lg: 18px;
  --radius-pill: 9999px;
}
```

- Cards/panels: `--radius-lg` (18px)
- Buttons: `--radius-pill` for primary actions, `--radius-sm` for utility
- Menus/dropdowns: `--radius-md` (11px)
- Preview card: `--radius-lg` (18px)

---

## Elevation

**No decorative shadows on UI chrome.** Depth comes from:
1. Surface color change (white → near-white → near-black)
2. 1px hairline borders (`--color-hairline`)
3. Optional backdrop-blur on frosted panels
4. The single Action Blue signals interactivity

```css
/* Frosted panel — optional, must preserve readability */
.panel-frosted {
  background: var(--color-panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-hairline);
}
```

---

## Components

### Toolbar

- Height: 48px
- Background: frosted surface
- Left: app name + current mode
- Center: mode switcher (pill-shaped)
- Right: info, logs, theme, settings buttons
- Only primary action uses Action Blue pill

### Preview Card

- Background: `--color-canvas-soft`
- Border-radius: `--radius-lg`
- No shadow
- Preview canvas with checkerboard transparent background
- Controls: play/pause, replay, loop, fit mode, progress bar

### Info Panel

- Default width: 420px, min: 320px, max: min(560px, 42vw)
- Background: `--color-panel-solid`
- Border-radius: `--radius-lg`
- Padding: 16px
- Key/value pairs in two-column layout
- Long filenames truncated with tooltip
- Resizable via left-edge drag handle (8px wide, saves to localStorage)

### Logs Drawer

- Default width: 560px, min: 420px, max: min(720px, 50vw)
- Three columns: time | level | message
- 12px monospace
- Copy, clear, level filter
- Resizable via left-edge drag handle

### Dropdown Menu

Unified `GlassDropdownMenu`:
- Background: `--color-panel` with backdrop-blur
- Border: 1px `--color-hairline`
- Border-radius: `--radius-md`
- Item height: 36–40px
- Hover: light blue or light gray
- Active: check icon + blue text
- Focus visible: 2px `--color-action-focus` outline
- Animation: opacity + translateY(4px) + scale(0.98→1)
- Reduced motion: opacity only

### Buttons

- Primary: Action Blue pill, white text, `transform: scale(0.97)` on active
- Secondary: transparent, Action Blue text, hairline border
- Utility: neutral surface, `--color-text-secondary`
- Icon: 32–44px touch target, circular or rounded-sm

### Focus Visible

All interactive elements must have visible focus:
```
outline: 2px solid var(--color-action-focus);
outline-offset: 2px;
```

---

## Motion Presets

```ts
const motionTokens = {
  durationFast: 0.14,
  durationBase: 0.2,
  durationPanel: 0.26,
  springPanel: { type: 'spring', damping: 30, stiffness: 320, mass: 0.85 },
  springModal: { type: 'spring', damping: 30, stiffness: 360, mass: 0.8 },
};

// CSS fallback (no JS motion library required)
const motionCSS = {
  fadeInOut: 'opacity 0.2s ease',
  panelSlideIn: 'transform 0.26s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
  modalPop: 'transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
  dropdown: 'transform 0.2s ease, opacity 0.14s ease',
};

// Reduce motion override
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Motion Rules

- Panel slide-in: from right, 0.26s
- Modal: opacity + scale, 0.26s spring
- Dropdown: opacity + translateY, 0.2s
- Card state: opacity crossfade, 0.2s
- Tab indicator: shared layout transition
- Drag glow: border-color 0.14s
- All disabled if `prefers-reduced-motion: reduce`

---

## Responsive Breakpoints

```
>= 1440px: Full layout, info panel 420-480px, side-by-side
1200-1439px: Info panel 360-420px, preview adapts
900-1199px: Info panel switches to overlay, narrower
< 900px: Compact layout, warning shown, not fully mobile-optimized
```

- Toolbar never wraps into multiple rows
- Mode selector stays visible
- Preview cards maintain minimum 320px width
- Settings modal: `max-width: min(480px, calc(100vw - 32px))`
- Logs drawer: `max-width: min(720px, calc(100vw - 48px))`

---

## Accessibility (WCAG AAA Target)

| Requirement | Target | Status |
|-------------|--------|--------|
| Text contrast | ≥7:1 | Implemented ✓ |
| Large text contrast | ≥4.5:1 | Implemented ✓ |
| Non-text contrast | ≥3:1 | Partial |
| Touch target size | ≥44px | Partial (buttons OK, menu items need work) |
| Focus visible | always | Implemented |
| Keyboard navigation | full | Partial |
| Color not sole indicator | always | Implemented (icons + text) |
| Drag alternatives | required | File select button ✓ |
| Reduced motion | supported | Implemented |
| Glass readability | preserved | Designed (frosted + solid fallback) |

---

## Do's and Don'ts

### Do
1. Preview canvas first — it's the reason the tool exists
2. Single Action Blue for all interactive elements
3. System fonts, 14px body, no marketing sizes
4. 8px spacing grid, 18px card radius
5. Hairline borders, no heavy shadows
6. Frosted panels only where they don't harm readability
7. Chinese primary, English secondary for debug
8. Motion serves state — 0.2s base, reduced-motion support

### Don't
1. Don't copy Apple's 56px headlines or 80px section padding
2. Don't use multiple brand colors
3. Don't add decorative shadows or gradients
4. Don't sacrifice contrast for glass effects
5. Don't write labels in English only
6. Don't animate without reduced-motion fallback
7. Don't make panels narrower than readable
8. Don't mark unverified items as done

---

## Agent Implementation Guide

When implementing UI changes:
1. Read this DESIGN.md first
2. Use CSS custom properties defined above — no hardcoded colors
3. Test both light and dark modes
4. Verify contrast ratios
5. Verify keyboard tab order
6. Test `prefers-reduced-motion: reduce`
7. Test at 1440px, 1280px, 1024px, 900px
8. Chinese labels primary, English secondary
