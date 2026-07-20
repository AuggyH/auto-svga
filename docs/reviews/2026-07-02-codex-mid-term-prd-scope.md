# Review: Mid-term PRD Scope Update

## 1. Summary

Expanded the authoritative product roadmap from a short mid-term direction note
into a concrete mid-term PRD section for the template-based SVGA motion editing
line.

After follow-up product research and Owner clarification, the update also adds
mid-term implementation-readiness contracts for edit sessions, template
parameter schemas, mirror references, blend-mode output, baked-effect budgets,
semantic confidence, wing joint estimation, audio export exclusion, undo/redo
scope, compile invariants, verification fixtures, and temporary asset privacy.

The update keeps `docs/product/PRODUCT_ROADMAP.md` as the single project-level
PRD authority. No separate mid-term PRD was created.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `400b2310 test: cover save as unicode aliases`
- Uncommitted changes before work: none in tracked files
- Pre-existing untracked files: `docs/research/figma-make-short-term-uiux-prompt.md`

## 3. Changed files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/ROADMAP_UI_CAPACITY_MAP.json`
- `docs/product/auto-svga-backlog.md`
- `docs/reviews/2026-07-02-codex-mid-term-prd-scope.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Record mid-term feature scope in the main PRD authority | Done |
| 2 | Split mid-term into dependency-aware sub-versions | Done |
| 3 | Capture transform, curves, templates, blend modes, displacement, particles, semantic analysis, mirror layers, audio, specs, and sequence repair | Done |
| 4 | Preserve no-free-keyframe/no-small-AE boundary | Done |
| 5 | Keep long-term AI, multi-format, unordered asset assembly, and waveform editing out of mid-term | Done |
| 6 | Avoid creating duplicate PRD documents | Done |
| 7 | Clarify mirror axis/center behavior from Owner input | Done |
| 8 | Add implementation-readiness contracts for major mid-term ambiguity areas | Done |

## 5. Verification

Commands run:

```bash
git diff --check
python3 -m json.tool docs/product/ROADMAP_UI_CAPACITY_MAP.json
```

Results:

- `git diff --check`: passed.
- `ROADMAP_UI_CAPACITY_MAP.json` parses as valid JSON.

## 6. Output inspection

- PRD scope: mid-term is now M1-M26 with sub-version plan, interaction model,
  output/evidence rules, acceptance matrix, and non-goals.
- Product contracts: mid-term now has explicit readiness contracts for edit
  session, template parameters, mirror references, blend modes, baked budgets,
  semantic confidence, wing joints, audio export, history scope, compile
  invariants, fixtures, and temporary asset privacy.
- Backlog authority: `auto-svga-backlog.md` now points committed mid-term scope
  back to the main roadmap.
- Capacity map: `multi_format_workbench` moved from Mid-term to Long-term to
  match the main PRD.

## 7. Risks

- The mid-term scope is much larger than the short-term release; it should be
  scheduled by M1-M5 rather than attempted as one milestone.
- Baked displacement, light, and particle outputs may increase file size and
  decoded memory; implementation must expose those risks before save.
- Wing joint estimation is deterministic and should fail to user review when
  confidence is low.
- The PRD intentionally keeps durable edit-session sidecar/project files out of
  committed mid-term scope unless Product Owner promotes that capability later.

## 8. Next steps

- Turn M1 into an implementation plan after short-term UI/UX and main-program
  integration stabilize.
- Audit existing MVP transform/export primitives before rebuilding edit-mode
  math from scratch.

## 9. Commit

- Commit: included in `docs: expand mid-term product roadmap`
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none
