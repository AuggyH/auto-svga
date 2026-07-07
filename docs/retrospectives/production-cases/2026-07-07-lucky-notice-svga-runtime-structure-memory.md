# Lucky Notice SVGA Runtime Structure Memory Case

Date: 2026-07-07
Status: production case retrospective
Scope: local analysis of three real production SVGA files from the same lucky
notice feature module. The production assets are not committed to the
repository.

## Summary

The lucky notice module exposed a real mobile playback performance issue:
files with modest encoded size and modest decoded image memory can still occupy
much more memory on device after the SVGA player parses the timeline.

The root cause is runtime structure expansion, not image asset size. Two files
reuse a 24-frame coin sequence across many coin instances. Because standard
SVGA `FrameEntity` does not switch `imageKey` per frame, each coin instance is
exported as many sprite records. The player then creates thousands of sprite
and frame objects even though the embedded image asset count is small.

This case promotes runtime structure complexity detection and optimization into
Auto SVGA product scope. Auto SVGA must not leave this class of production
performance issue only to designers or client engineers.

## Samples

| File | Role in module | Encoded size | Canvas | FPS / frames | Images | Sprites | FrameEntity count | Decoded image memory |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| `bg_lucky_notice_start.svga` | start banner | 72.1 KiB | 687 x 192 | 60 / 60 | 2 | 2 | 120 | 1.01 MiB |
| `bg_lucky_notice_all.svga` | full notice | 342.6 KiB | 981 x 360 | 20 / 80 | 36 | 2703 | 216,240 | 4.85 MiB |
| `bg_lucky_notice_end.svga` | ending coin burst | 163.3 KiB | 432 x 192 | 60 / 120 | 27 | 2883 | 345,960 | 1.10 MiB |

The client team reported that `bg_lucky_notice_end.svga` can occupy about
20 MiB on low-end phones. The repository analysis explains why: the file has
only 27 embedded images but 2883 sprite records and 345,960 frame records.

## Visual And Structural Findings

Visual inspection shows simple module content:

- `start`: a static/near-static lucky gift banner with only two sprites.
- `all`: a complete notice layout with avatar, gift, multiplier, jackpot art,
  and coin movement on the right.
- `end`: a prize tray with a large coin burst that then settles.

The expensive files are `all` and `end`. Both contain one continuous 24-frame
coin sequence (`img_6837` through `img_6860`, 72 x 72). That sequence is
instanced many times:

| File | Sequence-frame images | Sequence sprite records | Likely coin instances | Pattern |
| --- | ---: | ---: | ---: | --- |
| `bg_lucky_notice_all.svga` | 24 | 2688 | 112 | 24 sequence sprites per coin instance |
| `bg_lucky_notice_end.svga` | 24 | 2880 | 120 | 24 sequence sprites per coin instance |

For `bg_lucky_notice_end.svga`, the visible drawing load is much smaller than
the parsed structure:

- average alpha-positive sprites per frame: about 64.5
- peak alpha-positive sprites per frame: 137
- average sprites drawn by the local SVGA Web threshold (`alpha >= 0.05`):
  about 29
- peak sprites drawn by that threshold: 104

This distinction matters. Some players skip low-alpha frames during drawing,
but they still parse and allocate sprite/frame objects before drawing. The user
may see a visually reasonable animation while the runtime memory is already
high.

## Why Current Estimates Missed It

The existing decoded-memory estimate is image-focused:

```text
decoded image memory = image width * image height * 4
```

That correctly estimates texture memory, but it misses runtime object memory:

- sprite objects
- frame objects
- transform/layout/alpha objects
- per-frame arrays or cached render entities
- player-specific decoded timeline structures

Using the real mobile report for `bg_lucky_notice_end.svga`, the rough
calibration is:

```text
reported runtime memory ~= 20 MiB
decoded image memory ~= 1.10 MiB
runtime structure overhead ~= 18.9 MiB
FrameEntity count = 345,960
rough structure cost ~= 55-60 bytes per FrameEntity, before sprite overhead
```

This is not a universal formula. It is a useful production heuristic until the
project has per-target-player measurements.

## Optimization Findings

### Strictly Safe

The safest operation is removing sprites whose maximum alpha is exactly zero
and then removing newly unreferenced images.

| File | Result | Effect |
| --- | --- | --- |
| `bg_lucky_notice_all.svga` | 2703 -> 1656 sprites | saves about 23.1 KiB and 83,760 FrameEntity records |
| `bg_lucky_notice_end.svga` | 2883 -> 2763 sprites | saves about 4.75 KiB and 14,400 FrameEntity records |

This should be an Auto SVGA safe optimization when reference closure and
round-trip validation pass.

### Target-player Equivalent

The local vendored `svga-web` renderer skips frames below `alpha < 0.05`.
For `bg_lucky_notice_end.svga`, removing sprites with `maxAlpha <= 0.02`
produced zero pixel difference under that local player threshold and reduced:

- file size: 163.3 KiB -> 91.7 KiB
- sprites: 2883 -> 1323
- images: 27 -> 14
- FrameEntity count: 345,960 -> 158,760

This is not universally lossless. It is target-player-equivalent only when the
target player also treats such low-alpha content as visually irrelevant or
skips it. Auto SVGA must show this as a review-required optimization unless a
target-player threshold profile is explicitly selected and validated.

### FPS Reduction Alone

FPS reduction helps frame count but does not solve sprite fanout by itself.

For `bg_lucky_notice_end.svga`, sampling to 24 FPS changes:

- sprites: still 2883
- FrameEntity count: 345,960 -> 138,384
- file size: 163.3 KiB -> 141.0 KiB

Combined with low-alpha pruning and post-sampling zero-sprite pruning, the same
file can reach:

- file size: about 83.3 KiB
- sprites: 1161
- FrameEntity count: 55,728

This combined path is the most promising Auto SVGA optimization path, but it
requires before/after playback comparison and target-device validation.

## Design-side Guidance

Design/export-side fixes remain valuable:

- avoid exporting particle-like effects as many repeated SVGA sequence
  instances;
- use fewer coin instances or a shorter sequence when the visual role is
  decorative;
- use transform/alpha/scale on fewer images when it can approximate the effect;
- reduce FPS where the module does not need high-frequency motion;
- consider VAP or a video-like format for pure-playback complex visual effects
  without replaceable elements.

However, design-side guidance is not enough. Production assets can already be
online before the issue is noticed, and design teams should not be expected to
manually reason about target-player object allocation.

## Auto SVGA Product Implications

Auto SVGA must add a runtime-structure performance lane:

1. Detect runtime structure risk in every SVGA inspection:
   - sprite count
   - total FrameEntity count
   - alpha-positive frame count
   - target-player-visible frame count
   - invisible and low-alpha frame ratios
   - sequence-frame fanout
   - per-frame visible sprite peak and average
   - estimated runtime structure memory
2. Show decoded image memory and runtime structure memory/risk separately.
3. Flag files where encoded size and decoded image memory look acceptable but
   sprite/frame structure is high risk.
4. Offer safe optimization for all-zero sprites and newly unreferenced images.
5. Offer review-required optimization for:
   - target-player alpha-threshold pruning;
   - FPS reduction with frame resampling;
   - sequence-fanout pruning;
   - sequence-fanout rebake/collapse when it reduces total runtime cost.
6. Require before/after preview comparison, inflate/decode validation, reopen
   proof, and target-player risk notes before optimized output can be saved.
7. Feed this risk model into the AE bridge bake planner so Auto SVGA can
   prevent the same export pattern before it ships.

## PRD Updates Required

This case is now reflected in `docs/product/PRODUCT_ROADMAP.md` as short-term
requirements for runtime structure diagnostics and optimization. It should also
inform future production-spec calibration work: file size, decoded image
memory, and image resource count are insufficient as standalone performance
gates.

## Evidence Boundary

This retrospective used local deterministic parsing plus temporary visual
contact sheets under `/tmp/auto-svga-lucky-notice-case/`.

The temporary rendered sheets are analysis evidence only. They are not
committed because they contain production visual assets. Manual product visual
acceptance and target-device playback profiling remain separate gates.
