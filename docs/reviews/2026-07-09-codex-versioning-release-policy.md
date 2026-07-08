# Versioning And Release Policy

Date: 2026-07-09
Agent: Codex / PM lane
Branch: `agent/codex/short-term-preview-qa-20260708`
Status: Completed

## Summary

Established a project-wide version naming and release-stage policy so Auto SVGA
work no longer relies on loose labels such as "short-term", "mid-term", `D0`,
"latest app", or "the app in Applications" as complete version identities.

The new contract separates:

- product version: `0.1.x`, `0.2.x`, `0.3.x`, etc.
- release stage: `alpha`, `beta`, `rc`, or stable.
- distribution channel: `local`, `internal`, `internal-signed`,
  `windows-internal`, or `public`.
- build identity: commit, manifest, review packet, build number, or installed
  app path.

## Product Authority

- Main PRD authority remains `docs/product/PRODUCT_ROADMAP.md`.
- Version naming authority is now
  `docs/product/VERSIONING_AND_RELEASE_POLICY.md`.
- The current owner-visible baseline is named:

```text
Auto SVGA 0.1.0-alpha local
/Users/huangtengxin/Applications/Auto SVGA.app
```

The exact `alpha.N` number is intentionally not backfilled retroactively. The
next deliberate package/review-packet stamping step should assign it.

## Changed Files

- `docs/product/VERSIONING_AND_RELEASE_POLICY.md`
- `docs/product/PRODUCT_DOCUMENTATION_SYSTEM.md`
- `docs/product/PRODUCT_ROADMAP.md`
- `docs/product/SHORT_TERM_DISTRIBUTION_PREP.md`
- `docs/product/MID_TERM_IMPLEMENTATION_PREP.md`
- `docs/product/requirements/README.md`
- `docs/product/requirements/templates/REQUIREMENT_TICKET_TEMPLATE.md`
- `AGENTS.md`
- `codex-skills/auto-svga-core-guard/SKILL.md`
- `codex-skills/auto-svga-client-ready/SKILL.md`
- `docs/retrospectives/PROJECT_EXPERIENCE_GUIDE.md`

## Version Mapping

| Version line | Product name | Meaning |
| --- | --- | --- |
| `0.1.x` | SVGA Preview MVP | Current SVGA-only macOS client and owner-visible QA baseline. |
| `0.2.x` | Multi-format Preview MVP | Planned VAP/Lottie/SVGA parsing, playback, preview, information, and asset/fusion-element display. |
| `0.3.x` | AE Bridge MVP | Planned AE-to-Auto-SVGA bridge serving human designer workflow. |
| `0.4.x` | SVGA Edit MVP | Planned template-based editing and compile-back line. |
| `0.5.x+` | Advanced Motion And Format Expansion | Later advanced effects, conversion/export expansion, Windows, and long-horizon work. |

## Verification

- Documentation-only change; no desktop runtime behavior was changed.
- Checked targeted diffs for the version policy, PRD, distribution prep,
  requirement template, AGENTS, skills, and experience guide.
- `git diff --cached --check`: PASS.
- Staged `TASK_RETRO_LEDGER.jsonl` parse check: PASS, 44 JSON lines.
- Staged file list contains no PNG/SVGA/GIF/video/design-asset files.

## External References

- Apple Developer beta support: Apple describes beta software as preview, seed,
  or release candidate software, and describes RC as typically the final beta
  before release.
- Semantic Versioning 2.0.0: used for the `MAJOR.MINOR.PATCH` and
  pre-release identifier model.

## Risks And Follow-ups

- Packaging scripts do not yet stamp `0.1.0-alpha.N`; Release/Packaging should
  add manifest stamping before the next deliberate owner-visible package.
- Existing ASV-REQ tickets were not broadly backfilled to avoid colliding with
  active QA edits. New tickets must include `Target product version`.
- QA workflow should adopt the new version fields in future ticket/report
  updates. The policy itself already requires QA reports to record version,
  channel, and build identity.

## Project Retrospective

- Product lesson: version lines, release stages, distribution channels, and
  build identity must remain separate; `D0` describes trust/audience, not
  product maturity.
- Process lesson: add a version target to requirement tickets at creation time
  so confirmed scope cannot disappear into vague horizon names.
- Token lesson: updating one dedicated policy plus the nearest authority docs
  is cheaper than rewriting every historical short-term/mid-term mention.
