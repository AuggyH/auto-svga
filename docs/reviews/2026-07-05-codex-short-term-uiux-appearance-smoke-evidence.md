# Short-term UI/UX Appearance Smoke Evidence

Date: 2026-07-05
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

This UI/UX slice strengthens light/dark appearance validation evidence for the
short-term client. The existing Settings appearance switch already supported
System, Light, and Dark; this change adds smoke screenshots for the actual app
surface after switching to dark and light, and makes the design-interaction
proof require those screenshots.

## Product And Design Authority

- Product authority: `docs/product/PRODUCT_ROADMAP.md`
- Design authority: `DESIGN.md`
- Execution guardrails:
  `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`

The slice does not change product scope or theme options. It only improves
verification evidence for the existing appearance feature.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-runner.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-05-codex-short-term-uiux-appearance-smoke-evidence.md`

## Requirement Checks

- Light/dark support: smoke now captures `short-term-appearance-dark.png` and
  `short-term-appearance-light.png` after closing the Settings sheet, so the
  evidence shows the main app surface.
- Evidence strength: design-interaction proof now requires both appearance
  screenshots in addition to appearance state switching.
- Product scope: no new settings, labels, controls, or visible product copy
  were added.

## Verification

- `npm run desktop:short-term:design-system-check`: passed
- `node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`: passed, 31/31
- `npm run desktop:smoke`: passed
- `git diff --check`: passed

Smoke screenshots inspected:

- `.artifacts/product/short-term/short-term-appearance-dark.png`
- `.artifacts/product/short-term/short-term-appearance-light.png`

Smoke screenshots remain regression evidence only. Foreground macOS-client
screenshots with native window chrome and real Owner production SVGA materials
are still required before final UI/UX acceptance.

## Risks

- The light-mode smoke fixture appears visually pale because the synthetic
  fixture itself is low-contrast/transparent. This must be checked with real
  production SVGA materials before final UI/UX acceptance.

## Next Steps

Run foreground desktop-client validation with real production SVGA files, then
package the latest app build for Owner review while retaining only the latest
three UI/UX package ZIPs.
