# Short-Term Source Name Boundary

Date: 2026-07-02
Agent: Codex
Branch: agent/codex/svga-workbench-v1-autonomous

## Summary

Hardened short-term preview and workflow models so `sourceName` is always
reduced to safe display text before it appears in renderer-facing state. Also
added a dynamic PRD/menu trace guard so future product-routed menu items cannot
silently miss command and dispatch trace mappings.

## Git State

- Base head before task: 92f64020
- Unrelated untracked file intentionally untouched:
  `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-path-display.ts`
- `src/workbench/short-term-optimization-compare-session.ts`
- `src/workbench/short-term-optimization-workflow.ts`
- `src/workbench/short-term-rename-preview-session.ts`
- `src/workbench/short-term-rename-workflow.ts`
- `src/workbench/short-term-image-replacement-preview-session.ts`
- `src/workbench/short-term-image-replacement-workflow.ts`
- `src/workbench/short-term-text-preview-session.ts`
- Related targeted tests

## Requirement Checks

- Renderer-facing short-term models do not retain path-like `sourceName`
  values.
- Product-routed menu commands remain bound to PRD trace metadata.
- No UI shell, layout, or product-scope behavior was changed.

## Verification

- `npm run build`
- `node --test dist/tests/short-term-path-display.test.js dist/tests/short-term-text-preview-session.test.js dist/tests/short-term-optimization-compare-session.test.js dist/tests/short-term-rename-preview-session.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-prd-trace.test.js dist/tests/short-term-host-menu-routing.test.js dist/tests/short-term-command-menu.test.js`
- `npm run test:all`
- `npm run loop:validate`

## Risks / Next Steps

- Low risk; behavior changes only sanitize display names and add regression
  coverage.
- Next useful mainline task: continue auditing direct workflow APIs for
  renderer-facing path-like fields.
