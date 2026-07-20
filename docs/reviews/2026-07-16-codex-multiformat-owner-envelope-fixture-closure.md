# Multi-format Owner Envelope Fixture Closure

Date: 2026-07-16

Branch: `codex/0.2-task-fixture-owner-envelope-20260716`

Base source: `5d3be93149aa2875acaa53cef2cee06e0788d537`

Final source: the commit containing this review; the exact hash is reported in the PM/A0 handoff.

## Outcome

Fix Ready for PM/A0 independent review and Code Review routing.

This source-only P3/P4 milestone makes the task-owned external-image Lottie and fusion-capable VAP oracle consume the same branded `OwnerRightPanelSnapshotV1` envelope that drives the owner-visible right surface. It does not provide Electron pixel evidence or installed acceptance.

## Product Authority

- `docs/product/PRODUCT_ROADMAP.md` MF3-MF5 authorize local Lottie/VAP preview, format facts, asset/fusion display, and runtime replacement/reset without persistent save/export.
- `docs/product/requirements/ASV-REQ-20260709-003.md` AC4 and AC8-AC10 require safe external-resource/fusion fixtures, truthful owner-visible inventory, replacement/reset, privacy, and retained SVGA behavior.
- No new format, dependency, persistent editing, conversion, export, or UI styling scope was introduced.

## Failure-First Evidence

The strengthened source oracle failed on exact base `5d3be931` with:

`Owner inventory groups drifted: vap_fusion_images,vap_fusion_texts,audio_video_media,unsupported_or_missing,other_resources`

Readback showed the same VAP text fusion public target in both `vap_fusion_texts` and `other_resources`, while four technical missing-fusion issues canonicalized to the same owner-visible message. The previous oracle used projected `model.rightPanel` fields without independently validating the branded envelope source binding, byte length, digest, format, target uniqueness, or group projection.

## Changed

- `src/workbench/owner-right-panel-snapshot.ts`
  - removes VAP fusion records from generic asset projection when a format-specific fusion target owns the same public resource identity;
  - deduplicates equivalent fixed owner-visible issues after technical details are redacted.
- `src/tests/multiformat-owner-preview-candidate.test.ts`
  - proves external Lottie owner groups and image/text targets;
  - proves VAP fusion image/text targets appear once, generic duplicate assets are absent, and equivalent owner issue copy is emitted once.
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-task-fixture-source-oracle.cjs`
  - validates source-bound branded snapshot byte length and digest;
  - obtains public replacement targets from the snapshot envelope;
  - rejects duplicate or missing owner-visible targets and unexpected format groups.
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-task-fixture-source-oracle.test.mjs`
  - locks the exact Lottie/VAP owner group and issue-count contract.

Product diff SHA-256 from base over the four source/test files: `342a5a92ad9da6a1fae02d5e91edc2f6e6442955b1882407e6d4113670a1b465`.

## Validation

Passed:

- failure-first oracle before product repair: expected FAIL on duplicate VAP owner projection;
- `npm run build`;
- focused owner candidate assertions: 2/2;
- complete owner candidate suite: 19/19;
- task fixture source oracle: 2/2;
- multi-format conformance milestone: 28/28;
- related host/file-open/session group: 8/8;
- `npm run test:all`: 538/538;
- desktop design-system check;
- touched JS/CJS/MJS syntax checks;
- final diff, JSON/JSONL, dependency, package-lock, media, and packet hygiene are sealed after this review is written.

## Repair Health

- Root cause: technical VAP fusion records were projected once as generic assets and again as format-specific fusion targets; issue deduplication occurred before owner-copy redaction, so distinct internal records became repeated identical owner messages.
- Why the prior source oracle missed it: it proved runtime payload and replacement state but did not make the branded owner snapshot the selection and inventory authority.
- Success stop: one external Lottie image/text pair and one VAP fusion image/text pair are present exactly once in the owner snapshot, canonical replacements/reset remain source-valid, path-redacted evidence passes, and broad source regression remains green.
- Failure stop: any missing target, duplicate public target, invalid envelope binding/digest, unexpected group, raw path, or accepted behavior regression blocks Fix Ready.

## Boundaries

- No Electron, Auto SVGA, Finder, native chooser, Figma, browser, or foreground launch.
- No installed app mutation, package, promotion, QA, Product Owner acceptance, production material use, or production-media commit.
- No pixel playback claim, installed compatibility claim, save/export/conversion support, public support, distribution, or release readiness claim.
- Placement, startup/bootstrap, picker, renderer CSS/layout, AEB, FBP/Figma, dependencies, lockfiles, and formal 0.1 SVGA behavior were not changed.

## Next Gate

PM/A0 independent review, then Code Review only if PM routes the exact successor head. Hidden Electron and installed real-material gates remain separate.

## Project Retrospective

- Value assessment: medium-high.
- Cost drivers: the prior source oracle correctly proved runtime payloads but stopped one authority layer before the owner-visible envelope.
- Avoidable costs: source oracles should bind the exact owner projection at first introduction, not only internal model arrays.
- Product lesson: one canonical public target must map to one owner-visible row even when the parser exposes both generic asset and format-specific fusion records.
- Technical lesson: deduplicate after privacy/copy canonicalization when multiple technical issues intentionally collapse to one fixed owner message.
- Design lesson: no visual styling change was required; the fix removes duplicate rows and repeated copy at the data boundary.
- Process lesson: failure-first envelope assertions caught a false-positive oracle without runtime or foreground use.
- Token usage: unavailable.
