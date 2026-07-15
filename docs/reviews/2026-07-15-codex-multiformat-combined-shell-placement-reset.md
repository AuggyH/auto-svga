# Review: 0.2 Multi-format Combined Shell, Placement, And Target Reset

## 1. Summary

Integrated the approved target-scoped Reset authority, source-only startup placement boundary, and OwnerRightPanelSnapshotV1 shell/right-panel boundary into one combined 0.2 multi-format source successor.

This is a source-only implementation handoff. It does not include installed-app replacement, foreground proof, QA acceptance, Packaging approval, Product Owner acceptance, product-support acceptance, distribution, or release readiness.

## 2. Git state

- Branch: `codex/0.2-multiformat-combined-shell-placement-reset-20260715`
- Starting head: `093fcdc7329e11095832fa5ccd2ebbc900bae3b2`
- Reset input head: `6a4640875a8bddf5ae2ecbe04334b5cd167a21b3`
- Placement input head: `093fcdc7329e11095832fa5ccd2ebbc900bae3b2`
- UI/UX input head: `ea8ebb7a7b64394198e6c84e5f695a45fa4e3e2a`
- UI/UX review SHA-256: `6da7f85755a85a7b79c55edb20b685906f2d903f57e51d6ef335c378f5718985`
- Product diff SHA-256 for `src/` + `tools/`: `9cbadbb0b9cf60aea3ba0747a2c4d7423d8cb3a2e3b397c88f8bf30e91d12537`
- Final source commit: recorded in the Implementation Ready callback after this packet is committed.
- Known untracked residue: classified `.pnpm-store/` only.

## 3. Changed files

Key integration files:

- `src/workbench/owner-right-panel-snapshot.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos*.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-*.mjs`
- `tools/electron-prototype/experiments/svga-web/design-system-map.json`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/asv-req-20260709-003-combined-shell-placement-reset-20260715/`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Preserve target-scoped public + canonical + token Reset authority from `6a464087` | Done |
| 2 | Preserve placement pre-BrowserWindow source boundary from `093fcdc` | Done |
| 3 | Integrate OwnerRightPanelSnapshotV1 canonical JSON envelope from `ea8ebb7` | Done |
| 4 | Avoid blind UI/UX merge that deletes placement files | Done |
| 5 | Avoid rejected UI/UX final/rejected heads as integration source | Done |
| 6 | Cancel preserves current model/source/snapshot/commands | Covered by focused composed tests |
| 7 | Accepted Open failure revokes prior model/source/runtime/menu state | Covered by focused composed tests |
| 8 | Replacement and Reset failures preserve current document and sibling replacements | Covered by focused Reset/renderer tests |
| 9 | SVGA 0.1 delegation remains isolated | Covered by focused formal 0.1 tests |
| 10 | Owner-visible right panel does not expose raw model arrays, raw messages, raw paths, or host diagnostic fields | Covered by owner snapshot/envelope tests and privacy scan |

## 5. Integration notes

- The merge conflict in `multiformat-desktop-preview-controller.mjs` was resolved semantically: OwnerRightPanelSnapshotV1 now supplies text target rows, while target-scoped Reset paths remain in place.
- The append-only retrospective ledger conflict was resolved by preserving both lines and validating the JSONL file.
- A VAP snapshot integration bug was fixed: VAP fusion resource IDs are excluded from generic asset image targets so text/image public IDs do not collide.
- The renderer now keeps a private public-to-canonical replacement binding map from accepted host receipts. Owner-visible snapshots remain canonical-display envelopes and do not leak internal runtime keys.

## 6. Verification

Commands run and results:

```text
npm run build
PASS

node --check tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs
PASS

node --check tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/main.cjs
PASS

node --check tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS

node --test dist/tests/multiformat-owner-preview-candidate.test.js
PASS 19/19

node --test tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 27/27

node --test tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement.test.mjs tools/electron-prototype/experiments/svga-web/tests/short-term-window-placement-store.test.mjs
PASS 17/17

node --test --test-name-pattern "macOS package proof|renderer mounts prepared Lottie and VAP runtime payloads" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 6/6

node --test --test-name-pattern "0\\.2|multi-format|replacement|reset|formal 0\\.1|picker|cancel|recent|placement" tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 30/30

node --test tools/electron-prototype/experiments/svga-web/tests/*.test.mjs
PASS 132/132

npm run test:all
PASS 538/538

npm run desktop:short-term:design-system-check
PASS

git diff --check
PASS

TASK_RETRO_LEDGER JSONL parse
PASS strict line-by-line parse, 172 rows
```

Temporary dependency overlay note:

- The full Electron test group needed the established ignored `tools/electron-prototype/node_modules` symlink overlay from the hash-matched `d657` dependency tree.
- Hashes matched for `tools/electron-prototype/package.json`, `tools/electron-prototype/package-lock.json`, and `tools/electron-prototype/experiments/svga-web/package.json`.
- The overlay was removed after the test run.

## 7. Output inspection

- Package/lockfile changed-path scan: no package or lockfile drift.
- Media/archive scan: only approved UI/UX review ZIPs plus this combined review ZIP are expected.
- Handoff hygiene repair: removed the blank JSONL line before the combined milestone ledger entry and resealed the review packet ZIP.
- Production/owner assets: no production assets added or committed.
- Foreground/install: not run.

## 8. Risks

- Placement remains source-approved only; it still needs a later installed first-frame placement discriminator.
- This handoff does not claim installed product matrix success.
- UI/UX shell behavior is integrated at source level and needs downstream Code Review/QA routing by PM/A0.

## 9. Next steps

- PM/A0 independent review of the combined source head.
- If accepted, route one Code Review for the combined source successor.
- Packaging/QA/foreground gates remain downstream and must use exact rebuilt bytes.

## 10. Project retrospective

- Value assessment: High.
- Cost drivers: semantic merge across three approved heads, target authority preservation, owner snapshot privacy boundary, and source-only placement gate.
- Avoidable costs: direct blind merge would have deleted placement work; the early conflict map prevented that.
- Product lesson: owner-visible snapshots and internal runtime authority need an explicit bridge; owner JSON envelopes should not carry private canonical runtime keys.
- Technical lesson: public VAP fusion IDs must be partitioned before deriving generic image rows.
- Design / interaction lesson: shell/right-panel integration should preserve action authority instead of letting display projection become the source of truth.
- Process lesson: exact input-head binding and semantic merge notes are necessary when multiple approved lanes converge.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: Yes.

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: use focused source/test probes and merge maps before broad validation on multi-head integrations.
