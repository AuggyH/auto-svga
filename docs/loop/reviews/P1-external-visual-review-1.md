# P1 External Visual Review 1

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit:
ed24288122d9be6beef5e65e89109c82edbcba27

engineeringEvidenceOutcome:
PASS

productVisualOutcome:
REPAIR_REQUIRED

## Blocking Findings

1. The Electron window opened by the user was not the same product surface as the generated P1 screenshots.
   - User window: `Auto SVGA Electron Prototype`, `合成 SVGA 预览`, `离线验证通过`.
   - P1 artifact: `Auto SVGA 内部试用原型`, `播放输出`.

2. The user window reported `300 x 300`, `24 fps`, `1.00s`, `16.5 KB`, `1 layer`, `1 resource`, and `正在播放`, but the canvas showed only the transparent checkerboard.

3. The generated `valid-svga-loaded.png` showed a visible green gradient square for the same synthetic sample, so the previous smoke evidence did not prove that the ordinary user-opened desktop entrypoint produced nonblank playback.

4. The generated `invalid-file-state.png` retained the previous green rendered frame after an invalid file error, which means invalid-after-valid cleanup was incomplete.

5. The valid artifact summary showed `--` for canvas, FPS, or frame count even though the inspection report already had the data.

6. The previous artifacts were captured from smoke mode without sufficient proof that the repository-root desktop entrypoint used the same Electron main, renderer, player, loading pipeline, and UI.

## Product Direction

- P1 canonical desktop product surface is `Auto SVGA Desktop — Internal Baseline`.
- Old Electron spike surfaces may remain only as legacy/test-only entries.
- Root `npm run desktop:dev` must open the canonical P1 product surface.
- Final P1 state remains `HUMAN_REQUIRED` until the user accepts the repaired visual result.
