# Review: UI/UX OwnerRightPanelSnapshotV1

## 1. Summary

Implemented the fourth `UIUX-MF-SHELL-CR-001` repair as the accepted
architecture from the third-recurrence retrospective: owner-visible
multi-format right-panel data now crosses a typed, branded, canonical snapshot
boundary instead of renderer-side inspection of arbitrary live model objects.

The repair introduces `OwnerRightPanelSnapshotV1`, binds it into the
main-process candidate/session result, and makes the renderer consume only a
verified canonical JSON envelope. Raw host/parser messages, paths, structural
paths, unsupported feature expressions, generic labels, generic details, and
arbitrary nested model objects no longer form owner-visible right-panel input.

This is a source repair only. No foreground, installed app, Packaging,
promotion, QA, target Reset integration branch, placement implementation, or
Product Owner acceptance was performed.

## 2. Git state

- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Commit before work: `5f9ddff1411b1e4811328bcc7554c38ab026afab`
- Target finding: `UIUX-MF-SHELL-CR-001`
- Prior rejected handoff: `c778d58c02bca1dc2a8b2b61da980d81d5287c13`
- Accepted retrospective: `docs/retrospectives/2026-07-15-uiux-mf-shell-cr001-third-recurrence.md`
- Requested model profile: `gpt-5.6-sol / xhigh`
- Actual compatible profile recorded for this route: `gpt-5.5 / xhigh`

## 3. Changed files

- `src/workbench/owner-right-panel-snapshot.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-15-codex-uiux-owner-right-panel-snapshot-v1.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/uiux-owner-right-panel-snapshot-v1-20260715/REVIEW_PACKET.md`
- `review/uiux-owner-right-panel-snapshot-v1-20260715/VALIDATION_SUMMARY.json`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Construct owner-visible right-panel records from an explicit schema, not raw model/rightPanel spreads | Done |
| 2 | Mint a module-private snapshot capability only after full validation and freezing | Done |
| 3 | Serialize only branded snapshots into bounded canonical JSON with schema, byte length, SHA-256, and `pathRedacted=true` | Done |
| 4 | Renderer validates envelope schema, byte length, digest, and deterministic reserialization before rendering | Done |
| 5 | Trusted issue/feature/fact text comes from fixed copy maps or typed primitives only | Done |
| 6 | Replacement rows use snapshot-derived image/text targets; opaque target IDs remain action metadata, not display copy | Done |
| 7 | Raw message/path/additional/detail fields do not cross the owner-visible boundary | Done |
| 8 | Proxy/accessor/coercion/array/object tampering fails closed without executing Proxy traps at the brand boundary | Done |
| 9 | Preserve `UIUX-MF-SHELL-CR-002`: Cancel preservation and accepted Open failure revocation | Done |
| 10 | Do not implement placement, packaging, target Reset integration, or foreground acceptance in this repair | Done |

## 5. Architecture notes

`src/workbench/owner-right-panel-snapshot.ts` is the new producer-side trust
boundary. It creates all owner-visible containers internally, admits only typed
primitive values and fixed enum/copy maps, freezes the completed tree, and then
mints a module-private `WeakSet` brand. Serialization checks that brand before
reading snapshot fields, so arbitrary Proxy/live objects are rejected before
property access.

`multiformat-desktop-session.cjs` rebinding is deliberately narrow: it carries
the already produced snapshot envelope and sets a safe `sourceId`. It does not
construct owner copy or accept raw model data.

`projectMultiFormatRightPanel()` now consumes only a verified
`ownerRightPanelSnapshotEnvelope` or a direct envelope. Missing, malformed,
noncanonical, overlength, tampered, or unsupported envelopes fail closed to a
generic renderer-owned owner issue.

`multiformat-desktop-preview-controller.mjs` uses the snapshot projection for
right-panel facts, replaceable image rows, replaceable text rows, default target
selection, target existence checks, and issue summaries. Raw `rightPanel`
arrays are not used as owner-visible display input.

## 6. Placement contract note

The successor window-placement contract in
`docs/reviews/2026-07-15-codex-multiformat-window-placement-successor-contract.md`
does not conflict with UI/UX direction.

Design-authority position:

- Normal owner launch may restore a previously valid placement, clamp it into
  the current online display work area, and fall back to primary when invalid.
- The internal acceptance-only display-id override is acceptable only because it
  exposes no UI, accepts no coordinates, persists no owner preference, and is
  gated to the internal candidate/acceptance identity.
- Placement implementation remains a later Electron host task and was not
  edited here.

## 7. Verification

Dependency note: this isolated worktree lacked local dependency directories.
Validation used temporary ignored `node_modules` symlinks after lockfile hash
matching, then removed those symlinks before final handoff.

Commands run:

```text
node --check tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

npm run build
PASS

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 15/15

node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 27/27

node --test --test-name-pattern "multi-format|owner|right-panel|renderer mounts prepared|open cancellation|reset" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 12/12

npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
PASS 113/113

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS

TASK_RETRO_LEDGER JSONL parse
PASS

package/lockfile changed-file scan
PASS, no matches

production media/archive changed-file scan
PASS, no matches
```

## 8. Risks

- This repair intentionally changes owner-visible projection architecture, so
  Code Review should focus on whether any direct `rightPanel` read remains
  outside the snapshot projection.
- The repair does not combine with the target-scoped Reset successor; it only
  preserves action metadata enough for current replacement rows.
- This does not prove installed/native-titlebar visual acceptance or
  foreground behavior.

## 9. Next steps

1. PM/A0 routes this exact head to independent Code Review.
2. Code Review should rerun direct malicious projection probes against
   `projectMultiFormatRightPanel()`, replacement rows, and session public
   result.
3. If approved, QA can validate source behavior separately; installed/foreground
   acceptance remains a separate lane.

## 10. Commit

- Commit: final handoff commit is reported in the Fix Ready callback.
- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Tag: none

## 11. Project retrospective

- Value assessment: High
- Cost drivers: prior repairs treated leak symptoms as projector-local copy
  problems instead of moving the owner-visible trust boundary earlier.
- Avoidable costs: every owner-visible right-panel path, including replacement
  rows, should have been mapped before the first CR repair.
- Product lessons: owner-visible multi-format diagnostics need fixed copy and
  typed provenance, not translated runtime data.
- Technical lessons: branded primitive-only snapshots plus bounded canonical
  JSON are a better boundary than descriptor-only reads of arbitrary inputs.
- Design / interaction lessons: visible row labels and details are product copy;
  action IDs are authority metadata and must not become fallback display copy.
- Process lessons: a third-recurring finding should produce an architecture
  contract before a fourth repair, which this task followed.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No, the dedicated third-recurrence retrospective already records the reusable
  lesson.

## 12. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: the architecture-contract repair reduced further guessing; the
  remaining cost was mainly full regression evidence and handoff hygiene.
