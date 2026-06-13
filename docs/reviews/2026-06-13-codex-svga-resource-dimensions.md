# Review: Embedded SVGA resource dimension checks

## 1. Summary

Added PNG dimensions to embedded SVGA resource metadata and enforced the
avatar-frame 300x300 per-resource production limit.

## 2. Git state

- Branch: `agent/codex/svga-resource-dimensions`
- Commit before work: `d655c73`
- Implementation commit: `371583c`
- Uncommitted changes before work: none
- Real assets staged: none

## 3. Changed files

- `src/workbench/contracts.ts`
- `src/workbench/svga/image-metadata.ts`
- `src/workbench/svga/format-adapter.ts`
- `src/workbench/svga/spec-checker.ts`
- `src/workbench/specs/avatar-frame-production.ts`
- `src/tests/svga-resource-dimensions.test.ts`
- `src/tests/svga-format-adapter.test.ts`
- `src/tests/avatar-frame-production-spec.test.ts`
- `src/tests/avatar-frame-inspection-report.test.ts`
- `tools/svga-player-preview/inspection-report-view.mjs`
- `tools/svga-player-preview/inspection-report-view.test.mjs`
- `tools/svga-player-preview/server-inspection-report.test.mjs`
- `docs/TECH_SPEC.md`
- `tools/svga-player-preview/README.md`

## 4. Requirement checks

| Requirement | Status |
|---|---|
| Expose embedded image dimensions in MotionAssetInfo | Done |
| Support current embedded image format | Done: PNG |
| Unknown image dimensions do not abort inspection | Done |
| Add 300x300 per-resource avatar-frame rule | Done |
| Structured severity/code/message/path/details | Done |
| Compliant, over-width, over-height, unknown tests | Done |
| Web consumes report issues without checking in UI | Done |
| No new dependency, format, or UI layout | Done |

## 5. Verification

Validation tier: Tier 2.

```text
npm run build
PASS

node --test dist/tests/svga-resource-dimensions.test.js dist/tests/svga-format-adapter.test.js dist/tests/avatar-frame-production-spec.test.js dist/tests/avatar-frame-inspection-report.test.js dist/tests/svga-motion-spec-checker.test.js dist/tests/motion-inspection-service.test.js
29 passed

node --test tools/svga-player-preview/inspection-report-view.test.mjs tools/svga-player-preview/server-inspection-report.test.mjs
6 passed
```

Actual-file inspection:

- `avatar_frame_basic.svga`: 28/28 dimensions known, no oversized resources.
- `avatar_frame_gold_green_real_002.svga`: 25/25 dimensions known, no oversized resources.
- All 53 current embedded resources use PNG.

Full regression was skipped because exporter, playback, dependencies, build
configuration, CLI routing, import, drag-drop, and comparison were not touched.

## 6. Regression and drift

- SVGA exporter: not touched; output bytes unchanged.
- Web player implementation and layout: not touched.
- CLI default flow: not touched.
- Import, drag-drop, and comparison: not touched.
- Scope remains avatar-frame SVGA static specification checks.

## 7. Dependencies and client readiness

- Dependencies added: none.
- License impact: none.
- PNG metadata parsing uses only `Uint8Array`; no Node, DOM, Canvas,
  filesystem, browser, or platform API dependency.
- The parser and checker can run offline in future macOS and Windows clients.
- Node/protobuf decoding remains behind the existing injected SVGA inspector.

## 8. Risks

- Only PNG embedded images are recognized in this slice.
- Unknown formats produce one warning per affected image and preserve report pass
  status unless another error exists.
- Alpha bounds and transparent-padding waste remain unmeasured.

## 9. Next steps

- Add host-neutral PNG alpha-bound measurement for transparent-padding checks.
