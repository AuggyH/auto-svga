# Supported Editable SVGA Boundary

Auto SVGA currently supports a bounded image-resource editing subset. It is not
a general SVGA editor.

## Supported

An editable SVGA must satisfy all of these conditions:

1. The file inflates with zlib.
2. The protobuf decodes with `proto/svga.proto`.
3. Embedded images live in `MovieEntity.images`.
4. Replacement changes only existing `images[resourceKey]` bytes.
5. Sprite `imageKey` and `matteKey` references remain unchanged.
6. Movie params, sprite count, frame count, layout, transform, alpha, clip path,
   shapes, audios, and resource key set remain semantically stable after
   re-encode.
7. Exported bytes inflate and decode again.
8. Untouched image hashes match the original.
9. Replaced image hashes match the requested PNG replacements.

## Supported Editing Actions

- Select one embedded image resource.
- Replace one embedded PNG resource.
- Replace multiple embedded PNG resources.
- Reset one selected replacement.
- Reset all replacements.
- Undo and redo bounded edit operations.
- Save As a new SVGA when round-trip validation passes.
- Reopen the saved SVGA for verification.

## Unsupported

The editor must fail closed for:

- Unknown protobuf fields that cannot be preserved.
- Adding or deleting image resources.
- Renaming image keys.
- Changing sprite references.
- Editing transform, layout, timing, alpha, shapes, audios, masks, or frame
  structure.
- Editing non-image resources.
- Text editing.
- Timeline editing.
- Crop, resize, transform, or effect editing.
- Format conversion.
- Arbitrary SVGA rewrite or optimization.

## File Access Boundary

- Browser file input and drag/drop can preview and inspect local bytes.
- Desktop Save As requires a host-side file picker source identity.
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
