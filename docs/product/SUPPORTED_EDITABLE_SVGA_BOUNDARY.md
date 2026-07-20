# Supported Editable SVGA Boundary

Auto SVGA supports a bounded SVGA editing subset. It is not a general SVGA
editor.

This boundary supports the main PRD in
`docs/product/PRODUCT_ROADMAP.md`. If this document appears to require a
short-term feature that the main PRD does not require, the main PRD wins.

## Supported

An editable SVGA must satisfy all of these conditions:

1. The file inflates with zlib.
2. The protobuf decodes with `proto/svga.proto`.
3. Embedded images live in `MovieEntity.images`.
4. Replacement changes only existing `images[resourceKey]` bytes unless the
   operation is an explicit imageKey rename.
5. ImageKey rename updates every related Sprite `imageKey` and `matteKey`
   reference and must not leave dangling references.
6. Movie params, sprite count, frame count, layout, transform, alpha, clip path,
   shapes, audios, and unsupported frame structure remain semantically stable
   after re-encode.
7. Exported bytes inflate and decode again.
8. Untouched image hashes match the original.
9. Replaced image hashes match the requested PNG replacements.

## Replaceable Element Rule

In product language, a replaceable element is a designer-intended, manually
named imageKey. Automatic export names such as `img_000` / `img_001` remain
ordinary image assets, even though the runtime could technically address them
as imageKeys.

Short-term detection uses simple naming rules to exclude automatic names.
Future versions may add configurable whitelist/blacklist regular expressions.

## Short-term Required Editing Actions

- Rename an existing imageKey and update all related references.
- Preview one replaceable image by imageKey without entering Edit mode.
- Reset a runtime image replacement preview.
- Preview replaceable text through runtime dynamic text replacement. This
  simulates terminal playback behavior and is not direct SVGA-byte text editing.
- Reset runtime text replacement preview.
- Overwrite Save when round-trip validation passes and the user explicitly
  chooses overwrite.
- Save As a new SVGA when round-trip validation passes.
- Reopen the saved SVGA for verification.

Persisted image replacement output is allowed only when the app exposes it as a
real byte-editing action and can pass the same known-field invariant,
inflate/decode, and reopen checks. Runtime-only image replacement preview must
not enable save actions by itself.

## Incubated Or Future Editing Actions

These capabilities may exist in historical prototypes or future plans, but they
are not short-term product-surface requirements unless the Product Owner
explicitly promotes them into the main PRD:

- Replace one embedded PNG resource as persisted byte output.
- Replace multiple embedded PNG resources.
- Reset selected/all persisted image replacements.
- Undo and redo bounded edit operations.

## Unsupported

The editor must fail closed for:

- Unknown protobuf fields that cannot be preserved.
- Adding or deleting image resources as a general editor action.
- Renaming an imageKey without updating all related references.
- Changing sprite references except as the required consequence of a validated
  imageKey rename.
- Editing transform, layout, timing, alpha, shapes, audios, masks, or frame
  structure.
- Editing non-image resources.
- Persisting text changes directly into SVGA bytes.
- Timeline editing.
- Manual crop, resize, transform, or effect editing.
- Format conversion.
- Arbitrary SVGA rewrite or unvalidated optimization.

The optimization flow may remove proven unreferenced resources, deduplicate
byte-identical resources, or apply other main-PRD-approved optimization methods
only under the optimization contract in `docs/product/PRODUCT_ROADMAP.md`.
Those optimizer actions do not make general resource deletion or transform
editing supported.

## File Access Boundary

- Browser file input and drag/drop can preview and inspect local bytes.
- Desktop Overwrite Save and Save As require a host-side file identity and
  explicit user action.
- Renderer code must not receive arbitrary filesystem access.
- Reports and logs must not persist absolute user paths.

## Security Boundary

- Electron work remains an internal prototype path.
- Browser workflow and `npm run local:preview` remain the stable rollback.
- The `svga-web` Electron candidate uses a restricted CSP with an internal-only
  `wasm-unsafe-eval` exception; this is not production desktop approval.
- No telemetry, external AI, model service, CDN runtime loading, or network
  analysis is part of this boundary.

## Review Rule

If a file does not meet this boundary, record the failure reason and keep the
file unsupported. Do not silently rewrite, downgrade, or infer unsupported SVGA
semantics.
