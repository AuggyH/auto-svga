# Review: UI/UX Preview Overview Evidence Sizing

## 1. Summary

Fixed a misleading smoke screenshot condition for the Preview overview surface.
`short-term-preview-overview.png` was still captured at the launch square window
size, which clipped the right information panel and made the file title appear
broken. The default overview evidence now captures at the default workbench
size.

Also added a small right-surface header guard so the file identity header uses
an explicit tokenized width and clips internally instead of allowing layout
overflow.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `47325659`
- Uncommitted changes before this WP: unrelated PM/QA lane files plus this
  UI/UX WP.
- Foreground strategy: none. Used smoke screenshots only; no foreground client
  automation.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-09-codex-uiux-preview-overview-evidence-sizing.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product behavior or visible copy | Done |
| 2 | Keep right header sizing tokenized | Done |
| 3 | Capture default Preview overview at default workbench size | Done |
| 4 | Preserve launch-square capture for Launch page only | Done |

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
- Updated evidence dimensions: `2880 x 1800`.
- The right surface is no longer clipped by the screenshot viewport.
- File identity renders inside the right panel instead of being judged through
  a cropped square evidence artifact.

## 7. Risks

- This improves smoke evidence and adds a header guard, but it is still not a
  foreground packaged-app visual acceptance screenshot with macOS chrome.
- `short-term-preview-overview-wide.png` remains for compatibility and now
  overlaps with the default overview evidence purpose.

## 8. Next steps

- Continue visual polish using the corrected default overview smoke evidence.
- Later cleanup can decide whether `short-term-preview-overview-wide.png` is
  still useful after downstream references are checked.

## 9. Commit

- Commit: pending at review creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers:
  - A visual issue first looked like a UI overflow bug, but screenshot geometry
    showed the primary problem was evidence sizing.
- Avoidable costs:
  - Workbench-state screenshots should have used default workbench sizing from
    the moment they were introduced.
- Product lessons:
  - Evidence geometry must match the product state being judged before a UI/UX
    conclusion is drawn.
- Technical lessons:
  - Capture scenario sizing belongs in host evidence contracts and tests, not
    only in screenshot naming.
- Design / interaction lessons:
  - Right-surface visual polish needs reliable full-width evidence before
    typography or density decisions are made.
- Process lessons:
  - Inspect screenshot dimensions before treating a smoke artifact as a visual
    baseline.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: codex-goal-token-count
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: 8440934
- Token lesson: Checking screenshot geometry early prevents chasing false UI
  overflow problems.
