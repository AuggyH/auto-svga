# 2026-07-03 Codex Short-Term UI/UX WP5C macOS App Identity

## Summary

WP5C tightens the short-term desktop shell's macOS application identity. The short-term client already has a native-style menu model and packaged bundle metadata, but a direct Electron CLI foreground capture still presents the menu-bar application name as `Electron`. This pass adds an explicit runtime app name assignment and records the correct owner-visible validation path through the packaged internal `.app`.

## Git State

- Base before this pass: `2b09c919 uiux: polish short-term inspector components`
- Existing PM-owned dirty files were observed and not touched:
  - `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
  - `docs/product/PRODUCT_ROADMAP.md`
  - `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
  - `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
  - Sets the Electron application name from the short-term product display name before the menu/window shell is built.
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
  - Adds a regression assertion that the default short-term desktop entry preserves the `Auto SVGA` product name and calls `app.setName(productDisplayName)`.
- `docs/reviews/2026-07-03-codex-short-term-uiux-wp5c-macos-app-identity.md`
  - Records this UI/UX shell validation pass.

## Requirement Checks

- Product scope: no product behavior, editor capability, save/export logic, or PM-owned PRD content changed.
- UI/UX scope: aligns with the short-term macOS-first shell requirement that the app should present itself as `Auto SVGA`, not as an Electron prototype.
- Design-system scope: no new one-off visual system was introduced.
- Evidence boundary: direct `electron .` dev launch can still show the host binary name in the system menu bar; owner-visible foreground screenshots should be taken from the internal packaged `.app` entry.

## Verification

- `git diff --check -- tools/electron-prototype/experiments/svga-web/main.cjs tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
  - 29/29 tests passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`
  - Smoke result passed.
- `npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac`
  - Internal `.app` rebuilt successfully.
- Foreground packaged-app screenshot:
  - `/tmp/auto-svga-uiux-wp5c-real-20260703/03-packaged-launch-menu-identity-frontmost-display2.png`
  - Confirmed macOS menu bar shows `Auto SVGA`.

## Risks / Follow-Up

- The canonical developer command still uses Electron CLI for fast iteration. That path is useful for automation, but it is not suitable as owner-visible evidence for menu-bar identity.
- Future visual QA that needs macOS menu bar or system title-bar fidelity should launch the internal `.app`, then capture foreground screenshots from the active desktop.
