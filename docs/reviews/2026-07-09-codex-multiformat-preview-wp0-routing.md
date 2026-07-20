# Review: multiformat-preview-wp0-routing

## 1. Summary

Captured the Product Owner's VAP/Lottie continuation request as the planned
`Auto SVGA 0.2.x / Multi-format Preview MVP` track and created the first
implementation handoff ticket for `0.2.0-alpha.1` WP0.

## 2. Git state

- Branch: agent/codex/short-term-preview-qa-20260708
- Commit before work: not captured before edits
- Uncommitted changes: pre-existing dirty files in QA, retrospective, and
  short-term implementation areas were not touched
- Untracked files: pre-existing packaging review files were not touched

## 3. Changed files

- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/reviews/2026-07-09-codex-multiformat-preview-wp0-routing.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Review yesterday's VAP/Lottie discussion and current project position. | Done |
| 2 | Keep current `0.1.x` SVGA Preview MVP isolated from visible VAP/Lottie scope. | Done |
| 3 | Turn confirmed multi-format work into a traceable requirement ticket. | Done |
| 4 | Avoid committing or referencing raw production assets. | Done |

## 5. Verification

Commands run and results:

```text
Read product documentation system, version policy, product roadmap excerpts,
multi-format architecture, VAP research note, format contracts, and capability
baselines.
```

Runtime validation was not run because this task only updates product planning
and routing docs.

## 6. Output inspection

- Product version target: `Auto SVGA 0.2.0-alpha.1`
- Current owner-visible app remains: `Auto SVGA 0.1.0-alpha local`
- Visible multi-format support in `0.1.x`: prohibited
- First deliverable: readiness and adapter spike, not full playback support

## 7. Risks

- A dedicated `0.2 Multi-format Main Engineer` lane still needs to be assigned
  before implementation can be truly routed.
- Dependency review must be refreshed before adding `lottie-web`, Tencent VAP
  code, video tooling, or codec-related packages.
- Fixture strategy must avoid committing confidential production motion assets.

## 8. Next steps

- Assign or create the `0.2 Multi-format Main Engineer` lane.
- Route `ASV-REQ-20260709-003` to that owner.
- Have the implementation owner produce the WP0 dependency review, fixture
  plan, adapter inventory, and work-package split.

## 9. Commit

- Commit: pending
- Branch: agent/codex/short-term-preview-qa-20260708
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Needed to re-anchor multi-format work against PRD, version
  policy, architecture, and current `0.1.x` guardrails.
- Avoidable costs: Avoid starting implementation before the version and
  requirement ticket exists.
- Product lessons: Multi-format work should use `0.2.x` naming immediately;
  "short-term plus" wording is too easy to confuse with the frozen `0.1.x`
  baseline.
- Technical lessons: Existing `MotionFormat` and capability baselines are the
  right starting point; player dependencies should remain outside the app until
  reviewed.
- Design / interaction lessons: Do not expose format-selection UI before the
  parser/player/asset model can make truthful support claims.
- Process lessons: Confirmed Owner feature requests need an `ASV-REQ` before
  implementation handoff.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: Use the existing roadmap, version policy, and architecture note
  as the context spine instead of rescanning all historical VAP/Lottie chat.
