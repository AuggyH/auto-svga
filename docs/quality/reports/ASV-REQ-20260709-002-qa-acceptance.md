# QA Acceptance Report: ASV-REQ-20260709-002

## Result

- QA result: Failed - Reopened to Implementation
- Requirement: `docs/product/requirements/ASV-REQ-20260709-002.md`
- Acceptance scope: `docs/quality/reports/ASV-REQ-20260709-002-qa-acceptance-scope.md`
- Linked QA defect: `docs/quality/tickets/ASV-QA-20260709-002.md`
- Tester: Project Test Engineer / QA
- Date: 2026-07-09
- Status note: Packaging Ready was received and the owner-visible app now contains implementation commit `7ff1bf4a30930b6fb158a28c8727be03e07659e3`. QA began owner-visible baseline regression and failed the right-panel disclosure gate: the installed package lacks the required `更多信息` expanded state for secondary runtime-structure diagnostics.

## Version / Channel Identity

- Product version: `Auto SVGA 0.1.x / SVGA Preview MVP`
- Release stage: `alpha`
- Distribution channel: `local`
- Owner-visible label: `Auto SVGA 0.1.0-alpha local`
- Installed app path: `/Users/huangtengxin/Applications/Auto SVGA.app`
- Runtime build identity: source head `ba9bfb8b335141762ee57e8d005fcd80258d6439`; implementation commit `7ff1bf4a30930b6fb158a28c8727be03e07659e3`; archive SHA-256 `86969dd2df38e933a8adb03ea87ad0a38b000916cc9afe59e955f1f954139b89`
- Packaging manifests: `.artifacts/local-stable-app/qa-regression-refresh-20260709-asv-req-002/validation-summary.json`, `package-internal-trial-manifest.json`, `promotion-manifest.json`
- Packaging review: `docs/reviews/2026-07-09-codex-local-stable-asv-req-002-refresh.md`
- Policy note: `c7144d3f docs: establish versioning release policy` is documentation-only and applies to reporting vocabulary; it is not part of the installed app runtime build identity.

## Implementation Handoff Received

- Implementation status: Implementation Ready
- Branch: `agent/codex/short-term-preview-qa-20260708`
- Implementation commit: `7ff1bf4a30930b6fb158a28c8727be03e07659e3`
- Handoff/docs commit: `ba9bfb8b docs: mark runtime structure requirement ready`
- Implementation review: `docs/reviews/2026-07-09-codex-asv-req-002-runtime-structure-implementation.md`
- Owner-visible packet: `review/asv-req-20260709-002-runtime-structure-7ff1bf4/REVIEW_PACKET.md`

## Owner Validation Summary

- `npm run build`: PASS
- Targeted runtime/optimizer/product tests: PASS, 19/19
- `npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test`: PASS, 37/37 after allowing local `127.0.0.1` listener.

QA has not re-run these checks in the owner-visible app. They are recorded as owner-provided implementation evidence.

## Owner-Visible Baseline Gate

- Required QA baseline: `Auto SVGA 0.1.0-alpha local` at `/Users/huangtengxin/Applications/Auto SVGA.app`
- Current installed app build observed by QA: `ba9bfb8b335141762ee57e8d005fcd80258d6439`
- Required implementation commit: `7ff1bf4a30930b6fb158a28c8727be03e07659e3`
- Current gate result: Passed for packaging identity. The installed owner-visible app includes the implementation commit through source head `ba9bfb8b335141762ee57e8d005fcd80258d6439`.
- Packaging route: Packaging Ready received from Release/Packaging Owner thread `019f1924-bed6-7923-88f4-82267e3be8dd` on 2026-07-09.

## QA Package Inspection Evidence

- Evidence type: Non-foreground owner-visible package inspection.
- Evidence source: `/Users/huangtengxin/Applications/Auto SVGA.app/Contents/Resources/app.asar`, locally extracted to `/tmp/auto-svga-qa-req002-extract` for inspection only.
- Build info: extracted `.runtime/build-info.json` reports `buildCommit=ba9bfb8b335141762ee57e8d005fcd80258d6439`.
- Friendly label check: packaged product model contains `运行时结构`, `运行对象数`, `动画帧记录数`, `活跃绘制峰值/平均`, `不可见记录占比`, and `序列帧展开风险`.
- Terminology check: packaged right-panel renderer/model files inspected by QA did not contain `SpriteEntity`, `FrameEntity`, `图层数`, or `图层过多`; packaged product model keeps `FrameEntity.alpha` only as a technical evidence reference.
- Disclosure failure: packaged `web/short-term-macos-overview-renderers.mjs` has no `createOverviewMoreInfoDisclosure`, `RuntimeStructureMoreInfo`, `factMoreInfo`, or `更多信息`.
- Disclosure failure: packaged `web/short-term-macos-render-model.mjs` exports `overviewVisibleFacts`, not `overviewFactGroups`; non-risk `moreInfo` facts are dropped instead of being available in an expanded disclosure.

## Planned QA Acceptance Checks

| Check | Status | Notes |
| --- | --- | --- |
| Runtime structure and decoded image memory are displayed separately. | Package gate partial pass | Runtime-structure product facts are present in the installed package. Foreground UI proof is not complete because the disclosure gate already failed. |
| Default UI avoids `SpriteEntity` / `FrameEntity` raw names. | Package gate pass | Renderer/model files inspected for default right-panel UI do not contain raw protocol labels. Technical evidence references may still contain `FrameEntity.alpha`. |
| Runtime sprite count is not labelled `图层数`, and risk copy does not say `图层过多`. | Package gate pass | Runtime-structure product model does not contain these bad user-facing terms. |
| Default summary shows risk level, `运行对象数`, `动画帧记录数`, and estimated runtime-structure memory/risk copy. | Package gate partial pass | Product model contains required summary labels and risk copy. Foreground UI not completed because disclosure gate failed first. |
| Low-risk collapsed, high-risk default visible, expanded `更多信息`, and risk-field promotion states are covered. | Failed | Installed package lacks the `更多信息` expanded state. Warning/fail `moreInfo` fields are promoted, but non-risk secondary diagnostics are dropped rather than expandable. |
| High-fanout / modest decoded-memory sample warns correctly. | Not run | Use local-only lucky-notice aliases or synthetic equivalent. |
| Safe all-zero pruning output validates decode/reopen, source immutability, before/after `运行对象数` / `动画帧记录数`, and Save As / overwrite gating. | Not run | Output artifacts stay local-only. |
| No-benefit optimization remains unsaveable. | Not run | Deferred until right-panel disclosure gate is fixed and repackaged. |
| Low-alpha pruning, FPS resampling, sequence-fanout pruning, and rebake/collapse remain review-only or hidden. | Not run | Deferred until right-panel disclosure gate is fixed and repackaged. |

## Required Samples

- High-fanout runtime-structure sample: documented lucky-notice supplemental aliases or synthetic equivalent.
- Low-risk contrast file: a small real SVGA from the local test-material library or synthetic equivalent.
- Raw asset handling: local-only. Do not commit production SVGA, screenshots, videos, optimized output SVGA, generated parser dumps, or local runtime artifacts.

## Reopen Routing

- Blocking owner: Short-term Main Engineer
- Linked defect: `ASV-QA-20260709-002`
- Requested action: Add the `更多信息` or equivalent expanded secondary-details state to the owner-visible right information surface while preserving default risk-field promotion and friendly terminology.
- Response expectation: High priority, normal queue / next safe checkpoint. Immediate interruption authorized: No.
- Owner response: Accepted By Owner. Short-term Main Engineer accepted the repair and confirmed they will not close the QA ticket directly.
- Expected callback: `Fix Ready`, with fix commit, fix report, callback evidence, validation summary, skipped checks/limitations, and packaging needs.
- Routing note: QA remains lifecycle owner and will re-run ASV-REQ-20260709-002 acceptance after the repaired owner-visible package is promoted.

## Closure Decision

- Close requirement: No
- Reopen implementation owner: Yes
- Remaining limitation: Foreground UI and real-material optimization checks have not been completed because the installed package failed the disclosure gate first.
- Follow-up ticket: `docs/quality/tickets/ASV-QA-20260709-002.md`
