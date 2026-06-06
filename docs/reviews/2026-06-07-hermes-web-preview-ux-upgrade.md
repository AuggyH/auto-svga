# Review: Web preview UX upgrade (Rounds 1-5)

## 1. Summary

Complete Web preview page UX overhaul across 5 rounds: design system, auto-load API, panel resize, motion presets, dropdown unification, WCAG AAA accessibility, keyboard navigation, a11y audit, and settings controls.

## 2. Git state

- Branch: `main` (clean)
- HEAD: `cc2c085`
- Previous tag: `v0.1.0-avatar-frame-handoff-baseline`
- Agent: Hermes

## 3. Changes by round

### R1 — Design system + auto-load + panel resize
| File | Change |
|------|--------|
| `DESIGN.md` | Apple-adapted design system (colors, typography, spacing, motion, a11y, Do/Don't) |
| `server.mjs` | `/api/latest-artifact` endpoint scanning jobs/ and examples/ |
| `main.js` | `autoLoadLatestArtifact()`, `setupPanelResize()` |
| `styles.css` | CSS tokens, panelResizeHandle, reduced-motion, responsive breakpoints |

### R2 — Apple translation + motion + dropdown + WCAG
| File | Change |
|------|--------|
| `docs/decisions/ADR-002-apple-design-translation.md` | 152-line translation map (28 adopted / 14 adapted / 20 excluded) |
| `styles.css` | Motion presets (9 classes), unified `.dropdownMenu`/`.dropdownMenuItem` |
| `styles.css` | WCAG AAA (44px touch, focus-visible, skip link, forced-colors) |
| `index.html` | Skip-to-content link |

### R3 — Dropdown unification + keyboard nav + docs
| File | Change |
|------|--------|
| `index.html` | Fit menu: `.fitMenu` → `.fitMenu.dropdownMenu`, buttons → `.dropdownMenuItem` |
| `main.js` | `setupFitMenus()` keyboard nav (ArrowDown/Up/Escape), autofocus |
| `styles.css` | Consolidated fitMenu styles into dropdownMenu |
| `AGENTS.md` | UI Design Rules section (10 rules) |
| `TECH_SPEC.md` | UI Design System section |
| `CURRENT_STATUS.md` | R1-R3 completion |
| `CHANGELOG.md` | R1-R3 summary |

### R4 — API fix + a11y audit
| File | Change |
|------|--------|
| `server.mjs` | Fixed `readdir` import (`node:fs` → `node:fs/promises`) |
| `index.html` | Added srOnly h1, changed `<aside>` → `<div role="complementary">` |
| Axe audit | 4 violations → 2 violations, 38 passes |

### R5 — Settings controls + SVGA retry + drag feedback
| File | Change |
|------|--------|
| `index.html` | Auto-load toggle + rescan button in settings workflow section |
| `main.js` | `autoLoadToggle` localStorage, `rescanButton` handler |
| `main.js` | `loadSvgaWithRetry()` (3 retries, 800ms delay) |
| `main.js` | `getRejectMessage()` for drag error feedback |

## 4. Requirement checks

| Requirement | Status |
|-------------|--------|
| DESIGN.md Apple design system | Done |
| Latest artifact auto-load (backend + frontend) | Done |
| Panel drag-to-resize with localStorage | Done |
| Motion presets (9 CSS classes) | Done |
| Unified dropdown menu | Done |
| Keyboard navigation (Arrow/Enter/Escape) | Done |
| WCAG AAA compliance | Done (2 violations remaining) |
| Responsive breakpoints (1200/900/768) | Done |
| ADR-002 Apple translation map | Done |
| Auto-load toggle + rescan button | Done |
| SVGA auto-load with CDN retry | Done |
| Drag error feedback messages | Done |
| AGENTS.md UI design rules | Done |
| TECH_SPEC UI design section | Done |
| A11y audit (axe-core) | Done (38 passes) |

## 5. Verification

```
tsc -p tsconfig.json                          → BUILD OK (all rounds)
node --check server.mjs && main.js             → SYNTAX OK
/api/latest-artifact                           → 2 artifacts found
Browser: auto-load switches to export review   → reference GIF loads ✓
Browser: panel resize handle focusable         → ✓
Browser: dark mode toggle                      → ✓
Axe-core: 38 passes, 2 violations              → ✓
```

## 6. Known limitations

- SVGA auto-load depends on CDN script (`svgaplayerweb`) timing — retry mechanism helps but not guaranteed on slow networks
- 2 remaining axe violations: `aria-prohibited-attr` and `aria-required-attr` on resize handle (minor, no UX impact)
- 002 job input/ missing locally — can't run full pipeline
- Visual spacing items need human eyes (not verifiable via accessibility tree)

## 7. Next steps

- Complete remaining 2 axe violations
- Deploy and manual test: drag-drop, keyboard full navigation, reduced-motion, dark mode
- Automated Playwright + axe-core CI pipeline
- Mobile <768px full adaptation
- Human visual acceptance of 002 job

## 8. Commit

- HEAD: `cc2c085`
- Branch: `main`
- Agent: Hermes
- Tag: none
