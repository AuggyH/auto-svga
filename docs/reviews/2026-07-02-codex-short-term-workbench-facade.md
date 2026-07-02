# Codex Review: Short-Term Workbench Facade

## Summary

Added a tech-lead-side short-term Workbench facade that composes the corrected product state model with recent files, optimization compare, image-key rename preview, PNG replacement preview, runtime text preview, and validated Save As planning. This is a backend/frontend boundary for the future product shell; it does not wire real behavior into the temporary UI/UX skeleton.

The facade keeps host-only source bytes outside the renderer-facing model, exposes path-redacted recent-file state, binds active outputs to the existing short-term save model, and clears stale save commands when a workflow fails or produces no validated output.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Base before this change: `5d2546f feat: add text preview session boundary`
- Unrelated untracked file left untouched: `docs/research/figma-make-short-term-uiux-prompt.md`

## Changed Files

- `src/workbench/short-term-app-state.ts`
  - Added helpers to clear persisted output and replace normalized recent-file records.
- `src/workbench/short-term-workbench-facade.ts`
  - Added unified short-term facade state/model and workflow entry points.
  - Preserves source immutability by cloning bytes at boundaries.
  - Keeps local paths redacted from renderer-facing state.
  - Clears stale save state on failed/no-output workflow transitions.
- `src/tests/short-term-workbench-facade.test.ts`
  - Covers launch recent files, local open, missing recent recovery, optimization output/save clearing, rename/replacement/text preview entries, and recent clearing without source mutation.

## Requirement Checks

- PRD authority remains `docs/product/PRODUCT_ROADMAP.md`.
- Scope remains short-term SVGA preview/inspection/edit-prep/save boundary work.
- No broad UI polish, layout-system work, or real wiring into the temporary shell.
- No claims of final product acceptance or owner review readiness.
- Existing Phase 1/2/3/4 work is not modified.

## Verification

- `npm run build` passed.
- Targeted boundary tests passed: `node --test dist/tests/short-term-workbench-facade.test.js dist/tests/short-term-app-state.test.js dist/tests/short-term-recent-files.test.js dist/tests/short-term-save-execution.test.js dist/tests/short-term-optimization-compare-session.test.js dist/tests/short-term-rename-preview-session.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-text-preview-session.test.js`
  - Result: 40 tests passed.
- Full validation passed: `npm run test:all`
  - Result: 300 tests passed.

## Risks

- The facade is intentionally product-engine boundary code. Future UI integration still needs the UI/UX shell to expose stable component contracts.
- Runtime text preview remains preview-only and does not write SVGA bytes, consistent with current short-term scope.

## Next Steps

- Continue tech-lead-side work by adding narrow host adapter seams around open/save/menu operations once the redesigned UI shell provides integration-ready contracts.
- Keep future UI integration separated from core workflow validation so temporary shell behavior does not become product truth.
