# Review: local stable app promotion flow

## 1. Summary

Formalized the Product Owner's quick-open macOS client flow. Added a
promotion script that validates the current internal package and installs it to
`~/Applications/Auto SVGA.app`, plus documentation and agent rules that require
future meaningful desktop-client changes to refresh or explicitly skip this
local stable entry.

## 2. Git state

- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Commit before work: `72156f7`
- Uncommitted changes: pre-existing UI/UX and retrospective changes were
  present before this task; they were not reverted.
- Untracked files: pre-existing UI/UX review files were present before this
  task.

## 3. Changed files

- `.gitignore`
- `AGENTS.md`
- `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
- `package.json`
- `tools/svga-workbench/promote-local-stable-app.mjs`
- `docs/reviews/2026-07-07-codex-local-stable-app-promotion.md`
- `docs/retrospectives/TASK_RETRO_LEDGER.jsonl`

## 4. Requirement checks

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Document the local stable app flow | Done |
| 2 | Make future agents aware of the flow | Done |
| 3 | Provide a reusable command instead of manual copy | Done |
| 4 | Keep D0 internal app separate from release readiness | Done |
| 5 | Avoid packaging dirty worktrees by default | Done |

## 5. Verification

Commands run and results:

```bash
node --check tools/svga-workbench/promote-local-stable-app.mjs
# passed

npm run svga-workbench:v1:promote-local-stable -- --help
# printed expected usage

npm run svga-workbench:v1:promote-local-stable -- --use-existing
# passed; installed current-head internal package to ~/Applications/Auto SVGA.app

node tools/svga-workbench/promote-local-stable-app.mjs
# expected fail-closed result on dirty worktree
```

Installed app proof:

- Target: `/Users/huangtengxin/Applications/Auto SVGA.app`
- Build commit: `72156f7f30043e0f4aa68c655a87749bfcfbfebb`
- Launch Services registration: passed
- Distribution: D0 internal unsigned, not notarized, not production approved

## 6. Output inspection

- Canvas size: not applicable
- SVGA: not applicable
- Web preview: not changed
- Local app entry: `~/Applications/Auto SVGA.app` exists and is executable

## 7. Risks

- The current repository worktree is dirty due to unrelated ongoing UI/UX work,
  so the default rebuild path correctly refused to run. The successful
  promotion used `--use-existing` against a package already bound to current
  `HEAD`.
- The promoted app remains unsigned and unnotarized. This is D0 internal
  convenience only.

## 8. Next steps

- Future desktop/client agents should run
  `npm run svga-workbench:v1:promote-local-stable` after final commit when
  their change should become the Product Owner's quick-open client.
- If unrelated dirty files exist but a current-head package has already been
  produced, use `-- --use-existing` and state that uncommitted work was not
  included.

## 9. Commit

- Commit: not created in this task
- Branch: `agent/codex/svga-workbench-v1-autonomous`
- Tag: none

## 10. Project retrospective

- Value assessment: High
- Cost drivers: Needed to separate local D0 convenience from release readiness
  and avoid future manual `.app` copying.
- Avoidable costs: Future agents should call the script directly rather than
  rediscovering package paths and Launch Services behavior.
- Product lessons: A quick-open local app is an internal access path, not an
  acceptance or release gate.
- Technical lessons: The package manifest and proof must bind installation to
  current `HEAD`; dirty worktrees should fail closed by default.
- Design / interaction lessons: None.
- Process lessons: Put recurring owner-local setup in scripts plus AGENTS,
  not only in chat.
- Follow-up candidate for `docs/retrospectives/PROJECT_LESSONS_CANDIDATES.md`:
  No; the rule was promoted directly into the distribution doc and AGENTS.

## 11. Token usage

- Source: unavailable
- Input tokens: null
- Cached input tokens: null
- Output tokens: null
- Reasoning output tokens: null
- Total tokens: null
- Token lesson: use a current-head package manifest and one promotion command
  instead of re-reading packaging history each time.
