# Indexed PNG Replacement Regression Review

Date: 2026-07-02
Agent: Codex
Branch: `agent/codex/svga-workbench-v1-autonomous`

## Summary

Added regression coverage for indexed/palette PNG replacement inputs. This locks the previously owner-observed `Unsupported PNG color type: 3` class of failure at both the low-level editor validation boundary and the short-term image replacement workflow boundary.

## Git State

- Base before task: `e2e041a8`
- Untracked `docs/research/figma-make-short-term-uiux-prompt.md` is unrelated and was not touched.

## Changed Files

- `src/tests/svga-image-resource-editor.test.ts`
- `src/tests/short-term-image-replacement-workflow.test.ts`

## Requirement Checks

- Verifies `SvgaImageResourceEditor.validatePngReplacement()` accepts 8-bit indexed PNGs with palette alpha.
- Verifies short-term image replacement accepts an indexed PNG, generates a saveable output, reopens it, and preserves the replacement PNG bytes exactly.
- Does not change product code, UI shell, parser/exporter behavior, packaging, or owner-visible layout.

## Verification

- `npm run build && node --test dist/tests/png-reader.test.js dist/tests/svga-image-resource-editor.test.js dist/tests/short-term-image-replacement-workflow.test.js` (18 tests)
- `npm run test:all` (393 tests)
- `git diff --check`

## Risks

- None expected. This is test-only coverage over existing PNG reader support.

## Next Steps

- Continue adding regression tests for real owner-observed format edge cases when the underlying capability already exists.
