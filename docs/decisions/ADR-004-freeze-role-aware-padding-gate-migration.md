# ADR-004: Freeze Role-aware Padding Gate Migration

Date: 2026-06-19

## Status

Paused pending labeled evidence.

## Context

The repository now has a role-aware transparent-padding policy, calibration
results, a versioned manual-label intake contract, and a label review coverage
helper. The policy can produce explainable diagnostics, but no external manual
resource or group labels have been reviewed yet.

The current evidence does not cover the cases needed to estimate false-positive
or false-negative behavior:

- `baked_sweep_frame` resources and groups;
- `mask_or_matte` resources and groups;
- fully transparent unused frames;
- `classifier_wrong_role` labels;
- human-reviewed resource and group defect intent.

Automated classification and historical sample distributions cannot substitute
for these labels. Migrating the advisory into a production gate now would turn
unmeasured assumptions into delivery failures.

## Decision

1. Pause role-aware transparent-padding production-gate migration.
2. Keep the current role-aware policy as advisory diagnostics only.
3. Keep the `production_target` thresholds and production gate unchanged.
4. Do not tune gate behavior from automatic classification alone.
5. Do not implement policy-vs-human comparison until the resume conditions are
   satisfied.

## Resume Conditions

Work may resume only when all of the following evidence is available:

1. At least one batch of external v1 label JSON documents.
2. Labels from at least two distinct reviewers.
3. Human-reviewed coverage for:
   - `static_image`;
   - `sequence_frame`;
   - `baked_sweep_frame`;
   - `mask_or_matte`;
   - `fully_transparent_unused_frame`;
   - `classifier_wrong_role`.
4. A coverage and reviewer-agreement summary produced by
   `createRoleAwarePaddingLabelReviewReport()`.

The label files and referenced assets remain external. Real labels, SVGA files,
and PNG files must not be committed to the repository.

## Next Task After Resume

Implement a deterministic policy-vs-human comparison helper. It must consume
existing policy output and validated human labels, report disagreements and
coverage limitations, and must not infer missing labels.

## Consequences

- Current production delivery behavior remains stable.
- Calibration can continue without creating an unverified production gate.
- No false-positive or false-negative rate is claimed before labeled evidence
  exists.
- The pause may delay gate migration, but preserves explainability and prevents
  historical samples from weakening the future production target.

## Rejected Alternatives

### Promote the current advisory immediately

Rejected because role coverage and reviewer evidence are insufficient to
measure false positives or false negatives.

### Infer labels from automated resource classification

Rejected because that would compare the policy against its own assumptions and
would not provide independent human evidence.

### Relax production thresholds from historical samples

Rejected because catalog compatibility and future production quality are
separate concerns.
