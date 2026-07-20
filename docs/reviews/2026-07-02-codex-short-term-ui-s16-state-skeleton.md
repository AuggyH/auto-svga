# Short-term UI S16 State Skeleton Review

Date: 2026-07-02
Agent: Codex
Scope owner: UI/UX

## Summary

Implemented the next short-term UI skeleton slice after the basic layout was
confirmed: recent-file state for S16 and safer copy around the approved
one-click optimization batch action. This review records UI implementation
work only. Product scope remains owned by `docs/product/PRODUCT_ROADMAP.md`.

## Git State

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Working tree after implementation: source and this review file modified; not
  committed in this step.

## Changed Files

- `tools/shared/product-frontend/short-term-product-shell.html`
- `tools/shared/product-frontend/short-term-product-app.mjs`
- `tools/shared/product-frontend/short-term-product-styles.css`
- `tools/shared/product-frontend/short-term-product-shell.test.mjs`
- `docs/reviews/2026-07-02-codex-short-term-ui-s16-state-skeleton.md`

## Requirement Checks

- S16 launch recent files now render from shared recent-file state, limited to
  five rows.
- S16 `File > Recent` now renders from the same state, limited to ten rows
  inside the nested Recent submenu.
- Recent rows display filename plus parent folder only; no full local path is
  shown by default.
- Missing recent files stay on Launch and show recoverable feedback.
- Clear recent history removes launch and menu records without implying source
  file deletion.
- One-click optimization copy now states that the batch action applies only to
  safe executable items; review-only and unsupported suggestions stay outside
  the batch.

## Verification

- `node --check tools/shared/product-frontend/short-term-product-app.mjs`
- `node --test tools/shared/product-frontend/short-term-product-shell.test.mjs tools/shared/product-frontend/source-sharing.test.mjs`
- `git diff --check`
- Browser interaction check against
  `http://127.0.0.1:4191/tools/short-term-ui-preview/index.html` using local
  Chrome:
  - launch list shows 5 recent rows
  - File > Recent submenu exposes 10 rows
  - recent labels do not expose `/Users` or `~/`
  - missing recent entry shows Launch recovery feedback
  - clearing history shows launch/menu empty states
  - opening a valid recent file enters Workbench
  - one-click optimization enters comparison and reports safe-only batching

## Risks

- Recent-file persistence is still fixture-only in this UI skeleton. Formal
  implementation must bind this to real app state.
- Optimization execution is still prototype state only. Formal implementation
  must produce bytes and pass round-trip validation before enabling real saves.
- This is still low/mid-fidelity UI structure, not final visual design.

## Next Steps

- Continue high-fidelity UI system work on the confirmed skeleton.
- When implementation starts, replace fixture recent state with real recent
  file persistence and clear-history behavior.
- Replace optimization prototype state with real safe-item execution once the
  optimizer can emit validated SVGA bytes.
