# Review: short-term optimization row polish

## 1. Summary

This round polished the short-term macOS client's `OptimizationFindingRow`
visual treatment.

The row now uses a restrained status strip plus existing status badge instead
of making the full row read like a high-intensity warning card. Product copy,
optimization grouping, action enablement, and output behavior are unchanged.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `926a20ad`
- Uncommitted changes before this review: one component CSS file
- Untracked files before this review: none observed

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.components.css`
- `docs/reviews/2026-07-04-codex-short-term-optimization-row-polish.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Do not change product scope, optimization logic, or visible copy. | Done |
| 2 | Keep the optimization row under the existing component system. | Done |
| 3 | Preserve review-only status visibility without over-emphasizing the whole row. | Done |
| 4 | Keep visual values token-based and pass the design-system gate. | Done |
| 5 | Do not claim foreground UI/UX acceptance from smoke evidence. | Done |

## 5. Verification

```text
npm run desktop:short-term:design-system-check
passed

npm run desktop:smoke
passed
```

## 6. Output inspection

- Smoke screenshot inspected:
  `.artifacts/product/short-term/short-term-preview-optimization.png`
- Optimization rows now use ordinary row border/background strength with a
  colored status strip and existing badge for review-only status.
- Foreground macOS validation: not performed in this slice.

## 7. Risks

- Automated smoke still uses fixture material and does not replace real
  foreground macOS screenshots with production SVGA files.
- Further polish is still needed across spacing, typography, panel rhythm, and
  real-file states.

## 8. Next steps

- Continue with another narrow component-level polish slice, preferably after
  foreground review of real production SVGA files.

## 9. Commit

- Commit: pending in this task commit
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
