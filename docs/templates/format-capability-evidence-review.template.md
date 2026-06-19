# Format capability evidence review

This is a synthetic template. Do not include real user assets, credentials,
absolute local paths, or private logs.

## Review identity

- Review ID: `format-capability-review-0001`
- Reviewed format: `<reviewedFormat>`
- Reviewed capability: `<reviewedCapability>`
- Reviewer: `<reviewer>`
- Review date: `YYYY-MM-DD`
- Proposed review epoch: `<reviewEpoch>`

## Trigger

- [ ] Format specification changed
- [ ] Parser implementation changed
- [ ] Player implementation changed
- [ ] Exporter implementation changed
- [ ] Converter implementation changed
- [ ] Implementation maturity changed
- [ ] Production support changed
- [ ] Stale evidence warning reviewed
- [ ] Project assumption verified

## Previous evidence

- Evidence source: `<previousEvidence.source>`
- Evidence type: `<previousEvidence.type>`
- Confidence: `<previousEvidence.confidence>`
- Review epoch: `<previousEvidence.reviewEpoch>`
- Notes: `<previousEvidence.notes>`

## New evidence

- Evidence source: `<newEvidence.source>`
- Evidence type: `<format_spec | implementation_verified | project_assumption | needs_verification>`
- Confidence: `<high | medium | low | unknown>`
- Review epoch: `<reviewEpoch>`
- Reproduction or validation command: `<command or not applicable>`
- Result summary: `<concise deterministic evidence>`
- Notes: `<newEvidence.notes>`

## Maturity evidence

- Parser support evidence: `<evidence or unchanged>`
- Player support evidence: `<evidence or unchanged>`
- Exporter support evidence: `<evidence or unchanged>`
- Converter support evidence: `<evidence or unchanged>`
- Proposed implementation maturity: `<markers or unchanged>`

## Production-support review

- Production support change requested: `<yes | no>`
- Previous production support: `<supported | not_supported | experimental>`
- Proposed production support: `<supported | not_supported | experimental | unchanged>`
- Separate production review reference: `<required when change requested>`
- Production evidence: `<evidence or not applicable>`
- Rollback: `<rollback plan or not applicable>`

## Decision

- Rationale: `<rationale>`
- Affected recommendation behavior: `<affectedRecommendationBehavior>`
- Client impact: `<clientImpact>`
- Privacy impact: `<none or details>`
- Dependency/license impact: `<none or details>`
- Review epoch advanced: `<yes | no>`
- Decision: `<accepted | rejected | needs_more_evidence>`

## Validation checklist

- [ ] Matrix version remains supported
- [ ] Capability fields remain structurally valid
- [ ] Evidence metadata is complete
- [ ] Implementation maturity matches evidence
- [ ] Production support was reviewed separately if changed
- [ ] Stale warning behavior remains advisory
- [ ] Recommendation remains conservative when evidence is insufficient
- [ ] Targeted tests passed
- [ ] Protected exporter, playback, CLI, import, drag-drop, and comparison paths were not changed
