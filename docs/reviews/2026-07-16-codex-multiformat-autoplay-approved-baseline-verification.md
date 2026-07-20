# Review: Multi-format autoplay approved-baseline verification

## 1. Summary

Verified the Product Owner autoplay-on-open request from approved integration
baseline `8090bf6d1694a30e589c8fb6bbe364d93b449975` and closed the adjacent
`.swapped` test-hygiene note from governance review `cf29e4ba`.

The autoplay product implementation did not require another runtime source
change: commit `efc7006f37f9d665ce83ec658b670550f7d97c3e` is already an ancestor of
the approved baseline. The current owner session and desktop host already make
successful SVGA, Lottie, and in-policy VAP Open enter `playing`; invalid Open
and Cancel do not start another player; explicit Pause remains authoritative.

This successor strengthens the interaction oracle so owner model status and
the injected SVGA/Lottie/VAP player calls must agree. It also verifies that
replacement and target Reset retain their established per-format behavior
without an additional implicit play call.

## 2. Git state

- Branch: `codex/0.2-multiformat-autoplay-on-open-physical-source-20260716`
- Approved base: `8090bf6d1694a30e589c8fb6bbe364d93b449975`
- Approved review governance: `cf29e4bab3f650eb15f222f750232b31c044e9c8`
- Approved review content SHA-256 independently computed from governance:
  `249e1e31a76dc8f662d79da29ff7f1ef1f0eddabfaaf3389823bffeef201520e`
- Callback review SHA `9b09b2d2...` did not match the committed review bytes;
  the committed review content and disposition were used as authority.
- Classified untracked residue preserved: `.pnpm-store/` only.

## 3. Changed files

- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-autoplay-approved-baseline-verification.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

Runtime product-source diff relative to `8090bf6d`: none, SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Source/test diff SHA-256 over `src/` and `tools/` relative to `8090bf6d`:
`30ff12a8a89aa9452fbeca93f6cf81207f4c5742bf0cb86f4cc33f8c4c93fc03`.

## 4. Behavior and failure-first evidence

- SVGA, Lottie, and VAP successful Open assert both owner status `playing` and
  the underlying player `play` call.
- Pause/Resume assert both owner playback state and player `pause`/`play`.
- Invalid Open asserts no player receives a new play call.
- Existing composed controller coverage keeps Cancel a model/source/player
  no-op and keeps accepted Open failure terminal.
- Replacement and Reset assert no implicit play call. Existing semantics stay
  format-specific: SVGA retains its playing owner model while controller
  remount playback is `ready`; Lottie/VAP remount as `previewReady`.
- Failure-first `.swapped` assertion initially failed with `Missing expected
  rejection`. The helper now removes the swapped parent in `finally`, and the
  test proves the sibling no longer exists before continuing.

## 5. Validation

```text
npm run build
PASS

focused owner autoplay/rejection tests
PASS 3/3

focused desktop Open/Cancel/source-identity tests
PASS 3/3

related Lottie/VAP/workspace/owner playback suites
PASS 69/69

npm run test:all
PASS 542/542

npm run desktop:short-term:design-system-check
PASS

node --check touched MJS
PASS

git diff --check
PASS

strict TASK_RETRO_LEDGER.jsonl parse before append
PASS 191 rows

changed-path package/lock/media scan
PASS no matches
```

## 6. Protected boundaries

- No runtime product module, UI styling, placement, picker, main/preload/IPC,
  replacement authority, Reset authority, save, export, or dependency changed.
- Approved physical source identity behavior from `8090bf6d` is unchanged.
- No Electron or Auto SVGA launch, foreground use, installation, Packaging,
  QA, owner material use, Product Owner acceptance, support, distribution, or
  release action occurred.

## 7. Risks and next gate

This is source/test evidence, not installed playback acceptance. PM/A0 owns the
next integration decision. A rebuilt package and separately routed installed
QA remain required before claiming owner-visible acceptance.

## 8. Project retrospective

- Value assessment: Medium.
- Cost driver: the route described a missing product transition that already
  existed in the approved baseline, so ancestry and live source behavior had
  to be separated from stale milestone context.
- Avoidable cost: product callbacks should identify whether the requested
  behavior is absent from the exact base before routing another implementation.
- Technical lesson: playback tests should bind model state to concrete player
  calls; model-only `playing` assertions can hide adapter drift.
- Process lesson: when a requested capability is already present, preserve the
  product bytes and close only concrete evidence or hygiene gaps.
- Token usage source: unavailable.
