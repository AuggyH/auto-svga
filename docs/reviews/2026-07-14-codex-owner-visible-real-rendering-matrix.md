# Review: Owner-visible real rendering matrix

## 1. Summary

Requirement: `ASV-REQ-20260709-003`
QA ticket: `ASV-QA-20260711-001`

This milestone replaces the owner-visible multi-format placeholder paths with real renderer mounting in the shared 0.2 desktop preview runtime:

- SVGA now prepares a bounded runtime payload and mounts through the existing `svga-web` playback path instead of the source-side preview placeholder.
- The shared SVGA playback model draws frame 0 immediately after `svga-web` mount so `previewReady` exposes decoded artwork pixels instead of a transparent backing store.
- Lottie and VAP keep their accepted runtime paths, with visible playback time synchronized from runtime progress after mount.
- Lottie play/pause reuses the same animation instance for the same source and replacement identity, so pause preserves the advanced frame instead of remounting to frame 0.
- SVGA runtime state stays `preparing` until the real player mount completes, then exposes the active `svga-web` player identity only for the active SVGA generation.
- Runtime disposal/new-generation setup clears stale player readiness markers so Lottie, VAP, over-limit, and missing-resource snapshots cannot inherit `svga-web` evidence.
- VAP runtime canvases recover their intrinsic backing-store aspect ratio inside the multi-format mount, so the accepted `120x80` fixture renders at `120x80` CSS instead of inheriting the formal canvas surface's `1 / 1` default.
- Proof gates now reject successful phases that still expose `source-side preview contract` or limited-playback copy.
- The hidden packaged-equivalent proof exercises real SVGA, real `lottie-web`, and real `video-animation-player` in Electron without installed-app mutation or foreground control.

This is source-level Implementation Ready for Code Review. It is not QA acceptance, Product Owner acceptance, installed package acceptance, product support, release readiness, or a save/export/conversion claim.

## 2. Git state

- Branch: `codex/0.2-owner-visible-real-rendering-matrix-20260714`
- Commit before work: `19d668f01fc1ebeb026a1a519e4d6e8fa6c1d1f1`
- Uncommitted changes before final commit: implementation files, proof script, review packet, retrospective ledger
- Untracked files preserved: classified `.pnpm-store/` residue

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-playback-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-rendering-matrix-proof.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-14-codex-owner-visible-real-rendering-matrix.md`
- `review/asv-qa-20260711-001-owner-visible-real-rendering-matrix-20260714/REVIEW_PACKET.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Valid SVGA uses real renderer instead of source-side placeholder | Done |
| 2 | Valid Lottie reaches real runtime mount/play/pause with visible facts and inventory | Preserved and reproved |
| 3 | Valid in-policy VAP reaches real WebGL/video runtime mount/play/pause | Preserved and reproved |
| 4 | VAP image replacement remounts runtime and reset restores source state | Preserved and reproved |
| 5 | Over-limit VAP fails before runtime creation with typed policy | Done |
| 6 | Missing-resource Lottie fails truthfully instead of claiming playback | Done |
| 7 | No external requests, no foreground, no installed mutation, no production asset commit | Done |
| 8 | Formal 0.1 isolation and save/export/conversion nonclaims | Preserved |

## 5. Verification

Commands run and results:

```text
node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/scripts/run-multiformat-real-rendering-matrix-proof.cjs
PASS

node --test --test-name-pattern "renderer mounts prepared|multi-format desktop session opens synthetic" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 2/2

node --test --test-name-pattern "runtime mount preserves VAP|renderer mounts prepared|multi-format desktop session opens synthetic|SVGA runtime payload|first-launch|replacement|over-limit|formal 0\\.1" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 10/10

npm run build
PASS

npm run desktop:short-term:design-system-check
PASS

npm run test:all
PASS 528/528
```

Hidden packaged-equivalent real-rendering proof before final commit:

```text
status: passed
proof SHA-256: 368e4244f865d26bb97486a151204812d12b4491ab2977934357081bf75f4acb
```

Latest pre-commit proof after direct child-pixel enforcement, SVGA canvas-ownership repair, and VAP aspect-ratio repair:

```text
status: passed
proof path: /var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-real-rendering-matrix-proof-94715/real-rendering-matrix-proof.json
proof SHA-256: b713a89d68ee710aebe41eb8bd65aa199f76c3ceafa78cea05a958aa90c825c7
SVGA loaded backing store: 300x300, nonWhite=40532, nonTransparent=42524
SVGA playing/paused backing store: 300x300 with progress advance then stability
Lottie: live SVG child pixels and progress advance; paused frame remains advanced and stable
VAP backing/CSS/Retina capture: 120x80 / 120x80 / 240x160, ratio=1.5 throughout
VAP video time: 0.002202 -> 0.718137; paused at 0.728258 with paused=true
VAP square-CSS regression: rejected for backing ratio 1.5 vs CSS/capture ratio 1.0
externalRequests: []
```

A final head-bound proof is rerun after the milestone commit and is supplied in the Code Review callback to avoid stale `sourceHead` evidence.

## 6. Output inspection

- SVGA: valid routed fixture opens to `previewReady`, mounts the real `svga-web` canvas, exposes direct nonblank backing-store pixels, advances during play, and stabilizes during pause.
- Lottie: valid local JSON with adjacent generated image mounts the real `lottie-web` SVG runtime, advances during play, and stabilizes during pause at the advanced frame (`36%`, `0:01 / 0:02` in the latest proof).
- VAP: bounded H.264 VAP fixture mounts the real `video-animation-player` WebGL/video runtime, advances during play, pauses truthfully, remounts for image replacement, and resets.
- Negative cases: over-limit VAP blocks before runtime creation; missing Lottie image blocks with a typed missing-resource failure.
- Evidence gate: an intentional source-side placeholder regression is rejected by the proof before any success claim.
- Pause-preservation gate: a nonzero reset from the last playing frame is rejected, not only a reset to zero.
- Renderer-identity gate: generic visible canvas evidence is rejected unless the source-defined renderer identity is present; SVGA requires `runtimePlayerReady=svga-web`.
- Pixel gate: blank/transparent SVGA backing-store evidence is rejected even if player-looking metadata is present; compositor/background pixels are not accepted as primary SVGA proof.
- Placeholder-shape gate: opaque mostly-white backing-store evidence matching the previous source-side contract card is rejected; SVGA canvas dimensions remain stable at `300x300` across load/play/pause for the routed fixture.
- Child-pixel gate: Lottie proof captures the live SVG bounds and VAP proof captures only the active WebGL canvas bounds; time-separated child digests must change while runtime progress or video time advances.
- Aspect-ratio gate: the VAP proof requires backing, CSS, and compositor-capture ratios to match within `0.02`; a nonblank animated `120x80` canvas forced into a square `120x120` CSS rect is rejected.
- Read correctness gate: SVGA runtime payload reads loop to EOF or `max+1` and reject growth, shrink, and partial-length mismatch.
- Readiness hygiene: later Lottie, VAP, over-limit, and missing-resource snapshots do not inherit stale `runtimePlayerReady=svga-web`.
- Network: hidden proof records no external requests.
- Privacy: durable docs use aliases and hashes only; raw owner material paths are not published.

## 7. Risks

- Installed foreground acceptance still requires Packaging and QA on rebuilt bytes.
- Real owner-material visual acceptance is not claimed by this source proof.
- The proof uses task-owned/synthetic fixtures for Lottie and VAP where safe material is needed.
- Product support, save/export/conversion support, public distribution, and release readiness remain out of scope.

## 8. Next steps

- Route the exact committed head to Code Review.
- If Code Review approves, PM/Packaging can decide the next rebuilt package and installed QA gate.
- Do not route QA or Packaging directly from this implementation turn.

## 9. Commit

- Commit: pending at review-file creation time
- Branch: `codex/0.2-owner-visible-real-rendering-matrix-20260714`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: previous matrix evidence accepted model state and source-side placeholders as playback; real hidden Electron proof had to bind renderer identity, pixels, runtime media state, visible playback time, replacement/reset, and negative cases.
- Avoidable costs: positive capability gates should reject placeholder text and require nonblank runtime pixels plus time-separated playing/paused samples before installed foreground claims.
- Product lessons: owner-visible playback acceptance must be renderer-backed for every format row; source-side preview contract is a limitation state, not playback.
- Technical lessons: SVGA needed a bounded full runtime payload path separate from detection probes, visible playback time must be synchronized after runtime progress is available, Lottie must reuse the active animation across play/pause, and runtime-owned canvases must not inherit a generic square aspect contract.
- Design / interaction lessons: visible status labels can be misleading if placeholder content remains; proof should inspect the canvas/runtime surface, not only labels.
- Process lessons: treat upstream PASS claims as untrusted until the evidence directly proves the claimed behavior.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: head-bound runtime proof plus focused tests should be planned as one validation ladder to avoid repeated foreground/package loops.
