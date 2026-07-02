# 2026-07-02 Codex Short-Term Text Preview Menu Contract

## Summary

Added the missing S13 runtime text-preview menu/action contract to the
short-term app state, command menu, host menu routing, and PRD trace tests.
The menu entry is renderer-delegated because opening the text preview modal is
UI runtime work; existing host methods still own prepare/apply/reset behavior
and do not persist text into SVGA bytes.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before task: `ee14c56179979b33521493945baf283080d2c491`
- Known unrelated working-tree item: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-app-state.ts`
- `src/workbench/short-term-command-menu.ts`
- `src/workbench/short-term-host-menu-routing.ts`
- `src/workbench/short-term-prd-trace.ts`
- `src/tests/short-term-command-menu.test.ts`
- `src/tests/short-term-host-actions.test.ts`
- `src/tests/short-term-prd-trace.test.ts`

## Requirement Checks

- PRD authority: `docs/product/PRODUCT_ROADMAP.md`
- Related scope: S13 Preview replaceable text, plus macOS menu coverage for product actions
- Non-goals retained: no temporary UI shell wiring, no text byte editing, no new modal implementation

## Verification

- `npm run build && node --test dist/tests/short-term-prd-trace.test.js dist/tests/short-term-command-menu.test.js dist/tests/short-term-host-actions.test.js`: pass, 30 tests
- `npm run test:all`: pass, 366 tests

## Risks And Next Steps

- `editTextPreview` is intentionally renderer-delegated; a future real UI shell
  must provide the selected text element and modal behavior before calling host
  prepare/apply/reset methods.
- Next mainline task: continue tightening short-term host/menu contracts and
  validation without binding the temporary UI shell.
