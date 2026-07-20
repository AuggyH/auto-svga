# Review: Owner-visible Lottie/VAP Preview Vertical Landing

## 1. Summary

Implemented the next owner-visible 0.2 multi-format preview vertical on top of
the accepted file-open terminal repair. The 0.2 desktop path can now prepare
and mount runtime preview payloads for local Lottie JSON and local VAP/MP4
through the shared workspace model, including normalized facts/assets/fusion
data and runtime replacement/reset remounts.

Status: Implementation Ready for one final Code Review. This is not QA
acceptance, package readiness, foreground visual acceptance, or a Lottie/VAP
product-support claim.

## 2. Git State

- Branch: `codex/0.2-owner-visible-lottie-vap-preview-vertical-20260713`
- Base: `b694fa86e7965dac87b8ad3b59da3a292c0117c0`
- Final handoff commit: pending this milestone commit
- Untracked files: known classified `.pnpm-store/` residue only

## 3. Changed Files

- `src/workbench/vap-inspection.ts`
- `src/workbench/vap-preview-vertical.ts`
- `src/workbench/multiformat-preview-workspace.ts`
- `src/tests/vap-inspection.test.ts`
- `tools/electron-prototype/experiments/svga-web/host-adapter-contract.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/server.mjs`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/product/requirements/ASV-REQ-20260709-003.md`
- `review/0.2-owner-visible-lottie-vap-preview-vertical-20260713/`

## 4. Requirement Checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Local Lottie JSON reaches loaded preview/playback state in shared 0.2 workspace. | Source/dev runtime payload and renderer mount contract implemented. Actual packaged/browser visual proof remains next gate. |
| 2 | Local VAP/MP4 reaches loaded preview/playback state in same workspace. | Source/dev runtime payload and renderer mount contract implemented for embedded and adjacent `vapc`; over-limit real VAP remains typed limitation. Actual packaged/browser visual proof remains next gate. |
| 3 | Facts/assets are visible and format-specific candidates are represented truthfully. | Preserved through normalized workspace/owner-preview models; Lottie image/text and VAP fusion image/text payloads are covered. |
| 4 | Runtime replacement/reset works where supported. | Covered by prepared Lottie image/text and VAP fusion replacement payloads plus renderer remount/reset contracts. |
| 5 | Existing SVGA preview and formal 0.1 isolation remain intact. | Focused formal 0.1 guard and full regression pass; no 0.1-visible multi-format API/menu widening. |
| 6 | Offline/local-only behavior and path privacy remain intact. | Runtime scripts are self-hosted under local `/runtime-node-modules/`; no package/lock drift; path-redacted terminal behavior remains covered. |

## 5. Implementation Notes

- Added `prepareMultiFormatRuntimePreview` to the formal 0.2 bridge and main
  process IPC family, guarded behind the existing product-mode checks.
- Added source-side Lottie runtime preparation with bounded JSON reads,
  deterministic adjacent-image inlining, text/image replacement application,
  and the approved `lottie-web/build/player/lottie_svg.js` runtime endpoint.
- Added source-side VAP runtime preparation with bounded MP4 reads, embedded or
  deterministic adjacent `vapc` JSON, local object URL playback data, fusion
  params, and the approved `video-animation-player/dist/vap.js` runtime
  endpoint.
- Extended the renderer controller to load self-hosted runtime scripts, mount
  Lottie/VAP payloads into the preview canvas, bind generation/cancellation,
  revoke object URLs, and remount after replacement/reset.
- Extended VAP inspection/workspace paths to accept bounded adjacent sidecar
  `vapc` JSON without accepting ordinary MP4 false positives.

## 6. Environment Boundary

PM stopped the self-hosted VM-smoke attempt under the three-blocker rule after
multiple fake-browser gaps: read-only `navigator`, UMD branch behavior,
canvas/script discovery, and timer/runtime mismatches. Those incomplete
VM-smoke additions were removed.

Current source evidence is intentionally limited to:

- prepared runtime payload shape;
- self-hosted runtime endpoint mapping;
- source/dev renderer mount contracts with fake constructors;
- adjacent sidecar VAP readiness;
- replacement/reset remount behavior;
- fail-closed over-1504 VAP behavior.

Actual browser playback proof requires a rebuilt package candidate and bounded
foreground regression. This review does not claim real foreground visual
playback success.

Dependency environment note: the local root dependency tree was missing direct
symlinks for `long`, `fflate`, and `iobuffer`. Per PM instruction, no
install/download was performed. A temporary ignored symlink overlay was used
only after package/lock hashes matched the existing local dependency tree, then
the created symlinks were removed. The broader Electron experiment package
proof still lacks `@electron/asar` in the local dependency tree, so that legacy
suite was not used as the milestone gate.

## 7. Verification

```text
node --test --test-name-pattern="formal 0.2 multi-format preload|0.2 multi-format desktop mode|0.2 multi-format desktop session|0.2 renderer mounts prepared|server uses bounded internal-trial CSP|0.2 installed file-open events|formal 0.1 direct multi-format IPC" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 8/8

npm run build
PASS

node --test dist/tests/vap-inspection.test.js
PASS 14/14

node --test dist/tests/multiformat-preview-workspace.test.js dist/tests/multiformat-owner-preview-candidate.test.js dist/tests/multiformat-asset-qualification.test.js
PASS 23/23

npm run test:all
PASS 525/525

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS
```

Additional hygiene:

- Package/lockfile changed-path scan: PASS, no matches.
- Production media/archive changed-path scan: PASS, no matches.
- Incomplete self-hosted VM-smoke symbol scan: PASS, no matches.
- Temporary symlink cleanup: PASS for `node_modules/long`,
  `node_modules/fflate`, and `node_modules/iobuffer`.
- Known `.pnpm-store/` residue remains untracked and unstaged.

## 8. Risks

- Actual browser/Electron runtime playback has not been proven in this source
  worktree because there is no approved/source-local real browser harness.
- The available owner VAP sample observed during the route remains above the
  1504 dimension limit and is correctly treated as a typed limitation, not a
  positive visual playback proof.
- A rebuilt package and bounded foreground regression are still needed before
  product or visual acceptance can be considered.

## 9. Next Steps

1. Route this exact milestone head to Code Review.
2. If approved, route Packaging to rebuild an internal alpha candidate.
3. QA then runs a bounded foreground regression for actual browser playback and
   real-material limitations.

## 10. Project Retrospective

- Value assessment: High
- Cost drivers: owner-visible Lottie/VAP preview required crossing inspection,
  desktop host runtime payload preparation, renderer mount, replacement/reset,
  self-hosted runtime serving, and sidecar VAP semantics together.
- Avoidable costs: a source-local fake browser can grow without proving the
  real Electron/browser runtime; stop at source-contract evidence once the
  missing environment class repeats.
- Product lessons: positive preview/product landing needs both source runtime
  contracts and a later packaged foreground proof; typed terminal failures are
  no longer the target for this milestone.
- Technical lessons: runtime payload preparation should be a host/session
  boundary, while renderer mounting should remain generation-bound and
  disposable.
- Design / interaction lessons: the shared workspace can keep consistent
  canvas, facts, inventory, replacement, reset, and recovery behavior while
  each format reports only capabilities it actually exposes.
- Process lessons: actual browser playback proof belongs to the packaging and
  foreground gate when the source tree lacks a real browser harness.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  Yes.

## 11. Token Usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: the PM stop rule prevented more token spend on fake browser
  emulation after repeated environment gaps.
