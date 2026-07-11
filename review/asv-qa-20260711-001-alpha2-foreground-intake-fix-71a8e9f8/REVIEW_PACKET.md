# ASV-QA-20260711-001 Alpha2 Foreground Intake Fix

## Status

- State: Fix Ready / QA Regression And Packaging Rebuild Required
- Requirement: ASV-REQ-20260709-003
- Defect: ASV-QA-20260711-001
- Branch: `codex/0.2-alpha2-foreground-intake-fix`
- Source fix commit: `71a8e9f83b5ae10cb60a12822eed09e377e759cd`
- Base package source: `421b083b93f4deacb2cb18c8ad6f7a042990b7f3`

## Root Cause

The installed alpha2 package had correct version/build metadata and runtime dependencies, but the packaged runtime did not bind Electron startup to `0.2-multiformat-preview`. Without `AUTO_SVGA_PRODUCT_MILESTONE` in the installed app launch environment, `main.cjs` defaulted to `short-term`, leaving the installed app on the SVGA-only bridge/menu path.

## Fix

- `package-internal-trial.mjs` writes `productMilestoneId: "0.2-multiformat-preview"` to `.runtime/build-info.json`.
- `main.cjs` reads that build-info marker only when `app.isPackaged` and no explicit environment override is present.
- Formal non-packaged/default runs still fall back to `short-term`.
- Existing 0.1 direct multi-format IPC guards remain before host side effects.

## Validation

- `npm run build`: PASS.
- Focused package/mode/preload/IPC tests: PASS 6/6.
- `npm run test:all`: PASS 524/524.
- `git diff --check`: PASS.
- Package/lock drift scan: PASS, none.
- Production media/archive changed-file scan: PASS, none.

## Reports

- Owner fix report: `docs/quality/reports/ASV-QA-20260711-001-fix.md`
- Implementation review: `docs/reviews/2026-07-11-codex-asv-qa-20260711-001-alpha2-foreground-intake-fix.md`
- Requirement handoff: `docs/product/requirements/ASV-REQ-20260709-003.md`

## Boundaries

- Installed `/Users/huangtengxin/Applications/Auto SVGA.app` was not modified.
- No foreground launch, package generation, package promotion, owner material open, save, export, conversion, production asset commit, or product support claim was performed.
- QA foreground regression requires a rebuilt/reinstalled candidate from this source.
