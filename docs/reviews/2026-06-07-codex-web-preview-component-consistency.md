# Web Preview Component Consistency Review

Date: 2026-06-07
Branch: `agent/codex/web-preview-component-consistency`
Implementation commit: `691f7df`

## Result

- Done: shared blurred floating-menu style with solid Reduce Blur fallback.
- Done: all mode/fit menus moved to one fixed floating root and no longer clipped by cards.
- Done: synchronized footer keeps balanced left/control/right regions at the verified narrow viewport.
- Done: SVGA A and reference media remained centered; shared stage rules also cover SVGA B.
- Done: Overview filename, spacing, parse/render separation, and content-width status badges.
- Done: Assets filter/list scroll separation, 48px thumbnails, and two-line metadata.
- Done: bilingual debug copy uses Chinese primary and smaller English secondary lines.
- Done: toolbar actions no longer close temporary diagnostics.
- Done: modal/lightbox outside clicks close the top layer without triggering underlying theme controls.
- Done: icon-plus-label header actions collapse to accessible icon-only controls at compact widths.
- Done: rescan and setting toasts remain visible above floating surfaces.
- Partial: runtime log rows are visually lighter, but long bilingual messages still wrap.
- Partial: exact 900px/768px screenshots and a Local Compare session with both SVGA files loaded were unavailable.

## Component Reuse

- Top mode menu, SVGA A fit menu, SVGA B fit menu, and reference fit menu all use `setupDropdown`, `openDropdown`, `closeDropdown`, and `positionDropdown`.
- Menus are re-parented to `#floatingRoot`; trigger ownership is retained in `dropdownBindings`.
- All preview variants share `.stage`, `.mediaFrame`, and centered child rules.
- No instance-specific left-card alignment or clipping fix was added.

## Floating Interaction Rules

- Temporary panels close from preview/background clicks.
- Toolbar actions and artifact rescan do not close a temporary panel.
- The active panel trigger toggles; the other diagnostic trigger switches panels.
- Dropdown outside click closes the dropdown.
- Settings and asset lightbox use modal backdrops; backdrop clicks do not pass through.
- Escape closes lightbox, settings, dropdown, then side panel.

## Responsive Rules

- Text controls use nowrap, ellipsis, and `min-width: 0`; no intentional single-character vertical wrapping remains.
- Icon-plus-label card actions hide only the label below 760px and retain title/ARIA naming.
- The synchronized footer preserves both file summaries; optional metadata hides before the summaries.

## Verification

- `npm run build` — passed.
- `npm run test` — 28 passed, 0 failed.
- `node --check tools/svga-player-preview/main.js` — passed.
- `node --check tools/svga-player-preview/server.mjs` — passed.
- Browser 499×771 — A/reference cards horizontal, media centered, both footer summaries visible.
- Browser — A and reference fit menus fully visible, fixed, blurred, and attached to `floatingRoot`.
- Browser — top mode menu blurred, viewport-contained, and showed one selected check.
- Browser — Reduce Blur disabled blur; re-enabling uses a solid menu/floating surface.
- Browser — information and logs stayed open during theme switching.
- Browser — settings and asset lightbox backdrop clicks did not change the underlying theme.
- Browser — Assets filter had no vertical scrollbar; resource list scrolled with 48×48 thumbnails and 76px rows.
- Browser — rescan failure produced a visible toast while the information panel remained open.

## Risks

- Exact 900px and 768px viewport emulation remains unavailable.
- Two loaded local SVGA files must still be manually reviewed together.
- Full axe and keyboard traversal remain required before claiming WCAG AAA.
- Real SVGA visual correctness remains a manual acceptance item.

## Next Step

Run the explicit viewport/accessibility matrix and a real A/B local comparison, then consider a dedicated CSS consolidation pass without visual changes.
