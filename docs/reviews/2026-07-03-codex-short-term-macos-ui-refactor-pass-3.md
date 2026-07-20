# Short-Term macOS UI Refactor Pass 3

## Summary

Refined the default macOS short-term client around the current PRD and UI/UX design documents while preserving the existing real open, preview, optimization, rename, replacement, save, menu, and smoke-proof flows.

## Scope

- macOS Electron short-term renderer only.
- No Web Preview or Windows client changes.
- No new product features beyond S1-S16.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Preview mode remains center canvas plus right tabs, without a left resource panel.
- Resource and replaceable rows remain browser-oriented; image replacement and rename stay in context menu/macOS menu flows.
- Tabs are visually lighter and now expose `role="tablist"` / `aria-selected`.
- Mode buttons expose `aria-pressed`.
- Metadata remains selectable/copyable.
- Hidden transient surfaces are protected by a global `[hidden]` rule so status banners and dialogs do not leak blank space.

## Verification

- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke`

## Risks

- This is still an implementation pass against the documented shell direction, not final high-fidelity design sign-off.
- Dark mode screenshots were generated because the local system appearance was dark; light mode still needs an explicit screenshot pass before calling the UI final.
