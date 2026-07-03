# Short-term Smoke Proof Module Split

Date: 2026-07-04
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Moved the short-term macOS client's smoke proof helper logic out of the main
app entry file and into a dedicated smoke-proof model module.

This keeps `short-term-macos-app.mjs` focused on user-flow orchestration while
the proof module owns tab keyboard proof helpers, design interaction proof
helpers, smoke failure reporting, resource-locality checks, frame waits, and
canvas pixel checks.

No product behavior, user-facing copy, visual styling, menu structure, or
feature scope was changed.

## Changed Files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`

## Requirement Checks

- Product authority: no change to `docs/product/PRODUCT_ROADMAP.md` or product
  scope.
- UI/UX execution: continues the design-system requirement that the app be
  structured into smaller traceable modules instead of accumulating logic in
  one large entry file.
- Visible DOM ownership: the new module does not create visible DOM nodes,
  assign `innerHTML`, or create one-off component structure.
- Smoke evidence boundary: smoke remains automated regression evidence only;
  this split does not claim visual or interaction acceptance.

## Verification

- `npm run desktop:short-term:design-system-check`
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-app.mjs`
- `node --check tools/electron-prototype/experiments/svga-web/web/short-term-macos-smoke-proof-model.mjs`
- `npm run desktop:smoke`
- `git diff --check`

Result: checks passed.

## Risks

- The smoke runner itself remains large inside `short-term-macos-app.mjs`.
  This change extracts helper logic but does not yet split the full smoke
  scenario sequence.
- Static and smoke tests prove the refactor did not break the current
  automated proof path; foreground macOS screenshots are still required before
  visual or interaction acceptance claims.

## Next Step

Continue reducing the short-term app entry by moving another cohesive group,
preferably save/output proof construction or recent-file orchestration, into a
small model module while keeping the design-system check green.
