# Current Status

Date: 2026-06-07

## Main Branch

- **Runnable**: yes
- **Latest commit**: (see git log after merge)
- **Latest tag**: v0.1.0-avatar-frame-handoff-baseline
- **Branch**: main

## Last Completed

Web preview UX upgrade (Rounds 1-3):
- Round 1: DESIGN.md, `/api/latest-artifact` auto-load, panel resize with localStorage, responsive CSS
- Round 2: ADR-002 Apple translation map, motion presets (9 classes), unified dropdown menu, WCAG AAA
- Round 3: Fit menu → dropdownMenu unification, keyboard nav (Arrow/Enter/Escape), AGENTS.md UI rules, TECH_SPEC UI section

## Web UI Status

| Item | Status |
|------|--------|
| Chinese-first UI | Done |
| DESIGN.md Apple-adapted design system | Done |
| Latest artifact auto-load (API + frontend) | Done |
| Panel drag-to-resize (info + logs) | Done |
| Motion presets (fadeIn, panelSlideIn, modalPop, dropdown, etc.) | Done |
| Unified dropdown menu (.dropdownMenu/.dropdownMenuItem) | Done |
| Fit menu keyboard nav (Arrow/Enter/Escape) | Done |
| WCAG AAA: 44px touch targets, focus-visible, skip link | Done |
| Reduced motion (prefers-reduced-motion) | Done |
| Responsive breakpoints (1200/900/768) | Done |
| Drag-drop visual feedback (isDragOver/isDragReject) | Done |
| Asset filter buttons (全部/精灵/图片/序列帧/异常) | Done |
| Settings modal organized + Chinese | Done |
| Visual spacing items (double-line, v/h) | Not verified (visual) |

## Scope

avatar_frame MVP only. No other asset types.

## Known Issues

- `duplicateOverlayRisk: true` — needs human visual confirmation
- No automated visual playback verification
- Visual spacing items need human review
- 002 job input/ missing — can't run full pipeline locally

## Next Steps

- Deploy and test in real browser (drag-drop, keyboard nav, reduced motion, dark mode)
- Human visual acceptance of 002 job
- Automated a11y audit with axe-core/Playwright
- Restore 002 job input for full pipeline test
