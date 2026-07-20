# Review: uiux-right-surface-figma-rhythm

## 1. Summary
Aligned the Auto SVGA `0.1.x` Preview right information surface rhythm with the current Figma `预览 / 默认` frame.

The implementation changes only design tokens: right-panel padding now follows Figma's `16px` content inset, and right-panel section spacing is tightened so the surface reads less like a loose engineering panel and more like the Owner-confirmed compact canvas-first app.

## 2. Git state
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `1839ba22`
- Uncommitted changes: existing PM/QA lane files were present before this WP and were not staged or edited by this task.
- Untracked files: existing PM/QA review and QA files were present before this WP and were not staged or edited by this task.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/research/figma-mcp-read-packets/r5-preview-right-surface-rhythm-20260709.md`
- `docs/research/figma-mcp-call-log.md`
- `docs/reviews/2026-07-09-codex-uiux-right-surface-figma-rhythm.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | Follow main PRD and subordinate UI/UX docs; do not redefine product scope from Figma. | Done |
| 2 | Use Figma MCP within standing safe budget and record planned vs actual usage. | Done |
| 3 | Apply design-system token changes rather than one-off surface CSS. | Done |
| 4 | Do not add visible product copy, controls, or states. | Done |
| 5 | Preserve right information surface functionality across Preview states. | Done |

## 5. Verification
Commands run and results:
```bash
$ node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ git diff --check -- tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS
```

## 6. Output inspection
- Smoke screenshot inspected: `.artifacts/product/short-term/short-term-preview-overview.png`
- Smoke screenshot inspected: `.artifacts/product/short-term/short-term-preview-replaceable.png`
- Smoke screenshot inspected: `.artifacts/product/short-term/short-term-preview-optimization.png`
- Right surface stayed stable after padding and section-gap token changes.
- Resource rows and optimization cards did not overlap after the rhythm adjustment.
- Foreground packaged-app screenshot was not run for this token-only WP; it remains part of the next owner-visible bundle acceptance.

## 7. Figma MCP Usage
- Batch: `Batch 09 - R5 Preview Right Surface Rhythm`
- Packet: `docs/research/figma-mcp-read-packets/r5-preview-right-surface-rhythm-20260709.md`
- Planned calls: 2
- Hard cap: 3
- Actual attempts: 3
- Conservative quota reads: 3
- Local-day usage after batch: 3/160
- Notes: `_get_metadata` failed with `Tool get_metadata not found`; two `_use_figma` read-only calls succeeded. The final response was truncated after useful right-surface facts, so no additional read was made.

## 8. Risks
- Figma is a design reference, not product authority; this WP changed only visual tokens already allowed by the PRD/UI brief.
- Smoke screenshots are regression/layout evidence, not final foreground macOS acceptance.
- The Figma frame uses sample values; implementation still renders real inspection data.

## 9. Next steps
- Continue with the next Preview surface polish WP, preferably targeting a specific Figma-backed component contract instead of broad visual tweaking.

## 10. Commit
- Commit: pending
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 11. Project retrospective
- Value assessment: Medium
- Cost drivers: one exposed metadata MCP tool was not available server-side; the useful right-surface read was partially truncated.
- Avoidable costs: skip `_get_metadata` until the MCP tool list confirms it is truly callable.
- Product lessons: Figma can guide visual rhythm only after PRD scope is already fixed.
- Technical lessons: panel rhythm should live in tokens so Figma alignment does not turn into one-off module CSS.
- Design / interaction lessons: the right surface needs a 16px content inset and compact section rhythm to feel closer to the authored design.
- Process lessons: hard caps are useful; the truncated Figma output still contained enough facts, so stopping avoided unnecessary quota spend.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 12. Token usage
- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 7454577
- Token lesson: use compact `use_figma` scripts for specific frame facts and stop once the implementation decision is supported.
