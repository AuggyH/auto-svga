# Review: runtime-structure-ui-terminology

## 1. Summary

Clarified that short-term runtime structure diagnostics must appear in the
Preview right information surface with user-facing labels, that SVGA
`SpriteEntity` must not be translated as `图层`, and that technical evidence
should record baseline calculation methods for each metric. Also clarified the
right-information disclosure policy: secondary fields may live behind
`更多信息`, but any risk-causing field must be visible by default.

## 2. Git state

- Branch: `agent/codex/short-term-preview-qa-20260708`
- Commit before work: `f031a2e5`
- Uncommitted changes: existing unrelated distribution, QA workflow, QA intake,
  and local-stable review files were already present.

## 3. Changed files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/requirements/ASV-REQ-20260709-002.md`
- `docs/reviews/2026-07-09-codex-runtime-structure-ui-terminology.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Make right-information-surface display explicit for runtime structure diagnostics. | Done |
| 2 | Define friendly labels for runtime structure metrics. | Done |
| 3 | Separate designer/editor layers from SVGA runtime sprites. | Done |
| 4 | Add baseline calculation guidance for runtime object count, frame-record count, active visible counts, invisible ratio, sequence fanout risk, and estimated structure memory. | Done |
| 5 | Allow secondary diagnostics behind `更多信息` while requiring risk-causing fields to stay visible. | Done |
| 6 | Avoid source/runtime code changes. | Done |

## 5. Verification

Commands run and results:

```bash
git diff --check
```

Result: PASS.

```bash
node -e "...parse docs/retrospectives/TASK_RETRO_LEDGER.jsonl..."
```

Result: PASS.

## 6. Output inspection

- Default user-facing UI should avoid `SpriteEntity` and `FrameEntity`.
- Recommended labels include `运行对象数`, `动画帧记录数`,
  `活跃绘制峰值/平均`, `不可见记录占比`, and `序列帧展开风险`.
- `图层` remains reserved for designer/editor layers.
- Technical evidence should calculate `运行对象数` from parsed runtime sprites
  and `动画帧记录数` from the sum of sprite frame-state records.
- `更多信息` can hold secondary diagnostics, but the default summary must show
  the field that explains the current warning or optimization candidate.

## 7. Risks

- Short-term implementation must update UI labels and QA proof, not only parser
  report fields.
- Technical reports may still include protocol names for traceability.

## 8. Next steps

- Route the clarification to Short-term Main Engineer, UI/UX, and QA.

## 9. Commit

- Commit: this commit, `docs: clarify runtime structure terminology`
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Prior iterations conflated SVGA runtime sprites with visual
  layers, so the requirement needed explicit terminology boundaries.
- Avoidable costs: Add user-facing labels and technical/report labels together
  when introducing low-level diagnostics.
- Product lessons: Performance diagnostics need friendly UI language while
  preserving technical traceability in reports.
- Technical lessons: SVGA sprite/frame structures are runtime export artifacts,
  not source authoring layers; runtime structure counts should be derived from
  decoded SVGA records rather than inferred from asset count.
- Design / interaction lessons: Right-panel metrics should explain why a file
  is risky without blaming the designer for creating thousands of layers; risk
  facts should not be hidden behind optional detail disclosure.
- Process lessons: Clarify terminology before implementation begins.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 11. Token usage

- Source: unavailable
- Input tokens:
- Cached input tokens:
- Output tokens:
- Reasoning output tokens:
- Total tokens:
- Token lesson: A targeted terminology patch prevents repeated UI, QA, and
  implementation disagreement.
