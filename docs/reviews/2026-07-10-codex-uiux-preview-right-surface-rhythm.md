# Review: UI/UX Preview Right Surface Rhythm

## 1. Summary

Aligned the Preview default right information surface with the existing R7/R10 Figma contracts at the token and module level.

This WP restores the lightweight file-header divider from the right-surface module contract and moves section header/list spacing from generic spacing values into right-surface-specific tokens. It does not add product copy, controls, status labels, menu entries, or new behavior.

## 2. Git state

- Branch: `codex/uiux-redesign-20260710`
- Commit before work: `c33723c6 fix(uiux): align compare row order`
- Uncommitted changes before commit: Preview right-surface CSS/tokens/checks/tests only
- Untracked files: none

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-10-codex-uiux-preview-right-surface-rhythm.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Keep `PRODUCT_ROADMAP.md` as product authority and do not redefine scope | Done |
| 2 | Use existing Figma R7/R10 packets instead of another MCP read | Done |
| 3 | Preserve canvas-first, low-boundary Preview direction | Done |
| 4 | Do not add visible copy, labels, states, or controls | Done |
| 5 | Keep visual values tokenized and component-traceable | Done |
| 6 | Keep validation bundled to the page-state WP, not every tiny style edit | Done |

## 5. Verification

```bash
$ npm run desktop:short-term:design-system-check
passed

$ node --test --test-name-pattern "short-term visual design system|short-term general compare|short-term asset filters" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
first attempt: blocked before tests by missing local protobufjs in this worktree

$ node --test --test-name-pattern "short-term visual design system|short-term general compare|short-term asset filters" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed: 4/4 after temporarily reusing the main checkout ignored node_modules symlink

$ git diff --check
passed
```

Temporary ignored `tools/electron-prototype/node_modules` symlink was created only for the focused test run and removed afterward. No lockfile, dependency declaration, or committed dependency file changed.

## 6. Output inspection

- `--asv-component-right-panel-header-divider` now aliases the existing right-panel section divider.
- `--asv-component-right-section-head-padding-block-end` and `--asv-component-right-section-list-margin-block-start` make Preview section rhythm traceable to right-surface tokens.
- `.rightSurfaceHeader` now uses `border-bottom: var(--asv-right-panel-header-divider)`.
- `.sectionHead` and the right-surface lists now use the new spacing aliases instead of generic local spacing.
- Design-system checks now guard these token and module bindings.

## 7. Risks

- This is a low-risk visual rhythm correction; it does not include packaged app promotion or foreground desktop screenshot acceptance.
- The visible result should still be reviewed later as part of a larger Preview page-state owner-visible batch with real foreground screenshots.

## 8. Next steps

- Continue page-state polish from broad to fine: Preview playback control rhythm and Compare/Edit page-state alignment should use the same token/component/page-state triangulation.
- Defer packaging and local-stable refresh until multiple owner-visible UI/UX polish slices are bundled.

## 9. Commit

- Commit: this commit; final hash is reported in handoff.
- Branch: `codex/uiux-redesign-20260710`
- Tag: none

## 10. Project retrospective

- Value assessment: Medium
- Cost drivers: missing local dependency in this isolated worktree forced a temporary ignored symlink for focused tests.
- Avoidable costs: right-surface header divider and section rhythm should have been tokenized during the initial R7 implementation rather than left as generic spacing.
- Product lessons: Figma alignment can improve Preview readability without changing product capability or copy.
- Technical lessons: page-state rhythm needs token/check coverage, not only visual CSS edits.
- Design / interaction lessons: subtle dividers are acceptable when they belong to the module rhythm and do not turn the surface into boxed cards.
- Process lessons: use existing Figma read packets for known contracts; avoid new MCP calls for already-captured geometry.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: bundled page-state validation is cheaper than repeating a full task cycle for each neighboring 4px style adjustment.
