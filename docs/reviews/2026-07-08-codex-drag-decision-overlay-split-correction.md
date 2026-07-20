# Review: Drag Decision Overlay Split Correction

## 1. Summary

Updated the short-term drag-decision interaction from the prior left/right
split to an unequal top/bottom split. Open File is now the primary large target
covering about 70%-80% of the canvas and the canvas center; Add As Compare File
is a smaller secondary target covering about 20%-30%.

The correction is based on the Product Owner's observed drag habit: files are
often dragged upward from the macOS Dock/Desktop folder and released near the
center or lower-center of the app window. The previous left/right split made it
too easy to miss the decision model and accidentally enter comparison.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `d8f54572`
- Uncommitted changes before work:
  - `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
  - `docs/quality/PROJECT_TEST_ENGINEER_WORKFLOW.md`
  - `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- Untracked files before work:
  - `docs/reviews/2026-07-08-codex-local-stable-qa-regression-refresh.md`
  - `docs/reviews/2026-07-08-codex-owner-client-baseline-routing.md`

## 3. Changed files

- `DESIGN.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
- `docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md`
- `docs/reviews/2026-07-08-codex-drag-decision-overlay-split-correction.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Replace left/right drag-decision split with top/bottom split. | Done |
| 2 | Make Open File the primary target at about 70%-80% of canvas. | Done |
| 3 | Keep Add As Compare File available as smaller secondary target. | Done |
| 4 | Ensure center/lower-center drag habits do not accidentally favor compare. | Done |
| 5 | Update main PRD and subordinate UI/UX docs without creating duplicate PRD. | Done |
| 6 | Avoid runtime code changes in this PM clarification. | Done |
| 7 | Avoid staging unrelated existing dirty changes. | Done |

## 5. Verification

Commands run and results:

```text
$ rg "Open File half|Add As Compare File half|focused half|pointer-focused half|左右分区|左右半区|left/right split|left/right halves" DESIGN.md docs/product/PRODUCT_ROADMAP.md docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md
old half wording removed; remaining left/right references are explicit historical contrast only

$ git diff --check -- DESIGN.md docs/product/PRODUCT_ROADMAP.md docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md docs/product/SHORT_TERM_UI_UX_LOW_FIDELITY_IA.md docs/reviews/2026-07-08-codex-drag-decision-overlay-split-correction.md docs/retrospectives/TASK_RETRO_LEDGER.jsonl
passed

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
jsonl ok

$ node -e "parse staged docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
staged jsonl ok

$ git diff --cached --name-only | rg -i "\\.(png|jpe?g|gif|svg|svga|mp4|mov|webm|avi|psd|fig|sketch)$" || true
no staged design or media assets
```

Runtime tests are not required because this is a product/design documentation
correction only.

## 6. Output inspection

- Main PRD records the 2026-07-08 Owner correction.
- Main PRD state model and drag behavior specify unequal top/bottom zones.
- S1 evidence now requires drag-decision top/bottom primary Open zone proof and
  secondary Add Compare zone proof.
- Design brief, low-fidelity IA, and `DESIGN.md` now match the corrected
  interaction.
- Product scope is unchanged: compare still exists, but its drag target is
  deliberately secondary.

## 7. Risks

- Implementation must choose an exact visual placement that preserves the rule:
  the canvas center belongs to Open File, and comparison must not capture the
  natural lower-center drop path.
- Existing prototype code may still encode left/right hit testing and will need
  implementation follow-up.

## 8. Next steps

- Route this correction to UI/UX and short-term implementation so the overlay
  visuals, hit testing, and evidence checks are updated together.

## 9. Commit

- Commit: recorded in final handoff after commit creation
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: The prior design optimized for visible choice but not for the
  Product Owner's real drag path from the Dock/Desktop folder.
- Avoidable costs: Earlier interaction specs should have named the expected
  physical drag path and default action bias, not only the visual zones.
- Product lessons: Destructive or mode-changing drag targets should not occupy
  a high-probability casual drop area.
- Technical lessons: Hit-testing evidence should verify the center and
  lower-center points, not only the overlay appearance.
- Design / interaction lessons: When one action is much more common, the drop
  target should be visibly and physically larger.
- Process lessons: Owner daily-use friction should be promoted into the PRD
  quickly when it changes an interaction contract.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: Patch the main PRD plus the few conflicting UI/UX docs instead
  of broad-scanning or rewriting the whole short-term design package.
