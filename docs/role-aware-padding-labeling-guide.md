# Role-aware Padding Manual Labeling Guide

## Purpose

This intake contract captures small, manually reviewed avatar-frame samples for
role-aware transparent-padding calibration. It provides human evidence for
false-positive, false-negative, and role-classification review. It does not
change the production specification, policy, report contract, or gate.

- Schema: `docs/contracts/role-aware-padding-labeled-sample-v1.schema.json`
- Blank synthetic template:
  `docs/templates/role-aware-padding-labeled-sample.template.json`
- Current contract version: `1`

Keep SVGA, PNG, preview media, and local job output outside the repository.
Use `externalReference` or a non-sensitive `fileName`; do not record an absolute
user path. Review filled label files for names or notes that may expose private
information before sharing or committing them.

## Sample-level Labels

Required fields:

- `sampleId`: stable identifier independent of the local path.
- `fileName` or `externalReference`: external lookup handle; at least one is required.
- `assetType`: currently `avatar_frame` only.
- `canvasSize`, `fps`, `durationMs`: copied from deterministic inspection data.
- `sourceType`: `production_target`, `legacy`, `experimental`, or `unknown`.
- `reviewer`, `reviewDate`: review provenance.
- `labelConfidence`: `high`, `medium`, `low`, or `unknown`.

Do not mark a historical asset as `production_target` merely because it is
widely deployed. Historical distribution must not relax the future production
target.

## Resource-level Labels

Record every reviewed resource using its stable `resourceKey`:

- `detectedRole`: role produced by inspection.
- `humanRoleLabel`: reviewer-confirmed role, or `unknown`.
- `roleLabelConfidence`: confidence in the human role label.
- `isDefect`: `true`, `false`, or `null` when unknown.
- `defectType`, `defectSeverity`, `paddingIntent`, and concise `notes`.

Role values are `static_image`, `sequence_frame`, `baked_sweep_frame`,
`mask_or_matte`, and `unknown`.

Defect types:

- `excessive_static_padding`
- `excessive_sequence_padding`
- `unnecessary_canvas_aligned_frames`
- `required_canvas_alignment`
- `fully_transparent_unused_frame`
- `near_empty_frame`
- `mask_size_mismatch`
- `baked_sweep_expected_padding`
- `classifier_wrong_role`
- `no_issue`
- `unknown`

Padding intent values:

- `accidental_waste`
- `required_alignment`
- `required_mask_match`
- `required_sequence_consistency`
- `baked_effect_artifact`
- `unknown`

Consistency rules:

1. If the result is unknown, use `isDefect: null`, `defectType: unknown`, and
   explain the missing evidence in `notes`.
2. If `isDefect` is false, use `defectType: no_issue`.
3. If `isDefect` is true, identify a concrete defect type rather than guessing.
4. Use `classifier_wrong_role` only when visual or authoring evidence confirms
   the detected role is wrong.

## Group-level Labels

Sequence and baked resources must be reviewed as groups before individual
padding is called defective. Record:

- `groupId`, `groupType`, and `frameCount` from deterministic inspection data.
- `intendedAlignment`: `canvas`, `local_bounds`, `target_layer`, or `unknown`.
- `canCropWithOffset`: whether group-level cropping can preserve placement.
- `shouldRemainCanvasAligned`: whether full-canvas registration is required.
- `groupDefectType`, `groupSeverity`, and `notes`.

Review rules:

1. Sequence frames: inspect group alignment and motion continuity first. A
   padded frame alone is not proof of a defect.
2. Mask/matte: compare dimensions and alignment with the target layer.
3. Baked sweep: distinguish required effect travel space from meaningless
   transparent allocation.
4. Fully transparent frames: verify whether they encode intentional timing or
   are unused before labeling a defect.
5. Unknown evidence stays `unknown`; never infer intent from filenames alone.

## Minimum Calibration Set

Before considering policy or gate migration, collect manually reviewed examples
covering:

- static resources below and above the provisional 50% threshold;
- sequence groups with required and unnecessary canvas alignment;
- baked sweep groups;
- mask/matte resources matched and mismatched to targets;
- unknown-role and classifier-error cases;
- intentional and unused fully transparent frames.

Calibration should report sample count, label confidence, confusion by role,
and unresolved unknowns. Production-gate changes require explicit product
approval and are outside this labeling contract.

## Versioning

`schemaVersion: 1` is the current intake contract. Optional additive metadata
may remain compatible with v1, but removing required fields, changing field
types, or redefining enum meaning requires a new schema version and an explicit
migration. Review tools must reject unsupported versions rather than silently
reinterpret labels.

## Client and Privacy Boundary

The schema is JSON-only, host-neutral, offline, and portable across macOS,
Windows, Web hosts, and future desktop clients. It adds no runtime dependency,
network requirement, AI service, or binary asset. Desktop hosts should keep
external file resolution behind their filesystem permission boundary and store
only reviewed metadata in the label document.
