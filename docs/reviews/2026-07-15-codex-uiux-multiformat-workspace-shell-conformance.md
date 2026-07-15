# Review: Multi-format Workspace Shell Conformance

## 1. Summary

This UI/UX milestone converges the multi-format Preview workspace onto the
accepted Auto SVGA canvas-first shell without creating a second panel, row,
drag, or control system.

Completed owner-visible changes:

- SVGA, Lottie, and VAP now share one capability-driven Preview shell and
  right information surface.
- The drag decision surface keeps the documented 25% Compare / 75% Open intent
  for an SVGA file dropped onto an open SVGA document. Lottie, VAP, and
  cross-format drops remain Open-only.
- Format inventory, facts, issue states, and asset rows use localized product
  labels instead of renderer phases, internal codes, raw byte counts, or raw
  English errors.
- Multi-format image rows reuse the shared `AssetRow` molecule. A visible
  `替换图片` action is exposed only through the existing replacement command.
- Loading, failure, close, and format transitions clear stale metadata and
  unavailable actions. Non-SVGA Edit remains disabled.
- Design-system traceability now covers the multi-format right surface,
  compare metric columns, replaceable rows, and related page states.
- Light/dark, focus-visible, responsive containment, and state styling are
  tokenized through the existing short-term design system.

No new product scope, deferred editor controls, save/export behavior, host
authority, package, or installed application was added by this milestone.

### Code Review repair

The first repair closes `UIUX-MF-SHELL-CR-002` from governance review
`e1795ce7`:

- `UIUX-MF-SHELL-CR-002`: chooser Cancel preserves the active document, while
  an accepted Open attempt that fails revokes the old model/source/selection,
  runtime replacements, command state, and SVGA legacy delegation before the
  failure state renders.

`UIUX-MF-SHELL-CR-001` remained open after re-review governance `839fb6ef`.
The root-cause repair is now implemented at
`5f6f1b781f5d9d3e8c33fc5f6b90c3123368be88`: every right-panel projection
record is constructed from an empty object through a fixed schema; upstream
records are never spread, and trusted identities are read only from own data
descriptors as exact primitive strings. The finding remains open until
independent Code Re-review accepts this successor.

The authority cleanup repair is
`8b8f9221ee70d6e1df6fdcf2a88307ff6dfb7034`. The exact final product repair
after the Early Advisory follow-up is
`2247303be8a58049c7600ea77a37fd42c78d57f5`; it replaces the residual
Chinese-text heuristic in `ownerFailureCopy()` with an immutable exact-code
allowlist. Raw Chinese paths, mixed-language technical text, unknown codes,
objects, arrays, accessors, coercible values, and additional host fields now
all collapse to one fixed generic Chinese failure. Reviewed codes render only
renderer-owned fixed copy.
Its validation byte record is
`review/uiux-multiformat-workspace-shell-conformance-20260715/VALIDATION_SUMMARY.json`
with SHA-256
`4dc7df0259079c7484cce4033cf7c26c2cb2c4c78479a675a687d1914a99767e`.

### Active Finding Ledger And Repair Health

| Finding | Round | Reviewed head | Outcome | Current status | Latest evidence | Attempted fix | Why it did not close | Recovery work package |
|---|---:|---|---|---|---|---|---|---|
| `UIUX-MF-SHELL-CR-001` | 2 | `3aa0143f397d7117d576000c364b78bbd8982c78` | Changes Requested | Root-cause repair implemented at `5f6f1b78`; pending independent re-review | Failure-first reproduced `Cannot convert a Symbol value to a string`; repaired nested matrix produces exact key sets with zero getter/coercion calls and no raw paths | Closed all five right-panel projection levels with descriptor-only reads and fixed output schemas | The prior repair treated one controller helper as the full trust boundary; the separate right-panel projector retained coercion and open-ended spreads | Return one exact Fix Ready successor to independent re-review |
| `UIUX-MF-SHELL-CR-002` | 2 | `3aa0143f397d7117d576000c364b78bbd8982c78` | Closed at source boundary | Closed for this repair; downstream installed validation separate | Cancel and accepted-failure composed regressions cover active SVGA/Lottie/VAP authority | Split Cancel from accepted Open failure and revoke prior authority only for the latter | N/A | Preserve unchanged while repairing CR-001 |

Root-cause hypothesis: the renderer has two independent owner-copy trust
boundaries. The previous repair secured terminal failure copy but left the
right-panel projector operating as a permissive sanitizer over upstream
objects. A permissive sanitizer cannot prove field closure when it starts with
object spread or evaluates values through coercion.

Failure-first scenario: project a right-panel model containing arrays,
accessors, boxed/coercible values, symbols/numerics, and raw fields at source,
inventory, group, asset, and item levels. The current source must fail because
it executes accessors, assigns trusted localized meaning to non-string values,
or serializes unreviewed fields.

Repair contract:

1. Construct every owner-visible projection record from an empty object with
   an explicit immutable schema; do not spread upstream records.
2. Read trusted strings only from own data descriptors and accept only exact
   primitive strings. Execute no getter, `toString`, `Symbol.toPrimitive`,
   array, or template coercion.
3. Map unknown or malformed identity to fixed renderer-owned generic copy or
   omit the record according to the existing visible contract.
4. Preserve the closed CR-002 Cancel and accepted-Open-failure transitions.

Success stop: the original reviewer probes and the full nested mutation matrix
produce only enumerated output keys, fixed localized copy, zero raw path or
technical-field serialization, and zero getter/coercion execution while the
existing SVGA/Lottie/VAP workflows stay green.

Failure stop: stop this repair if any unreviewed field survives, any accessor
or coercion executes, or closure would require host placement, target-scoped
Reset integration, new product vocabulary, foreground evidence, or cross-lane
source selection.

Repair outcome: success stop reached at source and regression boundaries.
Arrays, boxed strings, coercible objects, symbols, numerics, accessors, and
extra fields at right-panel, inventory, group, asset, and item levels either
map to fixed product copy or are omitted. Exact output key sets are asserted,
getter/coercion invocation counts remain zero, and raw message/path/additional
fields are absent. No failure-stop dependency was crossed.

## 2. Git state

- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Commit before work: `7cba862ed25986a0a50970222077dc5820e5f0aa`
- Original milestone head: `1ca67dce21a185559a7821ccf746747cb4c09273`
- Authority repair head: `8b8f9221ee70d6e1df6fdcf2a88307ff6dfb7034`
- Final product repair head: `2247303be8a58049c7600ea77a37fd42c78d57f5`
- Root-cause projector repair head: `5f6f1b781f5d9d3e8c33fc5f6b90c3123368be88`
- Final handoff head: the docs-only descendant reported in the Fix Ready
  callback

## 3. Changed files

- `tools/electron-prototype/experiments/svga-web/design-system-map.json`
- `tools/electron-prototype/experiments/svga-web/scripts/check-short-term-design-system.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs`
- `tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs`
- `tools/electron-prototype/experiments/svga-web/web/index.html`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-compare-model.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-dom-state.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-drag-decision-surface.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-overview-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos-replaceable-renderers.mjs`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.modules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.molecules.css`
- `tools/electron-prototype/experiments/svga-web/web/short-term-macos.tokens.css`
- `docs/reviews/2026-07-15-codex-uiux-multiformat-workspace-shell-conformance.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`
- `review/uiux-multiformat-workspace-shell-conformance-20260715/REVIEW_PACKET.md`
- `review/uiux-multiformat-workspace-shell-conformance-20260715/VALIDATION_SUMMARY.json`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | One shared canvas-first Preview shell for SVGA/Lottie/VAP | Done |
| 2 | Capability-driven controls and format-specific facts | Done |
| 3 | 25/75 SVGA drag decision; non-SVGA and cross-format Open-only | Done |
| 4 | Shared token/component/page-state traceability | Done |
| 5 | Localized product copy without internal codes/phases | Done |
| 6 | Light/dark, focus, responsive, empty/loading/failure contracts | Source/headless validated |
| 7 | Preserve existing 0.1 SVGA Preview/Edit/Compare behavior | Source regression validated |
| 8 | Installed native-titlebar and production-material visual acceptance | Pending; foreground infrastructure blocked before product input |
| 9 | Target-scoped Lottie/VAP Reset | Reconciliation dependency; not implemented against the old global-reset host contract |
| 10 | Pixel-level Figma fidelity | Not claimed; existing five-package R12 evidence remains the current baseline |

## 5. Verification

```text
node --check <changed JS modules, tests, and design-system checker>
PASS

node --test --test-name-pattern "short-term general compare|image replacement|open contract" \
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 3/3

node --test --test-name-pattern \
  "image replacement controls use a host picker|owner failure rendering trusts only reviewed codes|open cancellation preserves active authority|renderer open contract" \
  tools/electron-prototype/experiments/svga-web/tests/svga-web-experiment.test.mjs
PASS 4/4

node --test \
  tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 27/27

node --test --test-name-pattern \
  "owner issue projection|owner right-panel projection" \
  tools/electron-prototype/experiments/svga-web/tests/multiformat-conformance-milestone.test.mjs
PASS 2/2; exact nested schema, zero getter/coercion, and raw-field probes

npm run desktop:short-term:design-system-check
PASS

npm --prefix tools/electron-prototype/experiments/svga-web run spike:svga-web:test
PASS 113/113

git diff --check
PASS

privacy/raw-field scan
PASS: no projector record spread, untrusted global String/template coercion,
or rawPath/extraPath/diagnostics/additionalFields forwarding
```

The isolated worktree had no dependency directories. Validation temporarily
reused lockfile-matched, ignored dependency symlinks from existing worktrees;
both symlinks were removed after the checks. No lockfile was modified.

## 6. Output inspection

- Source/headless inspection: shared shell, right surface, drag intent,
  replacement action, tab/focus semantics, stale-state suppression, and
  component traceability verified.
- Figma evidence: the accepted five-package R12 delivery remains the visual
  baseline. No broad FBP rerun or Figma MCP call was needed because the local
  R4 component packet answered the exact shared AssetRow action question.
- Foreground inspection: not run. Permit075-077 placement attempts failed in
  control infrastructure before product input; this is not recorded as a
  product UI failure or acceptance.

## 7. Risks and nonclaims

- Base `7cba862e` discards replacement `targetId`, so it cannot support an
  honest per-row Reset. This milestone does not fake per-row authority.
- Successor `6a4640875a8bddf5ae2ecbe04334b5cd167a21b3` is under independent Code
  Re-review. After approval, the UI/UX lane must independently inspect and
  reconcile its target-scoped Reset contract into shared `AssetRow` and the
  right surface; this milestone does not cherry-pick or depend on it.
- Installed Launch currently derives initial placement before a window exists.
  Do not resume coordinate guessing. A later design-authorized contract should
  restore the last valid display/bounds or accept an exact task-bound launch
  display override, while preserving normal owner choice and never silently
  forcing a second display.
- No installed/native-titlebar/real-production-material visual acceptance.
- No pixel-fidelity PASS, Product Owner acceptance, packaging, promotion,
  support, distribution, or release claim.

## 8. Next steps

1. Independent Code Re-review of root-cause projector repair `5f6f1b78` and
   its docs-only handoff descendant; `UIUX-MF-SHELL-CR-001` remains open until
   that disposition.
2. After the separate Reset successor is source-approved, inspect and reconcile
   its per-row Reset semantics without duplicating host authority in UI code.
3. Redesign the foreground placement validation ladder, then run one coordinated
   installed-client walkthrough on the non-main display with real materials.
4. Use FBP for stable batched design facts and Figma MCP selectively for exact
   unsupported node/component/variable facts; neither should replace the other.

## 9. Commit

- Authority repair commit: `8b8f9221ee70d6e1df6fdcf2a88307ff6dfb7034`
- Owner-copy boundary repair commit: `2247303be8a58049c7600ea77a37fd42c78d57f5`
- Right-panel projection root-cause repair commit:
  `5f6f1b781f5d9d3e8c33fc5f6b90c3123368be88`
- Handoff commit: recorded in the Fix Ready callback
- Branch: `codex/uiux-multiformat-r12-conformance-20260715`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: inherited multi-format controller duplication, raw technical
  projections, and the old global Reset host contract
- Avoidable costs: three focused/full regressions initially asserted obsolete
  markup or copy; aligning tests with the shared component contract closed them
  before handoff
- Product lessons: new formats should inherit the accepted workspace and expose
  only capabilities they actually own
- Technical lessons: centralize owner-facing projections and reuse shared row
  factories rather than rebuilding right-panel markup per format
- Design / interaction lessons: a visible direct action must match real host
  semantics; UI must not simulate target-scoped Reset over a global command
- Process lessons: one bundled source/headless validation pass was cheaper and
  more reliable than repeated package/foreground loops; FBP and MCP are
  complementary evidence paths
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`: No

Repair retrospective:

- The first milestone centralized copy but still trusted raw diagnostic
  payloads. The durable fix is a closed product vocabulary at the projection
  boundary, not another regex over rendered strings.
- The Early Advisory proved that checking for Chinese characters is not a
  trust boundary. Visible failure copy now depends only on an exact reviewed
  code and never evaluates raw host text, getters, or coercion hooks.
- A generic failure renderer cannot decide document authority. Separating
  action failure from accepted-Open failure keeps replacement errors local
  while preventing stale file commands after intake failure.
- One two-test failure-first slice plus the existing bundled suites was enough;
  no foreground or package loop was needed.
- The second review exposed a boundary-map failure, not a missing regex. The
  durable repair enumerates output records at every nesting level and tests
  malicious values through the composed projector rather than another helper.
- Validation cost was kept to one bundled cycle. A local hygiene scan initially
  misclassified `ownString()` as global `String()`; correcting the scan pattern
  avoided turning a checker false positive into source churn.

## 11. Token usage

- Source: unavailable
- Input tokens: unavailable
- Cached input tokens: unavailable
- Output tokens: unavailable
- Reasoning output tokens: unavailable
- Total tokens: unavailable
- Token lesson: finish design-system and state-family convergence as one bundle,
  then run one regression and one handoff cycle.
