# Auto SVGA Versioning And Release Policy

Date: 2026-07-23
Owner role: Product Manager / Release coordination
Status: active version governance
Authority: `docs/product/PRODUCT_ROADMAP.md` owns product scope; this document
defines naming, version-stage, distribution-channel, and evidence vocabulary.

## Purpose

Auto SVGA uses several parallel work lanes: current macOS client, future
multi-format preview, AE bridge, SVGA editing, UI/UX, QA, and packaging. This
policy prevents those lanes from using temporary labels such as "short-term",
"mid-term", "D0", or "latest app" as if they were precise product versions.

Every owner-visible build, requirement ticket, QA ticket, review packet, and
release handoff should identify four separate facts:

1. Product version: what user-facing capability set this belongs to.
2. Release stage: how mature this version is.
3. Distribution channel: who can receive the package and how trusted it is.
4. Build identity: the exact commit, package manifest, or build number.

## Naming Model

Use this shape in owner-facing or cross-lane handoffs:

```text
Auto SVGA <product-version>[-<stage>.<n>] <channel> (<build identity>)
```

Examples:

```text
Auto SVGA 0.1.0-alpha.4 local (7ff1bf4a)
Auto SVGA 0.1.0-beta.1 internal (manifest abc123)
Auto SVGA 0.1.0-rc.1 internal-signed (commit 0123abcd)
Auto SVGA 0.2.0-alpha.1 local (commit 89abcdef)
```

Short labels are allowed in chat, but documents and QA/release evidence must
include the full enough identity to avoid ambiguity.

## Product Version

Auto SVGA product versions follow SemVer-style `MAJOR.MINOR.PATCH` numbering.
Because the product is still before a public `1.0.0`, the `0.x` line is allowed
to change quickly, but each named product version still needs a stable scope.

| Version line | Product name | Current planning meaning |
| --- | --- | --- |
| `0.1.x` | SVGA Preview MVP | Current SVGA-only macOS client: open, play, inspect, replaceable preview, imageKey rename, optimization, comparison, save, and QA baseline. |
| `0.2.x` | Multi-format Preview MVP | `0.2.0` first closes the macOS SVGA/Lottie/VAP baseline. After that exact macOS build is Owner-accepted and promoted to `local`, a separately gated Windows parity build may use the same feature line and the `windows-internal` channel. A later separately gated `0.2.x` increment adds PAG parsing, playback, parameter analysis, and runtime text/image replacement preview. |
| `0.3.x` | AE Bridge MVP | Planned AE-to-Auto-SVGA production bridge for human designer workflow. |
| `0.4.x` | SVGA Edit MVP | Planned template-based SVGA editing, transform, compile-back, and edit-mode workflows. |
| `0.5.x` | VAP Generation And Format Conversion | Planned local VAP generation from video/frame-sequence input; exact LTR/RTL conversion scope remains unversioned until discovery closes. |
| `0.6.x+` | Agent Motion Generation And Advanced Expansion | Agent-first Motion Plan and headless engine, local/LAN ComfyUI integration, broader export, advanced effects, and later asset types. |

These version lines do not replace the PRD. If a capability moves between
versions, update `docs/product/PRODUCT_ROADMAP.md` first and then update this
mapping.

Patch versions are for stabilizing a released scope. For example, `0.1.1`
should fix or refine the `0.1.0` SVGA Preview MVP; it should not quietly add a
new VAP or Lottie product surface.

## Release Stage

Release stages are inspired by common Apple developer terminology and SemVer
pre-release identifiers. Apple describes beta software as preview/seed/release
candidate software and defines an RC build as typically the final beta before a
major customer release. SemVer supports pre-release identifiers such as
`alpha`, `beta`, and `rc`.

Use lowercase stage identifiers in version strings:

| Stage | Version suffix | Meaning | Allowed change level |
| --- | --- | --- | --- |
| Alpha | `-alpha.N` | Direction and implementation are still moving. Major gaps, broken flows, or hidden/internal work may exist when clearly labelled. | Feature work, architecture work, QA intake, and rough product validation. |
| Beta | `-beta.N` | The intended scope is feature-complete enough for real-material QA and owner/user feedback. Known issues are expected but should be tracked. | Bug fixes, UX refinement, validation, and small low-risk scope corrections approved by PM. |
| Release Candidate | `-rc.N` | Candidate for the named version. No new product scope should enter. | Release blockers, high-priority fixes, packaging fixes, and acceptance evidence only. |
| Stable | no suffix | The named version has passed its chosen acceptance and distribution gate. | Patch follow-ups only; new scope goes to the next version line. |

Do not call a build `rc` until all requirements for that product version have
current-head evidence or explicit accepted limitations, and the Product Owner
or release coordinator has opened the release-candidate gate.

## Distribution Channel

Distribution channel describes package trust and audience. It is not the
product version and not the maturity stage.

| Channel | Previous shorthand | Meaning |
| --- | --- | --- |
| `local` | D0 local stable app | Unsigned local app installed on the Product Owner machine, usually `/Users/huangtengxin/Applications/Auto SVGA.app`. |
| `internal` | D0 internal package | Unsigned internal ZIP or app package for local/team testing. |
| `internal-signed` | D1 macOS | Signed/notarized macOS package for trusted direct sharing. |
| `windows-internal` | D2 Windows | Windows package for internal Windows validation. |
| `public` | Public release | Publicly shareable release after its own product and release decision. |

Legacy `D0`, `D1`, and `D2` may remain in older docs as distribution-tier
shorthand, but new handoffs should prefer the channel names above and may add
the old shorthand in parentheses only where useful.

## Build Identity

A build identity must be enough to reproduce or audit the package. Use the most
specific available identity:

- git commit or branch and commit pair
- package manifest hash
- generated review packet directory
- build number if a packaging tool creates one
- installed app path for owner-visible local testing

`latest`, `current`, "short-term client", and "the app in Applications" are
not sufficient by themselves in tickets or review reports.

## Current Version Targets

Current owner-visible development and QA baseline:

```text
Auto SVGA 0.1.0-alpha local
/Users/huangtengxin/Applications/Auto SVGA.app
```

The exact alpha number is not assigned retroactively to every historical local
promotion. The next deliberate package promotion or review packet should assign
the next `0.1.0-alpha.N` identifier in its manifest/review once the packaging
lane is ready to stamp builds consistently.

Planned follow-up tracks:

- `0.2.0-alpha.1`: multi-format preview spike/MVP may start only after PRD
  promotion and ASV-REQ routing.
- `0.3.0-alpha.1`: AE bridge implementation package may progress in its own
  lane and should not be hidden under the SVGA Preview version number.
- `0.4.0-alpha.1`: SVGA Edit MVP remains isolated until its visible integration
  window is approved.

## Requirement And QA Rules

Every new `ASV-REQ` product delivery ticket must name a target product version
or version line. Examples:

- Target product version: `0.1.x` for runtime structure diagnostics.
- Target product version: `0.2.0-alpha` for multi-format preview MVP.
- Target product version: `0.3.0-alpha` for AE bridge package handoff.

Every QA ticket or regression report should record:

- reported app version string when visible or known
- owner-visible app path or candidate package path
- commit/package manifest
- whether the target is `local`, `internal`, `internal-signed`,
  `windows-internal`, or `public`

If a ticket cannot determine the version/build identity, keep it in Intake or
record `unknown` explicitly. Do not silently assume it targets the latest
source head.

## Branches, Tags, And Review Packets

Branch names may keep human-readable lane names, but final review and release
artifacts should include the product version.

Recommended examples:

```text
agent/codex/0.1-runtime-structure
agent/codex/0.2-multiformat-preview-wp0
review/0.1.0-alpha.4-runtime-structure-<head>
v0.1.0-alpha.4
v0.1.0-rc.1
v0.1.0
```

Tags are optional during active alpha development, but any owner-distributed
beta, RC, stable, signed, notarized, or public package should have a matching
git tag or review packet that binds the package to source.

## External References

- Apple Developer support describes Apple beta software as preview, seed, or
  release candidate software and describes RC as typically the final beta
  before a major release:
  https://developer.apple.com/support/install-beta/
- Semantic Versioning 2.0.0 defines `MAJOR.MINOR.PATCH`, pre-release
  identifiers, build metadata, and examples such as `1.0.0-alpha.1` and
  `1.0.0-rc.1`:
  https://semver.org/
