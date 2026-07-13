# Review: Owner-visible real rendering matrix

## 1. Summary

Requirement: `ASV-REQ-20260709-003`
QA ticket: `ASV-QA-20260711-001`

This milestone replaces the owner-visible multi-format placeholder paths with real renderer mounting in the shared 0.2 desktop preview runtime:

- SVGA now prepares a bounded runtime payload and mounts through the existing `svga-web` playback path instead of the source-side preview placeholder.
- The shared SVGA playback model draws frame 0 immediately after `svga-web` mount so `previewReady` exposes decoded artwork pixels instead of a transparent backing store.
- Owner Lottie now keeps embedded images local and normalizes only the exact safe no-argument `loopOut()` form into bounded cloned keyframes under strict CSP; every other expression shape remains typed blocked.
- Owner VAP no longer treats the historical `1504` threshold as a playback block. It mounts through the real WebGL/video runtime while the Canvas fact carries one truthful warning.
- Lottie play/pause reuses the same animation instance for the same source and replacement identity, so pause preserves the advanced frame instead of remounting to frame 0.
- SVGA runtime state stays `preparing` until the real player mount completes, then exposes the active `svga-web` player identity only for the active SVGA generation.
- Runtime disposal/new-generation setup clears stale player readiness markers so Lottie, VAP, and failure snapshots cannot inherit `svga-web` evidence.
- VAP runtime canvases fit inside the visible region above the playback bar, retain source aspect ratio, and prove their complete CSS rectangle was captured rather than clipped or stretched.
- Proof gates now reject successful phases that still expose `source-side preview contract` or limited-playback copy.
- The hidden packaged-equivalent proof exercises real SVGA, real `lottie-web`, and real `video-animation-player` in Electron without installed-app mutation or foreground control.

This is source-level Fix Ready pending PM/A0 independent final-head review. It is not Code Review approval, QA acceptance, Product Owner acceptance, installed package acceptance, product support, release readiness, or a save/export/conversion claim.

## Repair contract after Code Review

### Finding ledger

| Finding | Reviewed head | External result | Root cause | Repair evidence required | State |
|---|---|---|---|---|---|
| `MF-REAL-RENDER-CR-001` | `7fa16c1785931f30b1d435e71822e38ca69a12c6` | Changes Requested | SVGA awaited a mutating mount against the shared primary canvas and fixed playback key, then checked generation ownership only after completion. | Deferred old/new resolution inversion must leave the newer generation canvas, key, and readiness identity untouched. | Source/dev closed; re-review pending |
| `MF-REAL-RENDER-CR-002` | `7fa16c1785931f30b1d435e71822e38ca69a12c6` | Changes Requested | Temporal advancement and nonblank-pixel checks were independent, and pause recorded only one pixel sample. | Time-only advance, pixel-only advance, and paused pixel drift must all fail the proof oracle. | Source/dev closed; re-review pending |
| `MF-REAL-RENDER-PO-001` | Product Owner correction `1a53018b` | Scope correction | The historical `1504` compatibility threshold was incorrectly promoted from risk metadata to a runtime playback block. | `1136x1632` H.264 owner VAP must mount/play/pause with a warning Canvas fact and no dimension-only playback block. | Source/dev closed; PM review pending |
| `MF-REAL-RENDER-LT-001` | Local discriminator `5867284e` | Repair contract active | Strict CSP blocks lottie-web's `eval`-based expression execution, so the owner animation clock advances while its `loopOut()` transform remains static. | Normalize only the exact safe no-argument owner `loopOut()` form into validated repeated keyframes; all other expression forms stay typed blocked. | Source/dev closed; PM review pending |

### Root cause and prior gap

- SVGA cleanup was generation-aware only after an awaited shared-resource
  mutation. The repair must make the canvas and playback key generation-owned
  before the asynchronous mount starts so stale cleanup can touch only stale
  resources.
- The previous proof established real renderer identity and nonblank output,
  but did not bind the time delta to the pixel delta or record two paused
  pixel samples. The repair must make those assertions one coupled success
  contract.
- The prior source treated every `>1504` VAP as blocked because preparation
  converted a compatibility warning into an error. Inspection should preserve
  the warning while preparation and runtime remain available.
- The approved owner Lottie contains one keyframed scale property whose exact
  expression is `$bm_rt = loopOut()`. The strict CSP correctly prevents
  lottie-web from evaluating expression source, leaving the SVG geometry and
  pixels static even while `currentFrame` advances. The repair may clone and
  expand only this exact no-argument form on validated numeric/vector
  keyframes. It must preserve every source keyframe record (including easing,
  tangents, and hold flags), layer/composition timing, and caller input; repeat
  only through the declared composition `op`; never evaluate source text; and
  fail closed for parameters, modes, malformed keyframes, or any other
  expression.

### Failure-first tests

1. Start two SVGA runtime mounts, resolve the newer one first, then the older;
   the stale completion must not overwrite or clear the newer canvas/player.
2. Reject moving SVGA progress with identical nonblank pixels, changing pixels
   with frozen progress, and any pixel drift between two paused samples.
3. Prove a `>1504` VAP remains prepared and owner-visible while its Canvas fact
   is warning status; dimension risk alone must not produce `playbackBlocked`.
4. Prove the owner-shape expression is static/blocked before normalization,
   expands without mutating its source keyframes, advances real SVG pixels
   after normalization, and rejects parameterized or malformed expressions.

### Stop conditions

- Success: generation inversion is isolated, all proof mutations fail closed,
  approved owner SVGA/Lottie/VAP hashes reach real nonforeground renderer
  play/pause evidence, VAP size risk is visible, lifecycle/network/privacy
  gates remain clean, strict CSP remains free of generic `unsafe-eval`, all
  unsupported Lottie expressions stay typed blocked, and focused plus full
  regression pass.
- Failure: any stale shared mutation, permissive proof mutation, dimension-only
  VAP block, raw-path leak, unbounded read, or second recurrence stops this
  repair before lifecycle routing and returns the exact discriminator.

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
- `src/workbench/lottie-json-inspection.ts`
- `src/workbench/lottie-preview-vertical.ts`
- `src/workbench/vap-playback-preparation.ts`
- `src/workbench/vap-preview-vertical.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/lottie-json-inspection.test.ts`
- `src/tests/vap-playback-preparation.test.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `docs/reviews/2026-07-14-codex-owner-visible-real-rendering-matrix.md`
- `review/asv-qa-20260711-001-owner-visible-real-rendering-matrix-20260714/REVIEW_PACKET.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Valid SVGA uses real renderer instead of source-side placeholder | Done |
| 2 | Valid Lottie reaches real runtime mount/play/pause with visible facts and inventory | Preserved and reproved |
| 3 | Owner VAP above 1504 reaches real WebGL/video mount/play/pause with a warning Canvas fact | Done in source/dev proof |
| 4 | VAP image replacement remounts runtime and reset restores source state | Preserved and reproved |
| 5 | Historical 1504 threshold remains visible risk metadata and does not block playback | Done |
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

node --test --test-name-pattern "strict-CSP Lottie runtime|embedded-image Lottie" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 3/3

focused Electron real-rendering/runtime/session group
PASS 15/15

related workbench Lottie/VAP/owner-preview group
PASS 56/56

npm run build
PASS

npm run desktop:short-term:design-system-check
PASS

npm run test:all
PASS 530/530
```

Latest pre-commit hidden packaged-equivalent proof after the complete repair batch:

```text
status: passed
proof path: /var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-real-rendering-matrix-proof-57310/real-rendering-matrix-proof.json
proof SHA-256: c27788b9de1e2cf523512cc943e4e6070bf54f95fad313dd438c5c37f4af4d36
inputs: OWNER-SVGA-A, OWNER-LOTTIE-A, OWNER-VAP-A; exact approved hashes; paths redacted
SVGA: real svga-web canvas; frames 0 -> 9 -> 21 -> 32 with a pixel digest change on every transition; paused 33/33 with identical pixels
Lottie: live lottie-web SVG; coupled progress/pixel advance; two paused samples keep position and pixels stable
VAP: raw 1136x1632 owner H.264; runtime backing 750x1624; CSS 308x668; Retina capture 616x1336; fullyVisible=true; effectiveScale=2
VAP warnings: exactly one vap_dimensions_over_1504 warning; no dimension-only playback block
VAP: coupled video-time/pixel advance and two-sample pause stability
Lifecycle: Lottie 1/1, VAP 4/4, object URLs 4/4
externalRequests: []
```

A final head-bound proof is rerun after the milestone commit and is supplied to PM/A0 for independent review before any Code Review route.

## 6. Output inspection

- SVGA: approved owner input opens to `previewReady`, mounts the real `svga-web` canvas, exposes direct decoded backing-store pixels, couples frame advancement to pixel changes, and preserves both while paused.
- Lottie: approved embedded-image owner JSON mounts the real `lottie-web` SVG runtime. The exact safe no-argument `loopOut()` shape is cloned into bounded keyframes under strict CSP; unsupported expressions remain typed blocked.
- VAP: approved owner H.264 input mounts the real `video-animation-player` WebGL/video runtime despite its size warning, advances time and pixels, pauses truthfully, fits fully above controls, and keeps exactly one Canvas risk warning.
- VAP replacement/reset: a bounded task-owned fixture remounts for image replacement and resets to source state.
- Negative cases: missing-resource Lottie remains typed blocked; unsafe/malformed Lottie expressions remain typed blocked.
- Evidence gate: an intentional source-side placeholder regression is rejected by the proof before any success claim.
- Pause-preservation gate: a nonzero reset from the last playing frame is rejected, not only a reset to zero.
- Renderer-identity gate: generic visible canvas evidence is rejected unless the source-defined renderer identity is present; SVGA requires `runtimePlayerReady=svga-web`.
- Pixel gate: blank/transparent SVGA backing-store evidence is rejected even if player-looking metadata is present; compositor/background pixels are not accepted as primary SVGA proof.
- Placeholder-shape gate: opaque mostly-white backing-store evidence matching the previous source-side contract card is rejected; SVGA canvas dimensions remain stable at `300x300` across load/play/pause for the routed fixture.
- Child-pixel gate: Lottie proof captures the live SVG bounds and VAP proof captures only the active WebGL canvas bounds; time-separated child digests must change while runtime progress or video time advances.
- Geometry gate: VAP backing, CSS, visible-intersection, and compositor capture must agree within tight rounding tolerance; square distortion and a bottom-clipped child that would pass the old `0.02` ratio tolerance are both rejected.
- Read correctness gate: SVGA runtime payload reads loop to EOF or `max+1` and reject growth, shrink, and partial-length mismatch.
- Readiness hygiene: later Lottie, VAP, over-limit, and missing-resource snapshots do not inherit stale `runtimePlayerReady=svga-web`.
- Network: hidden proof records no external requests.
- Privacy: durable docs use aliases and hashes only; raw owner material paths are not published.

## 7. Risks

- Installed foreground acceptance still requires Packaging and QA on rebuilt bytes.
- The source/dev proof uses approved owner SVGA, Lottie, and VAP inputs read-only, but installed foreground acceptance is not claimed.
- The VAP replacement/reset segment still uses a bounded task-owned fixture; no owner asset is mutated or committed.
- Product support, save/export/conversion support, public distribution, and release readiness remain out of scope.

## 8. Next steps

- Commit the complete repair and rerun one proof whose `sourceHead` equals the exact final HEAD.
- Return the exact final diff/proof to PM/A0 for independent review before any Code Review route.
- Do not route Code Review, QA, or Packaging directly from this implementation turn.

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
