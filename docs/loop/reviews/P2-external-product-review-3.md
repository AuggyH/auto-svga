# P2 External Product Review 3

Date: 2026-06-20

externalOutcome: REPAIR_REQUIRED

reviewedHeadCommit: 2ae8b7bee0424ced23306ad353a8baa2ca7bac12

engineeringOutcome: PASS_WITH_RENDER_AND_EVIDENCE_DEFECTS

productVisualOutcome: REPAIR_REQUIRED

## Blocking Findings

1. `desktop-empty.png` does not show a visible central upload instruction, upload icon, or `选择 SVGA 文件` button.
2. `desktop-loading.png` does not show a visible central loading indicator, current file name, or parse progress message.
3. `desktop-invalid.png` does not show visible product error copy and retry button in the player center.
4. The parity report and `reviewer-b-product-categories.json` mark state visibility as PASS based on source/DOM/report existence instead of rendered screenshot evidence.
5. The P2 upload ZIP exposes local private paths in text and JSON files.
6. Invalid state uses `broken.svga`, but artifact and comparison metadata still label it as the canonical valid fixture.
7. Empty state incorrectly binds canonical fixture metadata when no file is loaded.
8. Canonical `.svga` bytes are recorded with `image/png` MIME in artifact metadata.
9. Comparison images use a fixed oversized canvas with excessive blank bottom area.
10. Reviewer B category output was generated deterministically from reports and did not catch invisible rendered central states.

## Required Repair Boundary

Repair 4 must close rendered-state fidelity, scenario metadata truthfulness, review bundle privacy, comparison cropping, and independent visual review evidence without changing the frozen P2 objective, acceptance criteria, prohibited scope, or loop budget.
