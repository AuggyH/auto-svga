# QA Acceptance Scope: ASV-REQ-20260709-002

## Summary

- Requirement: `docs/product/requirements/ASV-REQ-20260709-002.md`
- Title: Short-term runtime structure risk diagnostics and safe structure optimization
- QA status: QA Acceptance / Reopened to Implementation
- QA entry condition: Packaging Ready received; owner-visible regression started against `Auto SVGA 0.1.0-alpha local`.
- Owner-visible baseline: `Auto SVGA 0.1.0-alpha local` at `/Users/huangtengxin/Applications/Auto SVGA.app`, installed build commit `ba9bfb8b335141762ee57e8d005fcd80258d6439`.
- Version / channel identity: product version `Auto SVGA 0.1.x / SVGA Preview MVP`, release stage `alpha`, distribution channel `local`.
- Package identity: source head `ba9bfb8b335141762ee57e8d005fcd80258d6439`, implementation commit `7ff1bf4a30930b6fb158a28c8727be03e07659e3`, archive SHA-256 `86969dd2df38e933a8adb03ea87ad0a38b000916cc9afe59e955f1f954139b89`.
- Version policy note: `c7144d3f docs: establish versioning release policy` is documentation-only and is not part of the installed app runtime build identity.
- PM terminology clarification: `ea1014e1 docs: clarify runtime structure terminology`
- PM disclosure clarification: `5e5ad8fa docs: refine runtime structure disclosure`
- Implementation commit: `7ff1bf4a30930b6fb158a28c8727be03e07659e3`
- Handoff/docs commit: `ba9bfb8b docs: mark runtime structure requirement ready`
- Clarification review: `docs/reviews/2026-07-09-codex-runtime-structure-ui-terminology.md`
- Implementation review: `docs/reviews/2026-07-09-codex-asv-req-002-runtime-structure-implementation.md`
- QA status report: `docs/quality/reports/ASV-REQ-20260709-002-qa-acceptance.md`
- Response expectation: Normal queue / next safe checkpoint unless PM updates urgency. Immediate interruption authorized: No.

## Acceptance Focus

QA must verify that runtime structure diagnostics are useful to a normal Preview user without exposing confusing raw protocol terms or calling runtime playback objects "layers". The right information surface may use `更多信息` for secondary diagnostics, but the default summary must expose core fields and any field that creates medium/high risk, warning copy, or an optimization candidate.

## Required UI Checks

| ID | Check | Expected result |
| --- | --- | --- |
| UI-1 | Open a runtime-structure-risk sample in Preview and inspect the right information surface. | Runtime structure risk and necessary details are visible in the Preview right information area, separate from decoded image memory. |
| UI-2 | Inspect default user-facing labels. | The UI does not show raw protocol labels such as `SpriteEntity` or `FrameEntity` in default user-facing rows. |
| UI-3 | Inspect runtime object terminology. | Sprite/runtime-object count is not translated as `图层数`, and warnings do not say `图层过多` for runtime structure risk. |
| UI-4 | Inspect recommended friendly labels. | UI uses friendly labels where applicable: `运行对象数`, `动画帧记录数`, `活跃绘制峰值/平均`, `不可见记录占比`, `序列帧展开风险`. |
| UI-5 | Inspect risk explanation copy. | Copy explains runtime structure complexity without implying the designer created excessive source/editor layers. |
| UI-6 | Inspect memory wording. | Runtime structure memory is labelled as estimated/advisory, not measured device memory. |
| UI-7 | Inspect the default summary on a normal runtime-structure card. | The default summary shows core fields: risk level, `运行对象数`, `动画帧记录数`, and estimated runtime-structure memory or risk copy. |
| UI-8 | Inspect `更多信息` availability. | Secondary or technical diagnostics may be hidden behind a `更多信息` disclosure when they do not drive risk, warning copy, or optimization candidates. |
| UI-9 | Inspect risk-field promotion. | Any field that causes medium/high risk, warning copy, or an optimization candidate is visible in the default summary, not only inside `更多信息`. |
| UI-10 | Inspect low-risk summary copy. | Low-risk files may collapse secondary details, but the summary clearly says no runtime-structure issue was detected or equivalent low-risk wording. |

## Required Disclosure State Coverage

| ID | State | Expected result |
| --- | --- | --- |
| DISC-1 | Low-risk collapsed state. | The right information surface keeps secondary details collapsed or compact, while the summary clearly communicates low/no runtime-structure risk. |
| DISC-2 | High-risk default visible state. | Medium/high risk fields are externally visible by default with risk level, `运行对象数`, `动画帧记录数`, and estimated runtime-structure memory/risk copy. |
| DISC-3 | Expanded `更多信息` state. | Expanding `更多信息` reveals secondary diagnostics without changing the meaning of the default summary or exposing raw protocol labels in user-facing copy. |
| DISC-4 | Risk-field promotion state. | A field that is normally secondary moves into the default summary when it causes warning copy, medium/high risk, or an optimization candidate. |

## Required Technical Evidence Checks

| ID | Check | Expected result |
| --- | --- | --- |
| TECH-1 | Runtime object count derivation. | Evidence can trace `运行对象数` to `MovieEntity.sprites.length` or the equivalent parsed runtime sprite count. |
| TECH-2 | Frame-record count derivation. | Evidence can trace `动画帧记录数` to `sum(sprite.frames.length)`. |
| TECH-3 | Active draw peak/average derivation. | Evidence records that `活跃绘制峰值/平均` is calculated by counting visible runtime sprites per frame, with the active visibility threshold named. |
| TECH-4 | Invisible ratio derivation. | Evidence records the invisible-record numerator/denominator and distinguishes generic alpha-zero invisibility from target-player low-alpha pruning thresholds. |
| TECH-5 | Sequence fanout risk derivation. | Evidence explains how repeated sequence-frame image keys or sequence-like runtime object groups were detected. |
| TECH-6 | Runtime memory estimate boundary. | Evidence labels runtime structure memory as an estimate and records the high-level calculation or calibration source. |

## Required Optimization Checks

| ID | Check | Expected result |
| --- | --- | --- |
| OPT-1 | Safe all-zero pruning path. | If applicable, safe all-zero sprite/frame pruning produces validated SVGA bytes with before/after runtime-structure metrics. |
| OPT-2 | Newly unreferenced cleanup path. | If pruning creates newly unreferenced images/resources, cleanup is included or clearly reported. |
| OPT-3 | Save gating. | Save As / Overwrite are enabled only after output validation and net-effect proof. |
| OPT-4 | Risky method classification. | Target-player low-alpha pruning, FPS resampling, sequence-fanout pruning, and rebake/collapse are review-only or hidden unless target profile and playback equivalence are validated. |

## Sample Expectations

- Include at least one high-fanout runtime-structure sample, preferably the documented lucky-notice supplemental aliases or a synthetic equivalent.
- Include at least one low-risk contrast file.
- Keep production SVGA, optimized outputs, screenshots, videos, and generated runtime artifacts local-only.

## Failure Routing

| Observation | Route |
| --- | --- |
| Runtime structure risk is missing from the Preview right information surface. | Short-term Main Engineer primary; UI/UX Owner secondary if layout/hierarchy is the blocker. |
| Default UI exposes `SpriteEntity` / `FrameEntity` or calls runtime sprites `图层`. | UI/UX Owner primary for terminology; Short-term Main Engineer primary if data binding forces wrong labels. |
| Default summary omits risk level, `运行对象数`, `动画帧记录数`, or estimated runtime-structure memory/risk copy. | UI/UX Owner primary for hierarchy; Short-term Main Engineer primary if model data is unavailable. |
| A risk-causing field is hidden only behind `更多信息`. | Short-term Main Engineer primary; UI/UX Owner secondary for disclosure hierarchy. |
| Low-risk collapsed state does not clearly communicate low/no runtime-structure risk. | UI/UX Owner primary. |
| Technical evidence cannot trace metric derivation. | Short-term Main Engineer primary. |
| Estimated runtime memory is presented as measured device memory. | Short-term Main Engineer primary; PM if acceptance wording is ambiguous. |
| Unsafe target-player-specific optimization is executable by default. | Short-term Main Engineer primary; PM copied for risk boundary. |

## Current Status

QA accepted Packaging Ready and started owner-visible baseline regression. Packaging is no longer the blocker. QA package inspection found the friendly runtime-structure labels and technical evidence refs present, but failed DISC-3 because the installed right-panel renderer lacks a `更多信息` expanded disclosure state and drops non-risk secondary diagnostics. Linked defect: `docs/quality/tickets/ASV-QA-20260709-002.md`. See `docs/quality/reports/ASV-REQ-20260709-002-qa-acceptance.md`.
