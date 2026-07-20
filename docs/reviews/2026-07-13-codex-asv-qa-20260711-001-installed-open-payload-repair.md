# Review: Installed Multi-format Open Payload Repair

## Outcome

Status: `Fix Ready / Code Review Required` for `ASV-QA-20260711-001` and
`ASV-REQ-20260709-003`.

The installed `open-file` source discriminant now reaches Lottie/VAP detection,
inspection, runtime preparation, renderer mount, controls, and replacement
flows instead of failing as incomplete input. This is source/dev evidence, not
packaged foreground acceptance.

## Git State

- Branch: `codex/0.2-installed-open-payload-repair-20260713`
- Base: `c3150ead6edc046f70811209ed48c8a99c88243b`
- Final head: pending milestone commit
- Untracked: classified `.pnpm-store/` residue only

## Changed Files

- `src/workbench/lottie-preview-vertical.ts`
- `src/workbench/vap-preview-vertical.ts`
- `src/workbench/multiformat-preview-workspace.ts`
- `src/workbench/multiformat-owner-preview-candidate.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- requirement, fix report, review, retrospective, and visible packet files

## Exact Delta

- Accept the authorized `fileOpenEvent` input source across all four shared
  validators.
- Carry the active hashed `sourceId` through control/replacement/reset results.
- Prevent stale open completions from replacing the active source identity.
- Reuse the renderer's confirmed source identity when a follow-up host result
  omits it.
- Add same-shape synthetic file-open coverage for Lottie, bounded sidecar VAP,
  fusion replacement/reset, and over-limit VAP.

## Finding Ledger And Repair Health

| Finding | Round | Head | External outcome | Root cause | Current state |
|---|---|---|---|---|---|
| `ASV-QA-20260711-001-P016` | Permit 016 | `c3150ead` | Changes Requested | `fileOpenEvent` was absent from downstream source validators; follow-up host results also lost active source identity | Fix Ready, pending independent Code Review |

This is the first review round for this positive-capability input-chain finding.
The earlier terminal-failure repairs solved different acceptance targets and
did not claim positive playback. The repair contract and stop conditions are
recorded in the linked fix report.

## Evidence

- Failure-first test: before repair, actual temporary Lottie path with source
  `fileOpenEvent` returned `failed` instead of `previewReady`.
- Lottie: `previewReady`, adjacent image inlined, image/text inventory present,
  runtime mounted, play/pause retained mount and source identity.
- Bounded VAP: 120x160 MP4 plus adjacent JSON reached `previewReady`, prepared
  runtime payload, mount, play/pause, and facts.
- Fusion VAP: text tag visible; replacement reached mounted `previewReady`;
  reset returned to truthful replacement-required blocked state.
- Over-limit VAP: 1136x1632 reached `vap_dimensions_over_1504`, not generic
  incomplete input.
- Privacy: serialized results contain no temporary path; renderer receives only
  hashed source identity and redacted model data.

## Validation

```text
npm run build
PASS

focused Electron installed-open/runtime/0.1 group
PASS 6/6

focused Lottie/VAP/workspace/owner/asset group
PASS 43/43

npm run test:all
PASS 525/525

npm run desktop:short-term:design-system-check
PASS

node --check session/controller; git diff --check
PASS
```

Package/lockfile drift and production media changed-path scans passed with no
matching files. No dependency or runtime package changed.

## Boundaries And Risks

- Formal 0.1 remains SVGA-only.
- No package rebuild, install/promotion, foreground control, or production
  material mutation was performed.
- No save/export/conversion behavior changed.
- Actual packaged browser playback still requires a rebuilt exact-head
  candidate and bounded installed foreground regression after Code Review.
- This is not QA acceptance, Product Owner acceptance, product support, visual
  success, production readiness, or release readiness.

## Retrospective

- Value: high; one discriminated-union mismatch blocked every installed
  positive format before detection.
- Avoidable cost: static queue tests and positive session tests used different
  source values, allowing the boundary mismatch to survive.
- Reusable lesson: desktop intake discriminants must be replayed unchanged
  through validators and follow-up controls in one test.
- Token usage: unavailable; recorded as unavailable rather than estimated.

## Next Gate

One independent Code Review of the exact Fix Ready head. Packaging and QA remain
blocked until that review returns `Approved For Packaging/QA`.
