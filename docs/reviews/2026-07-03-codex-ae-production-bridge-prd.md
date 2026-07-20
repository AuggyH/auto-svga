# Review: AE Production Bridge PRD Update

## 1. Summary

Promoted the AE to Auto SVGA production bridge from long-term candidate to
Owner-confirmed committed product mainline.

The update records that this bridge serves current human designers and team
production workflow, has higher near-term priority than ComfyUI, external AI,
multimodal generation, or agent-driven automatic design, and may schedule ahead
of parts of the mid-term template-editing line without canceling that line.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Product-doc changes only were made for this task.
- No runtime code, UI files, generated assets, real SVGA, images, or video
  files were changed by this task.

## 3. Changed product files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/AE_BRIDGE_PRODUCT_BRIEF.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
- `docs/product/ROADMAP_UI_CAPACITY_MAP.json`
- `docs/product/auto-svga-backlog.md`
- `docs/reviews/2026-07-03-codex-ae-production-bridge-prd.md`
- `docs/reviews/2026-07-03-codex-mid-term-implementation-prep.md`

## 4. Requirement checks

| Requirement | Status |
| --- | --- |
| Make AE bridge a must-do product capability | Done |
| Prioritize AE bridge above ComfyUI/AI/multimodal generation | Done |
| Preserve existing mid-term M1-M5 work instead of canceling it | Done |
| Define AE bridge feature scope, interaction model, compatibility policy, and acceptance matrix | Done |
| Clarify boundaries with direct source-project import and AI generation | Done |
| Keep `PRODUCT_ROADMAP.md` as the sole PRD authority | Done |
| Add subordinate documentation without creating a duplicate PRD | Done |

## 5. Output inspection

- Main PRD now has an `AE Production Bridge: AE To Auto SVGA Pipeline` section.
- AE bridge brief defines package handoff, native subset, unsupported feature
  handling, bake planning, replaceable protection, compatibility tiers, work
  packages, and relationship to mid-term/AI work.
- Backlog now states AE bridge is no longer a backlog candidate.
- UI capacity map reserves bridge regions and marks ComfyUI/agent generation as
  deferred after AE bridge and explicit AI approval.

## 6. Verification

Commands run:

```bash
git diff --check
python3 -m json.tool docs/product/ROADMAP_UI_CAPACITY_MAP.json
```

Results:

- `git diff --check`: passed.
- `ROADMAP_UI_CAPACITY_MAP.json`: parses as valid JSON.

## 7. Risks

- AE version and OS compatibility will be the highest implementation risk.
  Claims must be backed by real macOS/Windows and AE version cells.
- The bridge must not promise arbitrary AE-to-SVGA lossless conversion. Bake,
  degrade, block, and suggestion-only outcomes are first-class product states.
- File-size and decoded-memory risk may still make some valid AE outputs
  unsuitable for production SVGA.
- The bridge should start with a local file/folder package handoff before
  relying on localhost, socket, or deep-link integration.

## 8. Next steps

1. Run AEB-WP0 team inventory for OS versions, AE versions, and representative
   AE projects.
2. Draft the `ae-export-package` schema and fixture importer.
3. Build a thin `.jsx` scan/export prototype before modern panel UI.
