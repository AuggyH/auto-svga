# Auto SVGA Human Gates

Date: 2026-06-19

## Human-Required Gates

Codex may stop for human input only when one of these gates is reached:

1. Product direction changes.
2. Visual acceptance or subjective quality judgement.
3. Security exception approval.
4. Frozen milestone contract change.
5. External permission, credential, production service, or public network requirement.
6. Irreversible operation.
7. Existing user work cannot be safely separated from the loop task.
8. Completion requires changing protected product code outside the milestone scope.
9. Completion requires adding a third-party dependency when prohibited by the milestone.

## Not Human Gates

Codex must not stop for:

1. Ordinary implementation choices.
2. Test failures that can be analyzed locally.
3. File organization choices within the allowed scope.
4. Documentation wording choices.
5. Local validation command failures that can be repaired.

## Current M1 Human Gates

For M1 Unified Loop Validation, enter `HUMAN_REQUIRED` only if:

1. Completing M1 requires product code changes.
2. Completing M1 requires a new dependency.
3. Completing M1 requires public network, credentials, or production service access.
4. Existing non-loop user changes appear outside the expected audit/bootstrap/M1 files.
5. The frozen M1 contract must be changed.

## Handoff Gate

Before any terminal `PASS` or `HUMAN_REQUIRED`, the repository handoff command must generate a complete Review Packet. If packet generation fails or mandatory content is missing, continue repair instead of asking the user to assemble materials.
