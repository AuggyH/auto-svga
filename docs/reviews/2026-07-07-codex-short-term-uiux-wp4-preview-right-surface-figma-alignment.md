# Review: short-term-uiux-wp4-preview-right-surface-figma-alignment

## 1. Summary

This WP4 slice applied the saved Figma dependency contracts for the short-term Preview right surface. It tightened the right panel width, header contract, two-column fact grid, metric optimization entry, asset row density, thumbnail size, and approved empty-state styling through the existing token -> atom -> component -> module layers.

No new product copy, controls, tabs, filters, or behavior were added. Figma-derived `Atom/筛选标签栏` was intentionally not implemented in this slice because exposing new active filter controls would change visible behavior beyond the current owner-approved scope.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Baseline before UI/UX implementation bundle: `75558b74 docs: record pm task retrospectives`
- Implementation commit: `70410578 uiux: refine short-term launch and right surfaces`
- Note: WP4 shares token/CSS/test files with Launch sizing and WP5 Optimization Result polish, so the implementation is intentionally committed as one UI/UX bundle while this review preserves the WP4 scope boundary.

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.atoms.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-07-codex-short-term-uiux-wp4-preview-right-surface-figma-alignment.md`
- `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Use latest PRD and design docs as authority; Figma is implementation evidence only | Done |
| 2 | Preserve owner-approved canvas-first, boundary-light direction | Done |
| 3 | Apply WP4 Figma right-surface contracts without adding unapproved copy or controls | Done |
| 4 | Keep design-system layering tokenized and componentized | Done |
| 5 | Preserve existing short-term function flow | Done by smoke and unit-style checks |
| 6 | Use real foreground desktop screenshot as primary visual evidence | Done with packaged app foreground evidence |
| 7 | Keep PM-owned PRD untouched | Done |

## 5. Verification

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:short-term:design-system-check
passed; raw dimensions remain within the current design-system guard limits
```

```
$ node --test tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
passed; 31/31 tests
```

```
$ git diff --check
passed before review/retro edits
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run desktop:smoke
passed; smoke remains regression evidence only, not final visual acceptance
```

```
$ npm --prefix tools/electron-prototype/experiments/svga-web run internal:trial:package:mac
passed; generated an unsigned internal Auto SVGA app for foreground evidence only
```

Foreground evidence:

- First tried the normal dev Electron client with real `Auto SVGA` user data and real recent SVGA records available.
- macOS Stage Manager and same-name Electron process ambiguity kept surfacing unrelated foreground apps instead of the Auto SVGA window.
- A later CoreGraphics window-list check found Auto SVGA only as a small Stage Manager thumbnail window, not as the expanded main window, so `screencapture -l` was not a usable fallback in this desktop state.
- All incorrect screenshots were deleted immediately because they contained unrelated foreground content.
- Fallback: packaged the current source as the unsigned internal `Auto SVGA.app`, launched it with the unique `Auto SVGA` app identity, opened real `战狼头像框.svga` through `文件 > 最近打开`, and captured usable foreground screenshots.
- Retained evidence:
  - `review/uiux-high-fidelity-packages/foreground-hf35-wp4-right-surface-figma-20260707/01-packaged-launch-display1.png`
  - `review/uiux-high-fidelity-packages/foreground-hf35-wp4-right-surface-figma-20260707/03-packaged-warwolf-preview-display1.png`
  - `review/uiux-high-fidelity-packages/foreground-hf35-wp4-right-surface-figma-20260707/04-packaged-warwolf-preview-window.png`

## 6. Output inspection

- Figma source used: saved packets only; no new Figma MCP call in this implementation slice.
- Right surface contract:
  - `Module/右侧栏`: `360 x 800`
  - `Atom/文件信息头部`: width `312`, title `18/26`, Save As `60 x 30`
  - `Molecule/统计信息网格`: width `280`, two columns, row gap `16`, compact labels and `15/22` values
  - `Molecule/资源列表行`: thumbnail `48`, row min height `56`, title `12/18`, detail `11/16`
  - `Molecule/缺省`: width `312`, approved copy only
- Implementation inspection:
  - Right panel component tokens now carry these sizes.
  - Atom/component/module CSS consumes tokens instead of new hardcoded one-off values.
  - Test guard checks the new token aliases and CSS usage.

## 7. Risks

- Foreground evidence is available from the packaged app route, but the screenshot also shows an external document window behind Auto SVGA. Future owner-facing evidence should keep the background cleaner when possible.
- `short-term-macos.modules.css` and `svga-web-experiment.test.mjs` also contain pre-existing parallel changes around optimization-result actions/rail styling. They were preserved and are not claimed as this WP's core change.
- The current right-surface implementation is closer to Figma contracts, but final pixel judgment should still continue through small WP-based slices instead of a broad repaint.

## 8. Next steps

- Use packaged app identity for future foreground evidence when dev-mode Electron conflicts with Stage Manager or other Electron apps.
- Continue right-surface polish in smaller WP slices if the Owner wants further pixel tightening after reviewing the packaged-app screenshots.
- Keep molecule/atom Figma contracts as the source for pixel-level implementation rather than repeating high-level module shell reads.

## 9. Commit

- Implementation commit: `70410578 uiux: refine short-term launch and right surfaces`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers:
  - Dev-mode foreground evidence initially failed because Stage Manager and same-name Electron activation made screenshot targeting unreliable.
  - A packaged-app fallback was needed to produce trustworthy foreground evidence.
  - Existing parallel changes touched the same files, requiring extra ownership separation.
- Avoidable costs:
  - For future foreground evidence, start with packaged app identity when the active desktop already contains multiple Electron apps.
- Product lessons:
  - Figma contracts can guide styling, but they do not authorize new product controls such as filters.
- Technical lessons:
  - Right-surface pixel contracts belong in token aliases plus design-system tests, not only in visual CSS.
- Design / interaction lessons:
  - The two-column fact grid and compact asset rows should remain protected because they preserve owner-approved information density.
- Process lessons:
  - A successful smoke run must remain separate from real visual acceptance; use packaged foreground evidence when dev-mode targeting is unreliable.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: use saved Figma packets and exact WP dependency contracts before attempting more Figma reads; foreground capture needs a stable activation recipe to avoid repeated screenshot retries.
