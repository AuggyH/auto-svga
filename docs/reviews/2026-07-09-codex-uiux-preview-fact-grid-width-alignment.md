# Review: UI/UX Preview Fact Grid Width Alignment

## 1. Summary

Aligned the Preview right-surface statistics grid width to the R5 Figma
`预览 / 默认` contract. The grid now uses the full `328px` content width of a
`360px` right surface with `16px` side padding, matching the file header and
resource-row rhythm.

This is a token-only visual alignment. It does not change visible copy,
product behavior, optimization logic, or the right-surface information set.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `416efcd0`
- Uncommitted changes before this WP: unrelated PM/QA lane files plus this
  UI/UX WP.
- Foreground strategy: none. Used smoke screenshots only; no foreground client
  automation.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-preview-fact-grid-width-alignment.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Use latest Figma R5 Preview right-surface contract | Done |
| 2 | Keep right-surface content tokenized | Done |
| 3 | Do not change product behavior or visible copy | Done |
| 4 | Preserve smoke-level layout and interaction flow | Done |

## 5. Verification

```
$ node --test --test-name-pattern "short-term design system" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

$ npm run desktop:short-term:design-system-check
PASS

$ git diff --check -- <touched UI/UX paths>
PASS

$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
PASS
```

## 6. Output inspection

- Inspected `.artifacts/product/short-term/short-term-preview-overview.png`.
- The right-surface statistics grid no longer uses the older `280px` width.
- The statistics grid, header, and resource rows now share a consistent content
  width rhythm.

## 7. Risks

- Smoke screenshot inspection confirms layout sanity, but this still needs a
  future foreground packaged-app visual pass with macOS chrome before owner
  acceptance.
- Wider fact columns may need final tuning when tested against more real
  production SVGA samples.

## 8. Next steps

- Continue Preview visual polish on resource rows and playback controls.
- Include this right-surface rhythm in the next real-material foreground pass.

## 9. Commit

- Commit: pending at review creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers:
  - R4 had an older `280px` dependency note, while R5 Preview default updated
    the right-surface rhythm to `328px`.
- Avoidable costs:
  - Right-surface width tokens should have been reconciled immediately after
    the R5 read.
- Product lessons:
  - Later, more specific Figma packets should supersede older component packet
    measurements when product scope is unchanged.
- Technical lessons:
  - A single token plus a guard assertion is enough when the structure already
    maps to the design system.
- Design / interaction lessons:
  - Shared content width makes the right surface feel calmer without adding
    boundaries or explanatory text.
- Process lessons:
  - Verify screenshot layout after width changes even when tests pass.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 9796548
- Token lesson: Check newest targeted Figma packet before carrying forward an
  older component measurement.
