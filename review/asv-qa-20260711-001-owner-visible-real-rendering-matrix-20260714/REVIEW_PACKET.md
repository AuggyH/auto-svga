# ASV-QA-20260711-001 Owner-visible Real Rendering Matrix

## Binding

- Requirement: `ASV-REQ-20260709-003`
- QA ticket: `ASV-QA-20260711-001`
- Branch: `codex/0.2-owner-visible-real-rendering-matrix-20260714`
- Base: `19d668f01fc1ebeb026a1a519e4d6e8fa6c1d1f1`
- Rejected head: `7fa16c1785931f30b1d435e71822e38ca69a12c6`
- Reviewed repair head: `8087faad7606476a8ef1f323aa154093678cd704`
- State: `MF-REAL-RENDER-CR-003 Source Repair Complete / PM Independent Final-head Review Required`

## Product Change

- SVGA uses a bounded full payload and a generation-owned `svga-web` canvas. A stale asynchronous mount can dispose only its own canvas/player key and cannot overwrite or clear the newer generation.
- Same-source SVGA and Lottie runtimes are reused across play/pause so the advanced rendered frame remains visible while paused.
- Lottie embedded images remain local. Under strict CSP, only the exact safe no-argument `$bm_rt = loopOut()` form on validated numeric/vector keyframes is normalized into cloned repeated keyframes through `op`; all other expressions fail closed and `runExpressions` remains false.
- The loopOut gate now validates every cloned keyframe field. Malformed end vectors, easing/tangent structures, hold flags, dimensions, types, or unknown fields fail with typed path-redacted `unsupported_feature` before runtime payload exposure.
- VAP dimensions above `1504` remain a truthful Canvas warning, not a playback block. The approved owner H.264 input mounts through real WebGL/video and fits fully in the visible region above the playback controls.
- VAP issue aggregation emits one logical size warning. Existing replacement/remount/reset behavior remains covered with a bounded task-owned fixture.

## Evidence Contract

- Successful playback rejects placeholder/limited copy and requires exact renderer identity.
- SVGA playing requires a paired frame/time advance and direct backing-store pixel change. Two paused samples require stable position and identical pixels.
- Lottie and VAP use the actual SVG/WebGL child rectangle, pair time-separated runtime samples with pixel changes, and require two-sample pause stability.
- VAP proof records backing, CSS, visible intersection, device scale, and compositor capture; square distortion and partial bottom clipping fail.
- Missing-resource Lottie and unsafe/malformed expressions remain typed blocked.
- The exact CR malformed-metadata probe and all optional-field mutations reject with `safe_loop_out_keyframe_metadata_required`, preserve source bytes, and expose no runtime scripts or animation payload.
- Raw owner paths are excluded; durable evidence binds aliases and hashes only.

## Reviewed-head Proof Baseline

- Source head: `8087faad7606476a8ef1f323aa154093678cd704`
- Path: `/var/folders/vh/lkxvz3qn4wzbk5mbwxc9fb9r0000gn/T/auto-svga-real-rendering-matrix-proof-82241/real-rendering-matrix-proof.json`
- SHA-256: `342573b5afafdf2fc9425a6a142d823519db66adc14d936e4cea0b618466d964`
- Inputs: exact approved `OWNER-SVGA-A`, `OWNER-LOTTIE-A`, and `OWNER-VAP-A` hashes; paths redacted.
- SVGA: frames `0 -> 9 -> 21 -> 32`, pixel digest changes on every transition; paused `33/33`, pixels identical.
- Lottie: live SVG, coupled progress/pixel advance, stable paused position/pixels.
- VAP: raw `1136x1632`; backing `750x1624`; CSS `308x668`; capture `616x1336`; fully visible; effective scale `2`; exactly one size warning; real time/pixel advance and pause stability.
- Lifecycle: Lottie `1/1`, VAP `4/4`, object URLs `4/4`; `externalRequests=[]`.

This proof retains the already-reviewed renderer matrix baseline. The final PM callback supplies a successor post-commit proof whose `sourceHead` equals the exact repaired HEAD.

## Validation

- Touched runtime/proof syntax: PASS.
- Strict-CSP Lottie boundary: PASS `3/3`.
- Exact CR malformed-metadata probe: typed/path-redacted/no-payload/source-immutable PASS.
- Related workbench Lottie/VAP/workspace/owner-preview group: PASS `75/75`.
- `npm run build`: PASS.
- Full compiled suite: PASS `530/530` with captured exit `0`.
- `npm run desktop:short-term:design-system-check`: PASS.

## Boundaries

- No foreground control or installed-app mutation.
- No owner production asset copy, mutation, or commit.
- No save/export/conversion change.
- No Code Review, QA, or Packaging route from implementation.
- No Product Owner acceptance, product-support, distribution, or release-readiness claim.

## Next Action

PM/A0 independently reviews the final committed diff and exact-head proof before deciding whether to route Code Review.
