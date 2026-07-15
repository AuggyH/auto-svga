# UIUX-MF-SHELL-CR-001 Third-Recurrence Retrospective

Date: 2026-07-15
Lane: UI/UX
Finding: `UIUX-MF-SHELL-CR-001`
Disposition: `Architecture Contract Ready / Product Implementation Paused`
Rejected handoff: `c778d58c02bca1dc2a8b2b61da980d81d5287c13`
Product repair ancestor: `5f6f1b781f5d9d3e8c33fc5f6b90c3123368be88`
Formal review: `b5c0bdb8345e3d8796f91b351f9579088aab2652`
Formal review SHA-256: `e2866456b069fe4edaec98f2f88671db3985113bb7cd4a8855a2883c640656f6`

Requested model profile: `gpt-5.6-sol / xhigh`
Actual model profile: exact runtime model identifier unavailable to this task;
the strongest active canonical Codex runtime was used.

## 1. Decision

The fourth repair must not be projector-only.

The owner-visible right panel needs an earlier trusted-data boundary in the
main-process product pipeline. The selected architecture is:

1. format parsers and the owner-candidate module derive a closed,
   field-specific `OwnerRightPanelSnapshotV1` from typed primitive values;
2. only that module may mint a module-private capability for the completed
   snapshot;
3. the snapshot contains only containers created by the canonicalizer and
   primitive values admitted by exact field rules;
4. the main-process session serializes only a capability-bearing snapshot into
   bounded canonical JSON;
5. the canonical JSON string, its schema version, byte length, and digest cross
   Electron IPC;
6. the renderer verifies the envelope, parses the JSON into inert data, checks
   the exact schema and canonical byte representation, then renders it without
   inspecting arbitrary live objects.

This is a shared host/session/IPC/controller contract and requires the high-risk
Code Review path. `Object.getOwnPropertyDescriptor()` on arbitrary inputs,
phrase filters, renderer-side object spreading, and generic string projection
are explicitly rejected as trust roots.

## 2. Why Three Repairs Recurred

| Round | What it closed | What it assumed incorrectly | Remaining exposure |
|---|---|---|---|
| 1 | Phrase filtering and several obvious raw English diagnostics | Natural-language shape could distinguish safe copy | Unknown technical strings, paths, and localized diagnostics still crossed the boundary |
| 2 | Controller failure copy moved to exact code-to-copy mappings | The controller helper was the complete owner-visible boundary | `projectMultiFormatRightPanel()` independently projected live nested records |
| 3 | Output key schemas, primitive descriptor reads, and no object spread in the projector | Descriptor-only reads made arbitrary objects inert | Generic `label` / `detail` values remained open-ended; Proxy descriptor traps remained executable |

The repeated root cause was boundary under-modeling. Each repair constrained the
latest visible leak but left the upstream object graph and its value provenance
unchanged. The production model still carried parser messages, diagnostic
details, paths, generic labels, and generic detail arrays into a renderer-side
projection function. Closing key shape did not close value vocabulary, and
ordinary accessor safety did not establish Proxy safety.

`UIUX-MF-SHELL-CR-002` is separate and remains closed: Cancel preserves the
current document, while an accepted Open followed by failure revokes prior
document, command, selection, replacement, runtime, and legacy-delegation
authority.

## 3. Complete Production Data Path

```text
local file / dropped file
  -> Electron main file chooser or dropped-path intake
  -> MultiFormatDesktopPreviewSession.openLocalFilePath()
  -> owner-candidate session.openLocalCandidate()
  -> hidden workspace + format parser / inspection adapters
  -> OwnerVisibleMultiFormatPreviewModel (live object graph)
  -> MultiFormatDesktopPreviewSession.publicResult()
  -> ipcMain.handle() return value
  -> Electron IPC structured-clone transport
  -> preload invoke() Promise result
  -> controller applyOpenOutcome() / applyOpenedHostResult()
  -> controller state.model
  -> projectMultiFormatRightPanel(model)
  -> renderFacts / renderAssets / renderIssues
  -> DOM text, labels, details, badges, and command affordances
```

Additional renderer paths bypass the right-panel projector today:

- `renderReplaceableTargets()` reads `model.rightPanel.vapFusionImages`;
- `renderTextTargets()` reads `model.rightPanel.lottieTexts` and
  `model.rightPanel.vapFusionTexts`;
- runtime preview preparation derives request data from `model` and replacement
  state.

Therefore the future snapshot must cover both information rows and the
owner-visible replacement rows. A safe facts/issues projector beside unsafe
replaceable arrays is not a closed owner-visible contract.

### 3.1 Producer origins

- Host metadata provides `path.basename`, byte size, media type, and local file
  bytes. The full local path remains main-process authority.
- Lottie JSON is parsed into layer, asset, text, expression, and unsupported
  feature data. Names and initial text originate in the document.
- VAP inspection provides codec, audio presence, dimensions, fusion IDs,
  `srcTag`, resource IDs, z values, and placement samples.
- SVGA inspection provides dimensions, timing, resources, image keys, and
  runtime structure facts.
- Workbench issues provide open-ended `message`, `details`, and `path` fields.
- `buildMultiFormatAssetInventory()` currently converts arbitrary values with
  `String()`, builds generic `label` / `detail` arrays, and includes issue
  messages and unsupported feature paths.
- `modelFromWorkspace()` copies the workspace model and inventory into an
  owner-visible model but does not establish inertness or closed value
  provenance.
- `publicResult()` returns the live model to Electron IPC without a dedicated
  owner snapshot schema or canonical serialization envelope.

### 3.2 Transport and consumer boundary

- `ipcMain.handle()` validates the sender and product mode, then returns the
  session result.
- preload exposes fixed methods but currently passes the result through without
  owner-snapshot validation.
- Electron IPC creates a renderer-side clone, so a successfully delivered
  object is no longer the original main-process object. That is useful but not
  sufficient: sender-side cloning can observe accessors, and values may already
  contain open-ended diagnostic or parser strings.
- the controller stores the returned model and runs a second owner projection;
  several replacement renderers still consume raw model arrays directly.

## 4. Field Provenance And Closed Vocabulary

| Owner-visible field family | Current origin | Required classification | Future rule |
|---|---|---|---|
| Group and fact labels | Renderer constants plus upstream IDs | Fixed renderer copy | Exact ID map only; unknown IDs omitted |
| Format | Parser detection | Typed derived copy | Enum `svga/lottie/vap` -> fixed display labels |
| Dimensions | Parser numeric width/height, currently formatted upstream | Typed derived copy | Carry bounded positive integers; renderer formats `W x H` |
| Duration / FPS / counts | Parser timing and array counts | Typed derived copy | Carry bounded finite numbers/integers only; renderer formats units |
| Codec | VAP inspection | Typed derived copy | Exact codec enum/map; unknown -> fixed `未知` or fixed unsupported state |
| Audio/status/severity | Parser/inspection state | Typed derived copy | Closed enums only; no free text |
| File display name | Host `path.basename` | Owner-authored name data | Separate bounded `SourceDisplayName` provenance; reject controls, separators, path patterns, overlength, and empty values |
| Asset/layer/text/fusion display name | Lottie/SVGA/VAP semantic name or tag | Owner-authored name data | Admit only from named parser fields with provenance enum and length/redaction rules; otherwise fixed `资源 N` |
| Asset/group/item IDs | Parser/runtime identifiers | Internal identity | Opaque bounded IDs for action binding; do not reuse as fallback display copy unless explicitly classified as a display name |
| Replacement identity | owner-candidate target authority | Internal capability data | Preserve public target, canonical runtime target, binding token, kind, and generation outside visible copy; renderer receives only required opaque action fields |
| Normal item details | Generic string arrays | Unsupported as-is | Replace with discriminated typed detail values such as dimensions, bytes, codec, placement count, replacement-required, or initial-text-present |
| Issue code | parser/workbench issue | Fixed renderer copy | Exact code map only; unknown -> one generic issue code/copy |
| Issue message | parser/workbench message | Forbidden diagnostic data | Never cross owner snapshot; renderer derives copy from code |
| Issue severity | workbench issue | Typed derived copy | Closed severity enum; malformed -> fixed warning or reject snapshot |
| Unsupported feature | parser structural finding | Fixed renderer copy | Exact feature code map only; path/expression never crosses |
| Unsupported path / expression | parser structure path | Forbidden structural data | Keep in internal diagnostics/evidence only |
| Local paths and adjacent resource paths | host/session/parser | Forbidden owner data | Remain main-process authority; only path-redacted booleans may cross |
| Diagnostic details/cause/action/reason | parser/session/runtime | Forbidden diagnostic data | Retain in private logs or typed evidence, never owner snapshot |
| Replacement preview value | user-selected image/text | Owner-authored input with dedicated handling | Image becomes a non-visible opaque replacement handle; text uses a bounded explicit text-preview field, never generic detail copy |

### 4.1 Typed detail vocabulary

Generic `string[] detail` is removed from the owner snapshot. The initial closed
set is a discriminated union produced from primitives:

```text
dimensions(width, height)
fileSize(bytes)
codec(code)
placementSampleCount(count)
replacementRequired
initialTextPresent
resolutionStatus(status enum)
audioPresence(present boolean)
```

Unknown detail kinds are omitted. They are not converted to strings and do not
fall back to raw values.

## 5. JavaScript Boundary Experiments

Small read-only Node experiments were run against the current runtime. No
project files or product state were changed.

| Experiment | Result | Architecture consequence |
|---|---|---|
| `structuredClone(topLevelProxy)` | `DataCloneError`; zero `get`, descriptor, or ownKeys traps | Clone rejects a Proxy without observing its properties |
| `structuredClone({nested: proxy})` | `DataCloneError`; zero traps | Nested Proxy also rejects |
| `structuredClone(accessorObject)` | Getter executed once | Structured clone is not a safe pre-canonicalization sanitizer for arbitrary accessor-bearing objects |
| `v8.serialize(proxy)` / nested Proxy | Rejected; zero traps | IPC-like V8 serialization has the same useful Proxy rejection property in this runtime |
| `v8.serialize(accessorObject)` | Getter executed once | IPC-like serialization still cannot be the sender-side trust root |
| `WeakSet.has(unbrandedProxy)` | `false`; zero traps | A module-private brand check can reject wrapped/unbranded roots before property access |
| `JSON.stringify(accessor/proxy/toJSON)` | Getter, Proxy traps, and `toJSON` executed | Never stringify arbitrary live inputs |
| `JSON.stringify(BigInt)` | `TypeError`; Symbol omitted; boxed string accepted | Exact primitive admission must occur before serialization |
| `JSON.parse()` duplicate keys | Last key wins | Duplicate keys need canonical byte round-trip rejection or duplicate-aware parsing |
| canonical round trip of duplicate-key input | Parsed/re-serialized bytes differ | Byte-exact canonical reserialization can reject duplicate-key or noncanonical payloads |
| overlength JSON | Measurable before parse | Enforce envelope and field byte limits before parsing |

Conclusion: structured clone and IPC are useful receiver-side inert boundaries,
but they cannot replace a trusted sender-side canonicalizer. `WeakSet.has()` is
a safe capability check, not a sanitizer. `JSON.parse()` yields inert ordinary
data, but `JSON.stringify()` is safe only after a module has minted an exact,
container-owned, primitive-only snapshot.

## 6. Selected Architecture Contract

### 6.1 Canonical producer

Add a main-process workbench module responsible for
`OwnerRightPanelSnapshotV1`. Its construction API must not accept an arbitrary
`model`, `rightPanel`, inventory object, or generic item record. Instead, format
adapters call field-specific builders with already validated primitive values.

The canonicalizer:

- creates every array and object itself;
- admits only exact primitive types and closed enums;
- derives all visible copy from fixed IDs or typed primitive values;
- creates no accessors, prototypes, custom coercion hooks, or externally owned
  nested objects;
- recursively freezes the constructed tree;
- adds the exact root object to a module-private `WeakSet` only after complete
  validation and freezing;
- exports a serializer that calls `WeakSet.has(root)` before any property access
  and rejects unbranded or wrapped roots.

The brand proves provenance of the exact root. It does not sanitize arbitrary
inputs and is never exposed as a public token.

### 6.2 Canonical serialized envelope

The main-process session returns a bounded primitive envelope rather than the
live owner model:

```text
schemaVersion
sourceId
snapshotJson
snapshotByteLength
snapshotSha256
pathRedacted=true
```

`snapshotJson` is produced only from the branded primitive-only tree with a
deterministic key order. The renderer:

1. checks the envelope consists of exact primitives and is within a byte limit;
2. checks the SHA-256 and declared byte length;
3. `JSON.parse()`s the string;
4. validates exact object keys, array bounds, enums, string lengths, and numeric
   ranges;
5. deterministically reserializes the parsed value and requires byte identity,
   thereby rejecting duplicate keys and noncanonical encodings;
6. renders only the parsed snapshot.

Failure at any step produces one fixed renderer-owned failure state, clears
document authority for an accepted Open, and exposes no raw payload.

### 6.3 Renderer contract

`projectMultiFormatRightPanel()` is reduced to a pure mapping from an already
validated `OwnerRightPanelSnapshotV1`, or removed in favor of typed renderers.
It must not inspect arbitrary descriptors, coerce values, localize generic
strings, or reach back into `state.model.rightPanel` for replacement rows.

The renderer retains design ownership of:

- localized fixed labels and issue/feature copy;
- visual hierarchy, badges, rows, empty/error states, and affordances;
- mapping typed details into presentation copy;
- focus, disabled, loading, warning, and selection behavior.

It does not own parser diagnostics, host paths, canonical reset authority, or
runtime target resolution.

## 7. Composition With Accepted Adjacent Contracts

### Target-scoped Reset (`6a464087`)

- Keep public target ID, canonical runtime target, binding token, kind, and
  generation as action authority, separate from visible row labels.
- The owner snapshot carries only the opaque action fields required by the row;
  the row label comes from the closed display-name contract.
- An accepted Reset rebuilds a new canonical snapshot from accepted session
  state. Sibling replacements remain present; final Reset restores source.
- The projector must not reimplement or infer Reset authority.

### Window placement (`093fcdc7`)

- Normal owner placement restore/clamp/fallback remains host-only behavior.
- The internal acceptance display-ID override remains process-scoped,
  coordinate-free, nonpersistent, and invisible.
- No placement preference, display ID, work area, or acceptance execution data
  enters the owner snapshot or right panel.
- There is no UI/UX conflict with the approved separation.

### Open and local action state

- Cancel creates no new snapshot and preserves the active document.
- Accepted Open enters loading and suspends old action authority.
- Accepted Open failure revokes the previous source/model/selection/replacement/
  runtime/legacy delegation and installs a canonical failure snapshot with no
  stale rows or commands.
- Replacement or Reset local failure does not invoke the Open-failure revoker;
  it preserves the current canonical snapshot and shows fixed code-derived
  feedback.

## 8. Fourth-Repair Milestone Contract

### Root-cause hypothesis

The finding recurs because owner projection begins after open-ended live model
objects and generic strings have already crossed multiple module boundaries.
Moving only renderer filters cannot prove inert input or typed provenance.

### Likely source scope

- `src/workbench/multiformat-owner-preview-candidate.ts`
- new owner snapshot schema/canonicalizer module under `src/workbench/`
- `src/workbench/multiformat-asset-qualification.ts`
- `src/tests/multiformat-owner-preview-candidate.test.ts`
- `tools/electron-prototype/experiments/svga-web/multiformat-desktop-session.cjs`
- `tools/electron-prototype/experiments/svga-web/main.cjs`
- `tools/electron-prototype/experiments/svga-web/preload.cjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-desktop-preview-controller.mjs`
- `tools/electron-prototype/experiments/svga-web/web/multiformat-product-conformance.mjs`
- focused Electron/controller/conformance tests

This crosses Electron main/preload/IPC and security/privacy boundaries. Formal
high-risk Code Review is mandatory before QA.

### Failure-first matrix

| Input mutation | Required result |
|---|---|
| Top-level Proxy | Brand check rejects before any trap |
| Nested record Proxy | Cannot enter a minted snapshot; zero traps |
| Proxy-wrapped branded target | `WeakSet.has` rejects; zero traps |
| Array Proxy / proxied array member | Rejected before snapshot minting; zero traps |
| Accessor/getter at every old boundary | No invocation; input rejected or omitted |
| `toString`, `toJSON`, `Symbol.toPrimitive`, boxed primitive | No invocation; input rejected or omitted |
| Symbol, BigInt, numeric/string type mismatch | Rejected or fixed typed fallback; no coercion |
| Duplicate JSON keys / noncanonical order or encoding | Canonical byte check rejects |
| Oversized envelope, arrays, names, or text | Rejected before allocation/rendering beyond declared bounds |
| Raw fields at model/rightPanel/inventory/group/asset/item | Absent from exact snapshot and output key sets |
| Normal English/Chinese technical label/detail | Not shown unless it is a bounded approved name field; generic details omitted |
| Local path, structural path, expression, parser message | Never serialized into owner snapshot |
| Known/unknown issue and feature codes | Known -> exact fixed copy; unknown -> one fixed generic copy |
| Valid dimensions/counts/codec/status | Exact typed values and fixed formatter output |
| Valid filename/asset name | Bounded/redacted display value with explicit provenance |
| Cancel | Existing source/snapshot/commands preserved |
| Accepted Open failure from active SVGA/Lottie/VAP | Old authority cleared; canonical failure snapshot has zero stale actions |
| Replacement/Reset local failure | Current source/snapshot preserved; fixed local feedback only |
| Target-scoped Reset with siblings | One target removed; siblings and action authority preserved |

Every test asserts exact output keys and values, zero trap/getter/coercion calls,
and absence of diagnostic/path/structural text.

### Test tiers

1. Pure canonicalizer tests for schema, value vocabulary, canonical bytes,
   brand behavior, and mutation matrix.
2. Owner-candidate composed tests for SVGA/Lottie/VAP provenance and target
   identity.
3. Main/session/preload IPC contract tests for exact primitive envelope,
   rejected stale/malformed payloads, Cancel, and accepted-Open failure.
4. Renderer/controller tests proving only parsed snapshots reach DOM and all
   direct raw-model replacement reads are removed.
5. Existing target Reset, placement source tests, conformance suite, Electron
   suite, design-system check, privacy/path scan, package/lock/media hygiene.

No foreground evidence is required to close this source trust-boundary finding.

### Success stop

- Proxy hooks are unreachable before trusted projection.
- The renderer receives only exact parsed `OwnerRightPanelSnapshotV1` data.
- Every visible value has one typed provenance and closed vocabulary rule.
- No generic message, detail, path, feature expression, or live nested object
  crosses the owner IPC envelope.
- Original CR probes and the complete mutation matrix fail closed with zero
  hooks.
- `UIUX-MF-SHELL-CR-002`, SVGA/Lottie/VAP workflows, target Reset, and placement
  contracts remain green.

### Failure stop

Stop if the implementation cannot mint an inert primitive-only snapshot before
IPC without inspecting arbitrary host objects, if a format adapter cannot
provide typed primitive provenance, or if valid names cannot be separated from
diagnostic/path values. Route the exact host/parser dependency instead of
falling back to phrase filters or more property inspection.

### Rollback

Use one milestone branch and one rollback boundary. Revert the entire canonical
snapshot/envelope integration if any format loses accepted Preview/Open/Reset
behavior. Do not leave a mixed state where some rows use the snapshot and
replacement rows still use the live model.

## 9. Retrospective

- Product lesson: a safe UI value is defined by provenance and vocabulary, not
  by whether its text looks friendly.
- Architecture lesson: owner-visible projection must begin before generic
  diagnostic objects are assembled, not after they arrive in the renderer.
- JavaScript lesson: descriptor reads avoid ordinary getters but can still call
  Proxy traps; structured clone rejects Proxy but evaluates accessors; a
  private brand plus primitive-only canonical construction and JSON parse is
  the viable combined boundary.
- Test lesson: mutate every nesting level and every value category, and assert
  zero hooks plus exact values, not only exact keys.
- Process lesson: three recurrences justify a cross-boundary milestone and one
  high-risk review, not a fourth local sanitizer patch.
- Cost lesson: the earlier rounds optimized for small diffs before proving the
  actual trust boundary. The next round must first establish one inert data
  contract, then render it.
- Token usage: unavailable; the runtime did not expose exact session counts.

## 10. Nonclaims

This retrospective changes no product source or behavior. It is not a source
repair, Code Review route, QA acceptance, Packaging, foreground evidence,
installed-app validation, pixel-fidelity acceptance, or Product Owner
acceptance.
