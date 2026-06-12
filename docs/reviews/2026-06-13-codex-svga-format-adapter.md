# SVGA FormatAdapter Review

Date: 2026-06-13
Branch: `agent/codex/svga-format-adapter`
Base commit: `de2b5c4`

## 1. Summary

Wrapped current standard SVGA protobuf inspection behind a minimal
`FormatAdapter`. The adapter returns `MotionAssetInfo` and remains isolated
from the CLI, exporter, and Web preview.

## 2. Git state

- Branch: `agent/codex/svga-format-adapter`
- Commit before work: `de2b5c4`
- Uncommitted changes before work: none
- Untracked files before work: none

## 3. Changed files

- `README.md`
- `src/workbench/svga/types.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/workbench/svga/node-protobuf-inspector.ts`
- `src/workbench/svga/index.ts`
- `src/tests/svga-format-adapter.test.ts`
- `docs/multiformat-workbench-architecture.md`
- `docs/ROADMAP.md`
- `docs/TECH_SPEC.md`
- `docs/CURRENT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/reviews/2026-06-13-codex-svga-format-adapter.md`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Minimal SVGA FormatAdapter | Done |
| 2 | Output MotionAssetInfo | Done |
| 3 | Preserve dimensions, timing, imageKey, Sprite/layer metadata | Done |
| 4 | Metadata parity tests | Done |
| 5 | Do not change exporter bytes/path | Done; exporter files untouched |
| 6 | Do not change Web playback | Done; Web files untouched |
| 7 | Do not change CLI flow | Done; CLI files untouched |
| 8 | No player, encoder, conversion dependency | Done |
| 9 | Minimal MotionAssetInfo changes | No contract change required |
| 10 | Host-neutral adapter assessment | Done |

## 5. Verification

```text
npm run build
passed

node --test dist/tests/svga-format-adapter.test.js
4 passed, 0 failed

npm test
35 passed, 0 failed

node --check tools/svga-player-preview/main.js
passed

node --check tools/svga-player-preview/server.mjs
passed

git diff --check
passed
```

Parity coverage:

- viewBox width and height
- FPS, frame count, and calculated duration
- image resource count, image keys, and byte sizes
- Sprite count, order, image references, matte keys, and frame counts
- existing MVP SVGA validator image/Sprite/frame counts
- source SHA-256 unchanged after inspection

## 6. Regression

- `src/mvp/svga-exporter.ts`: untouched
- `src/exporters/svga-exporter.ts`: untouched
- `src/cli.ts`: untouched
- `tools/svga-player-preview/`: untouched
- No production module imports `src/workbench/svga`

## 7. Dependencies and licenses

- No dependency added.
- Reuses existing `protobufjs`.
- Uses Node built-in zlib only in the Node inspector.

## 8. Client readiness

- `SvgaFormatAdapter` is host-neutral and consumes bytes through
  `MotionAssetSource`.
- It does not import Node, DOM, Canvas, filesystem, or browser APIs.
- Node zlib, protobuf schema loading, and path resolution are isolated in
  `NodeProtobufSvgaInspector`.
- A future browser or desktop host can supply another inspector without
  changing metadata mapping.

## 9. Risks

- Image dimensions are not decoded in this slice; only embedded byte sizes are
  exposed. Adding image-dimension inspection should be a separate bounded task.
- Loop behavior is not encoded by standard SVGA MovieParams and is therefore
  not fabricated in `MotionAssetInfo`.
- The adapter is not connected to a production call site yet.

## 10. Next step

- Integrate the adapter into one non-UI inspection application service with
  unchanged CLI and Web behavior.

## 11. Commit

- Commit: `1866efc`
- Branch: `agent/codex/svga-format-adapter`
- Merge: pending
- Tag: none
