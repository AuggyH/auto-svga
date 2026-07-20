# P3 Editing Capability Audit

Date: 2026-06-20
Branch: `agent/codex/p3-basic-image-resource-editing`
Milestone: P3 — Basic Image Resource Replacement And Save As
Start commit: `2b5bd05a79a77d3f292a73267dd910f5b1f97013`

## Scope

P3 may implement one bounded editing loop: replace embedded PNG image bytes in
a supported SVGA, preview the edited animation, reset edits, and Save As a new
SVGA. The original SVGA remains read-only.

This audit checks whether the current repository can support a safe
decode-edit-encode boundary before implementation starts.

## Summary Decision

P3 can proceed only as a **restricted SVGA subset editor**.

Allowed subset:

1. The file inflates and decodes with `proto/svga.proto`.
2. Images are stored in `MovieEntity.images`.
3. Replacement touches only one or more existing `images[resourceKey]` entries.
4. Sprite `imageKey` and `matteKey` references are preserved.
5. Exported bytes re-inflate and re-decode.
6. Invariant comparison confirms no unauthorized semantic change.

Unsupported or uncertain files must fail closed with a product error. P3 must
not silently drop unknown fields or claim export success when round-trip
invariants fail.

## Capability Matrix

| capability | current implementation | reusable path | known limitation | round-trip risk | P3 action |
| --- | --- | --- | --- | --- | --- |
| SVGA protobuf schema | `proto/svga.proto` defines `MovieEntity`, `MovieParams`, `images`, `sprites`, `frames`, `layout`, `transform`, `shapes`, and `audios`. | Use the same proto for decode and encode. | Proto3 unknown fields are not represented in the schema. | Unknown fields may be discarded by `protobufjs`. | Support only files whose known-field invariants pass after re-encode; reject unexpected drift. |
| Inflate / deflate | `src/mvp/svga-exporter.ts` and `src/exporters/svga-exporter.ts` use `inflateSync` / `deflateSync`. | Reuse the same zlib boundary. | Existing exporters create new SVGA from project data, not arbitrary file round-trip. | Compression bytes will change even when semantics match. | Treat zlib bytes and total file size as allowed changes; compare decoded semantics. |
| Protobuf decode | `NodeProtobufSvgaInspector` decodes and converts a limited inspection object. | Reuse proto loading pattern and add a P3 round-trip helper that keeps the full decoded known-field object. | Current inspector drops frame details, audio details, shapes, and unknown fields. | Existing inspector output is insufficient for Save As. | Do not use inspector output as the export source of truth; decode full `MovieEntity` for editing. |
| Protobuf encode | Exporters use `MovieEntity.verify`, `create`, and `encode`. | Reuse encoding pattern. | No generic round-trip writer exists. | Re-encoding may normalize protobuf map order and omit unknown fields. | Add a bounded edit/encode helper and validate decoded invariants after writing. |
| Image resource discovery | `SvgaFormatAdapter` exposes resources with image key, size, dimensions, alpha bounds, role, and content hash. | Reuse for UI resource list and report consistency. | Usage count is not currently exposed on resources. | Resource list alone cannot prove sprite references remain stable. | Add editing resource discovery with stable `resourceKey` and usage count from sprite `imageKey` / `matteKey`. |
| Resource hashes | `Sha256ResourceHasher` produces encoded-byte hashes for inspection. | Reuse hash semantics for original, replacement, exported, and untouched resource checks. | Hashes are optional in generic `MotionAssetInfo`. | Missing hashes weaken unchanged-resource proof. | P3 edit model must calculate hashes at host boundary and fail validation if required hashes are unavailable. |
| PNG metadata | `readEmbeddedImageMetadata`, `readPngInfo`, and `decodeRgbaPng` read PNG dimensions and pixels. | Use PNG signature, IHDR, size limits, and decode success. | `decodeRgbaPng` supports a limited subset; `fast-png` is available for alpha analysis but P3 does not need a new dependency. | Malformed or oversized PNG could break preview or memory. | Validate replacement PNG before applying; reject non-PNG, corrupt, zero-size, and oversized inputs. |
| Existing SVGA exporter | `src/exporters/svga-exporter.ts` and `src/mvp/svga-exporter.ts` build SVGA from project protocol. | Reuse proto/zlib validation ideas only. | Exporters infer sprites from project/svga-map, not opened SVGA movies. | Reusing exporter would rebuild animation and lose original semantics. | Do not route P3 Save As through project exporter. Add a separate round-trip editor boundary. |
| Motion inspection report | `AvatarFrameInspectionReportService` can inspect bytes from memory. | Reuse for post-edit and reopened export report smoke. | It is read-only and not an editing model. | Inspection success does not prove visual parity or full round-trip invariants. | Use as additional validation, not as sole export proof. |
| Electron file input / drag-drop | Current renderer reads selected SVGA via browser `File` APIs and sends bytes to local inspection server. | Keep local-only renderer file loading for preview; add narrow Save As IPC. | No current host-side file picker/save IPC for edited output. | Renderer must not gain arbitrary filesystem access. | Add minimal preload IPC for controlled open/save only; validate IPC arguments and redact paths. |
| Player lifecycle | `prototype.js` destroys parser/player before loading another SVGA. | Reuse cleanup pattern before replacement preview. | Current flow has no edited movie preview state. | Multiple players/listeners could leak or show stale frames. | Centralize edited byte load/remount and prove cleanup in tests/smoke. |
| Browser rollback | Web preview and `local:preview` are separate from Electron prototype. | Protected regression path. | P3 should not modify main Web player behavior. | Editing changes could accidentally alter shared report helpers. | Keep P3 editing in Electron prototype unless a host-neutral helper is needed. Run rollback checks. |
| Visual evidence | P2 capture scripts can produce product screenshots. | Reuse artifact indexing and screenshot capture patterns. | P3 needs new states and round-trip reports. | Visual pass could be faked by static image insertion. | Capture real app states and require nonblank original/edited/reopened canvas plus screenshot hash difference. |

## Round-trip Findings

### Schema coverage for target fixture

The repository-owned synthetic fixture is generated by the current SVGA export
path and uses known fields covered by `proto/svga.proto`: movie params, images,
sprites, frames, layout, transform, alpha, and empty audios/shapes where
applicable. This is a valid P3 target subset.

### Decode to encode preservation

`protobufjs` can decode and encode the known `MovieEntity` fields. P3 must
preserve:

- params: width, height, fps, frame count
- sprite count, order, `imageKey`, `matteKey`
- frame count per sprite
- frame alpha, layout, transform, clipPath, shapes
- audio entries when present in known schema
- all untouched image keys and image hashes

### Unknown field handling

The current `protobufjs` path does not preserve unknown protobuf fields. P3
must not claim arbitrary SVGA compatibility. Unknown fields cannot be safely
round-tripped unless they are outside the accepted subset and post-export
validation proves no unexpected known-field drift.

Safe default: reject files that fail invariant validation and show
`unsupported_round_trip_file`.

### Exporter reuse

The existing SVGA exporters should not be reused as P3 Save As exporters. They
build a new movie from project protocol and would not preserve arbitrary opened
SVGA structure. P3 should add a separate, narrow round-trip resource editor that
uses the same proto/zlib primitives.

## P3 Implementation Boundary

1. Add host-neutral edit model and round-trip helper.
2. Decode full known `MovieEntity`, replace selected `images[resourceKey]`
   bytes, verify, encode, deflate.
3. Re-decode exported bytes and compare invariants.
4. Use existing inspection/report services for resource facts and post-export
   report smoke.
5. Keep Electron filesystem access behind narrow IPC.
6. Keep main Web preview, project exporter, CLI, import, drag/drop, and
   comparison behavior protected.

## Stop Conditions

Enter `HUMAN_REQUIRED` with `TECHNICAL_REVIEW_REQUIRED` if:

1. Full known-field decode/encode cannot preserve the target fixture.
2. Replacement requires changing sprite references, transforms, layout, or
   timing.
3. Unknown field loss is detected or cannot be bounded for the target file.
4. Save As requires renderer arbitrary filesystem access.
5. Playback can only be proven by static image injection or mocked canvas.
