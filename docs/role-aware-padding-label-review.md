# Role-aware padding label review

`createRoleAwarePaddingLabelReviewReport()` turns validated
`role-aware-padding-labeled-sample` v1 documents into deterministic calibration
evidence. It does not read files, validate JSON Schema, inspect media, or alter
the transparent-padding policy.

## Output

The report includes:

- label counts and distributions;
- missing role and defect coverage;
- provisional unknown and low-confidence coverage gaps;
- exact field agreement for sample, resource, and group labels;
- an explicit `not_provided` boundary for future policy-vs-human comparison.

The unknown-label and low-confidence gap thresholds are both `25%`. They are
calibration coverage indicators, not production gates. Agreement means exact
field equality between at least two distinct reviewers; it is not a statistical
inter-rater score such as Cohen's kappa. Repeated documents from one reviewer do
not increase reviewer coverage.

## Host workflow

1. A host reads external label JSON files.
2. The host validates each document against
   `docs/contracts/role-aware-padding-labeled-sample-v1.schema.json`.
3. The host passes the validated values to the review helper.
4. The resulting JSON summary may be stored outside the repository for
   calibration review.

The helper is host-neutral and offline. File access remains at the host boundary,
so Web, macOS, and Windows clients can reuse the same computation without DOM,
Canvas, filesystem, or browser dependencies. Real assets and real manual labels
remain external and must not be committed.
