# Review: QA003 Text Replacement Scope Clarification

## 1. Summary

Clarified QA ticket `ASV-QA-20260708-003` in the main PRD. Short-term S13 now
explicitly includes designer-named raster/imageKey placeholders with text
semantics, such as `text1`, `text2`, `from`, and `to`, as runtime dynamic text
preview targets.

The clarification keeps detection deterministic: no OCR, visual recognition,
external AI, or artwork-content guessing. Text edits remain runtime preview
only and do not create dirty SVGA bytes; only key rename follows the S11/S14
dirty/save path.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `01dc71eb`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/reviews/2026-07-08-codex-qa003-text-replacement-scope-clarification.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Clarify whether `text1` / `text2` raster imageKeys are short-term text targets. | Done |
| 2 | Define detection evidence. | Done |
| 3 | Define fallback behavior. | Done |
| 4 | Define persistence and dirty/save boundary. | Done |
| 5 | Keep PRD authority single-source. | Done |
| 6 | Avoid runtime/UI code changes in the PM lane. | Done |

## 5. Verification

Commands run and results:

```text
$ git diff --check
passed

$ node -e "parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl"
jsonl ok
```

Runtime tests are not required because this is a product-documentation
clarification.

## 6. Output inspection

- S7 now requires text-semantic imageKeys to split into the text group.
- S13 now covers runtime text preview against target imageKey for both runtime
  metadata and deterministic text-like imageKey names.
- Replaceable Element Definition now names deterministic text-target detection,
  unsupported fallback, no OCR/AI, and byte-immutability.
- Replaceable Elements Surface now prevents text rows from exposing image-only
  actions.
- Sample matrix now covers runtime text metadata and text-semantic imageKeys.

## 7. Risks

- Hardcoded text-like key semantics can miss team-specific words until M25 adds
  configurable whitelist/blacklist rules.
- Runtime text preview still depends on the current player bridge correctly
  applying dynamic text objects before playback or remounting when needed.

## 8. Next steps

- QA should update `ASV-QA-20260708-003` from PM clarification to route the fix
  to the Short-term Main Engineer, with UI/UX as secondary if row presentation
  needs design adjustment.

## 9. Commit

- Commit: recorded in final handoff after commit creation
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: The term "runtime text" was ambiguous because SVGA dynamic
  text is keyed by imageKey, while the UI had separate imageKey and runtime
  text groups.
- Avoidable costs: Future PRD text should say whether a UI group is based on
  file metadata, runtime API capability, or naming semantics.
- Product lessons: Text-like raster placeholders are product text targets when
  the designer names them that way; the app should not require OCR or hidden
  metadata to honor that workflow.
- Technical lessons: Classification evidence must be explicit so QA can tell
  whether a row is text, image, automatic, or ambiguous.
- Design / interaction lessons: Text rows should not show image-only actions,
  even when the underlying SVGA target is technically an imageKey.
- Process lessons: Routing product ambiguity through QA avoided an
  implementation owner silently choosing the wrong scope.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: A narrow PRD clarification plus QA callback criteria is cheaper
  than letting implementation and UI/UX separately infer text replacement
  behavior.
