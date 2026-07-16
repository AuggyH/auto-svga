# Review: Multi-format daily-use reliability chain

## 1. Summary
Implemented the owner-visible unified daily-use reliability chain for the approved autoplay-on-open source line. The owner preview session now catches a rejected `workspace.play()` during Open autoplay and projects a typed `playbackFailed` model instead of throwing or reporting a false playing state.

The composed source tests now cover SVGA, Lottie, and VAP through Open -> owner facts/assets -> autoplay -> pause/resume -> replacement -> target Reset -> reopen isolation, plus the `MF-AUTOPLAY-OPEN-ADV-001` rejection path.

## 2. Git state
- Branch: `codex/0.2-multiformat-daily-use-reliability-20260716`
- Base before work: `efc7006f37f9d665ce83ec658b670550f7d97c3e`
- Commit: included in final milestone head; exact head reported in PM callback.
- Uncommitted product changes before commit: `src/workbench/multiformat-owner-preview-candidate.ts`, `src/tests/multiformat-owner-preview-candidate.test.ts`
- Untracked files: classified `.pnpm-store/` residue only before review packet generation.

## 3. Changed files
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `docs/reviews/2026-07-16-codex-multiformat-daily-use-reliability.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks
| # | Requirement | Status |
|---|-------------|--------|
| 1 | SVGA Open -> facts/assets -> autoplay -> pause/resume -> replacement -> target Reset | Done in composed source regression |
| 2 | Lottie embedded/adjacent-resource style owner facts, image/text replacement, target Reset, recovery/cleanup | Done in composed source regression |
| 3 | VAP fusion facts/resources, real playback contract surface, image/text replacement, target Reset | Done in composed source regression using existing approved fake runtime seam |
| 4 | Close `MF-AUTOPLAY-OPEN-ADV-001`: rejected Open autoplay must not report playing | Done; returns typed `playbackFailed` with redacted issue and recover command |
| 5 | Preserve source privacy and no save/export/conversion expansion | Done; tests assert no local path leakage and no save/export support claim |
| 6 | No foreground, install, Packaging, QA, or self-routed CR | Done |

## 5. Verification
```text
npm run build
PASS

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 22/22

node --test dist/tests/multiformat-preview-workspace.test.js dist/tests/lottie-preview-vertical.test.js dist/tests/vap-preview-vertical.test.js dist/tests/lottie-svg-playback-adapter.test.js dist/tests/vap-web-playback-adapter.test.js
PASS 47/47

node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 28/28

node --test --test-name-pattern "0\.2 renderer runtime prepare failure|cancelled host chooser|unsupported picker|picker exception|host-opened SVGA|first-launch file-open|open-file|replacement|runtime prepare" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 7/7

npm run desktop:short-term:design-system-check
PASS

npm run test:all
PASS 541/541

git diff --check
PASS

TASK_RETRO_LEDGER strict JSONL parse
PASS 187 rows before this ledger append
```

Product source diff SHA-256 over `src/` + `tools/` before docs/packet material: `74d58d6127b60114edb41c329e060ee836c4fe832f545c4b4a36a589416d7d80`.

Changed-path scan from base touched only the owner preview session and its source test before review/ledger; no package, lockfile, media, production asset, or generated runtime material was changed.

## 6. Output inspection
- Owner model projection remains `OwnerRightPanelSnapshotV1` based; hidden/internal maturity facts are not surfaced as owner-visible facts.
- The new autoplay rejection path records a fixed owner-safe playback failure issue and keeps raw local paths redacted.
- Replacement/Reset assertions include source generation isolation after reopening a different format.

## 7. Risks
- This is source-level validation only. It does not claim installed QA, real foreground playback, Product Owner acceptance, Packaging, support, distribution, or release readiness.
- The VAP runtime proof here uses the existing approved source seam; it does not replace downstream installed material QA.

## 8. Next steps
- PM/A0 independent review should decide whether to route this source head to Code Review.
- Downstream installed QA remains separate and must use a rebuilt exact-head candidate if routed.

## 9. Commit
- Commit: final milestone head reported in callback.
- Branch: `codex/0.2-multiformat-daily-use-reliability-20260716`
- Tag: none

## 10. Project retrospective
- Value assessment: High
- Cost drivers: cross-format composed assertions and careful distinction between raw model facts and owner-safe snapshot projection.
- Avoidable costs: the advisory could have had a direct rejected-`workspace.play()` regression when autoplay-on-open first landed.
- Product lessons: owner-visible Open must never claim playing until the same generation's playback command actually succeeds.
- Technical lessons: source generation reset and replacement authority must be asserted across format reopen, not only within one format.
- Design / interaction lessons: no UI styling changed; owner-safe right-panel copy remains snapshot-derived.
- Process lessons: composed daily-use flow tests are more useful here than another metadata-only fixture.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

## 11. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: focused owner-session composition plus one full `test:all` run gave enough evidence without launching Electron foreground or touching installed apps.
