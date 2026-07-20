# Review: Multi-format production input replaceability CR-001 physical source repair

## 1. Summary
Closed the remaining `MF-REPLACEABILITY-CR-001` same-byte physical source
replacement gap from the Code Re-review of
`c581674094d111f8df1a81dcf009daf93082ff5a`.

The previous repair compared Open-time and current source bytes, but SVGA Apply
and Reset could still accept an atomic same-byte source replacement because the
SHA-256 stayed unchanged while the physical file identity changed. This
successor makes SVGA replacement authority descriptor-bound:

- Open records source file type, `dev`, `ino`, `nlink`, size, SHA-256, parent
  directory identity, and canonical parent path.
- `activeSvgaSourceBinding()` now revalidates that physical identity before
  Apply or Reset.
- Apply revalidates again after the asynchronous replacement-preparation
  boundary before publishing accepted state.
- Same-byte inode replacement and parent directory swap now return typed
  blocked feedback before revision/runtime/remount mutation.

No Lottie, VAP, SVGA target classification, UI styling, save/export,
foreground, installed app, QA, or Packaging behavior was changed.

## 2. Git state
- Branch: `codex/0.2-production-input-replaceability-repair-20260716`
- Rejected predecessor: `c581674094d111f8df1a81dcf009daf93082ff5a`
- Successor commit: final head reported to PM/A0 after this packet is sealed.
- Classified untracked residue preserved: `.pnpm-store/` only.

## 3. Changed files
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `docs/reviews/2026-07-16-codex-multiformat-production-input-replaceability-cr001-physical-source-repair.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Failure-first evidence
Added a direct desktop-session regression for same-byte physical source
replacement. Before the fix, the first case failed with:

```text
Expected blocked, actual accepted
```

The final test covers:
- same-byte atomic inode replacement before Apply;
- same-byte atomic inode replacement before Reset;
- same-byte atomic inode replacement during the asynchronous Apply boundary;
- parent directory swap with the same source bytes.

## 5. Validation
```text
node --test --test-name-pattern "same-byte SVGA source identity" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
FAIL before fix: Apply returned accepted
PASS after fix 1/1

node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

node --test --test-name-pattern "same-byte SVGA source identity|Lottie intake rejects|Lottie runtime rejects|source mutation and stale source IDs|replaceable wide SVGA" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 6/6

npm run build
PASS

node --test dist/tests/multiformat-preview-workspace.test.js dist/tests/multiformat-owner-preview-candidate.test.js dist/tests/multiformat-asset-qualification.test.js dist/tests/lottie-preview-vertical.test.js dist/tests/lottie-svg-playback-adapter.test.js dist/tests/vap-preview-vertical.test.js dist/tests/vap-inspection.test.js dist/tests/vap-playback-preparation.test.js dist/tests/short-term-image-replacement-preview-session.test.js dist/tests/short-term-image-replacement-workflow.test.js
PASS 104/104

npm run test:all
PASS 542/542

npm run desktop:short-term:design-system-check
PASS
```

```text
git diff --check
PASS

strict TASK_RETRO_LEDGER.jsonl parse
PASS 191 rows

changed-path package/lock/media scan
PASS no matches
```

Visible packet manifest and ZIP integrity are sealed after the final commit so
the packet can bind the exact successor head.

Product source diff SHA-256 over `src/` and `tools/` relative to `c5816740`:
`cd5712c22c54b237edfc2eb9d1c7e925260e37c58343c28087503fb2ec0928a3`.

## 6. Finding status
- `MF-REPLACEABILITY-CR-001`: fixed in this successor.
- `MF-REPLACEABILITY-CR-002`: preserved closed.
- `MF-LOTTIE-CR-001`: preserved closed.
- `MF-SVGA-TARGET-CR-001`: preserved closed.

## 7. Boundaries
- Source-only repair.
- No Electron/Auto SVGA launch, foreground, installed app mutation, Packaging,
  QA, Product Owner acceptance, support, distribution, or release claim.
- No owner material, screenshots, dialogs, Finder, save/export, dependencies,
  or UI styling changes.

## 8. Next gate
PM/A0 may route this exact successor to focused Code Re-review for
`MF-REPLACEABILITY-CR-001` closure. Installed QA requires a rebuilt exact-head
candidate and a separate QA route.

## 9. Project retrospective
- Value assessment: High
- Cost drivers: the remaining gap required distinguishing byte equality from
  physical file identity across synchronous and asynchronous replacement
  boundaries.
- Avoidable costs: the first CR repair proved SHA stability but did not include
  a same-byte inode replacement adversarial case.
- Product lessons: Open-time replacement authority is a physical source
  descriptor, not only a path or content hash.
- Technical lessons: Apply/Reset publish points must revalidate source identity
  after asynchronous work, even when bytes are unchanged.
- Process lessons: a single focused adversarial test exposed and then closed the
  remaining finding without reopening Lottie/VAP/SVGA target behavior.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No

## 10. Token usage
- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
