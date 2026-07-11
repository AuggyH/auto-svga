# Owner Fix Report: ASV-QA-20260711-001 Terminal State Repair

## Summary

- Owner: 0.2 Multi-format Main Engineer
- Lane: 0.2 multi-format
- Ticket: `ASV-QA-20260711-001`
- Fix status: Fix Ready / Code Review Required
- Fix commit: branch head at handoff
- Branch: `codex/0.2-alpha2-intake-terminal-state-repair`
- Base: `7077c867bb31e3fd72823649b2c6412bb8af6de2`

## QA Finding Addressed

After the alpha2 intake binding repair, QA permit 028 confirmed that stale prior
SVGA retention was fixed, but found two terminal-state failures on installed
build `7077c867`:

- Lottie opened through the installed menu/Open flow, entered Loading, then
  returned to Launch/empty without a loaded state or typed limitation/error.
- VAP opened through the installed menu/Open flow and stayed Loading through the
  final observation window.

This report does not close the QA ticket. It returns source-side Fix Ready for
Code Review, Packaging rebuild, installed metadata inspection, and foreground QA
rerun.

## Root Cause

- The packaged Electron app had correct product-mode binding, but the
  multi-format desktop session still used a source-checkout root for workspace
  module resolution. In a packaged app, accepted multi-format runtime files live
  under `.runtime/dist`, `.runtime/proto`, and `.runtime/node_modules`.
- The renderer controller allowed failed host open outcomes to become silent
  no-ops. A rejected call, missing model, malformed model, or stalled bridge
  could leave the visible surface in Launch or Loading instead of showing a
  typed, path-redacted failure.

## Change Summary

- `main.cjs` now separates source `repoRoot` from packaged
  `multiFormatDesktopRuntimeRoot`. Packaged multi-format sessions receive
  `.runtime`; source/dev sessions keep the checkout root.
- `multiformat-desktop-session.cjs` now wraps local opens in a bounded terminal
  contract. Module failures, open failures, missing/non-object models, and
  deadline expiry return a typed failed owner-visible model with redacted path
  details instead of rejecting into the renderer.
- `multiformat-desktop-preview-controller.mjs` now normalizes host open
  outcomes. Missing models, rejected bridge calls, and stalled calls become
  visible failed states with generic, path-redacted messages.
- Focused tests now cover packaged runtime root binding, synthetic Lottie/VAP
  desktop open terminal states, and renderer-side terminalization for missing
  model, rejection, and timeout.

## Validation

- `npm run build`: PASS.
- `git diff --check`: PASS.
- `node tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`: PASS.
- Focused Electron desktop/package/open suite: PASS 6/6.
- `npm run test:all`: PASS 524/524.
- Package/lockfile drift scan: PASS, none.
- Production media/archive changed-file scan: PASS, none.
- Formal 0.1 isolation scan: PASS.
- `.pnpm-store/` classified residue remains untracked and unstaged.

## Not Run

- No package candidate was built.
- No installed app was replaced.
- No foreground app was launched or controlled.
- No owner material was opened.
- No QA foreground regression was rerun.

## Packaging Need

Packaging is required before QA can verify the repair in the installed app.
The installed `/Users/huangtengxin/Applications/Auto SVGA.app` remains whatever
Packaging last promoted until a new repaired alpha2 candidate is built,
inspected, and installed under PM/Packaging authority.

QA should rerun the original foreground matrix only after the installed package
metadata/runtime inspection confirms a build from this repair head.

## Boundaries

- No Lottie/VAP product support claim.
- No real-material visual playback success claim.
- No save/export/conversion support.
- No Product Owner acceptance.
- No package readiness, distribution readiness, production support, or release
  readiness claim.
