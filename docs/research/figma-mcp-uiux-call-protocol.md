# Auto SVGA Figma MCP UI/UX Call Protocol

Owner lane: UI/UX
Status: operating protocol, not product scope
Last updated: 2026-07-06

This document defines how the UI/UX lane should use Figma MCP for Auto SVGA
design-to-code work. It exists to preserve Figma MCP quota, avoid accidental
Figma Make AI credit usage, and make every read from Figma traceable to a
specific implementation or review need.

## Authority Boundary

Figma is a design reference only after the Owner says the design is ready for
implementation. It does not override:

1. `docs/product/PRODUCT_ROADMAP.md`
2. `docs/product/SHORT_TERM_UI_UX_DESIGN_BRIEF.md`
3. `docs/product/SHORT_TERM_UI_UX_REDESIGN_EXECUTION_PLAN.md`
4. `docs/product/SHORT_TERM_UI_UX_DESIGN_SYSTEM_SPEC.md`
5. `DESIGN.md`

Do not implement against a Figma frame until the Owner explicitly asks the
UI/UX lane to follow that design.

Do not use the Figma page named `备份` for implementation, review, or visual
reference unless the Owner later explicitly changes that boundary.

## Current Auto SVGA Figma Budget Baseline

The current Auto SVGA design file is in a Figma Professional plan, and the
authenticated user has a Full seat. Use the Professional + Full/Dev quota as
the working baseline:

- up to 200 Figma MCP read calls per day
- up to 10 read calls per minute

Keep a 20% reserve for unexpected review and recovery. The UI/UX lane should
treat the practical daily planning budget as 160 read calls, not 200.

If Figma returns a rate-limit, permission, or quota-related error, stop reading
the file. Record which phase failed and what information is still missing.

## MCP Quota Versus Figma Make Credits

Figma MCP read quota and Figma Make AI credits are separate.

Figma MCP read quota is consumed by tools that read data from Figma, such as
screenshots, metadata, selected-node context, variables, and asset downloads.

Figma Make AI credits are consumed when using Figma AI features such as Figma
Make prompts, conversation mode, image generation, or other AI actions. The
UI/UX lane must not use Figma Make to modify or regenerate designs unless the
Owner explicitly requests it.

For this project, normal design-to-code work should primarily consume Figma MCP
read quota, not Figma Make AI credits.

## Official Constraints Used By This Protocol

- Figma MCP rate limits depend on plan and seat type. Professional Dev/Full is
  listed as up to 200 read calls per day and 10 per minute.
- Figma says rate limits apply to MCP tools that read data from Figma. Exempt
  examples include `whoami`, `generate_figma_design`, and
  `add_code_connect_map`.
- Figma recommends using components, variables, clear semantic layer names,
  Auto Layout, annotations, and dev resources for better MCP output.
- Figma recommends avoiding large, heavy frame selections because they can slow
  tools down, fail, or return incomplete responses.
- Figma Make credit usage varies by model, task complexity, and context size.
  Starter and View users also have daily AI credit limits; Full, Dev, and
  Collab seats reset monthly.

References:

- https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
- https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/
- https://developers.figma.com/docs/figma-mcp-server/structure-figma-file/
- https://developers.figma.com/docs/figma-mcp-server/avoid-large-frames/
- https://help.figma.com/hc/en-us/articles/33459875669015-How-AI-credits-work
- https://help.figma.com/hc/en-us/articles/40097793879191-Best-practices-for-optimizing-AI-credits-in-Figma-Make

## Tool Use Rules

Use `whoami` only to confirm authentication, plans, and seat type. It is listed
by Figma as exempt from the read-call rate limits.

Use node-specific screenshot calls for visual comparison. Always pass a known
node ID. Do not rely on the current selection.

Use `use_figma` only after loading the Figma use guidance, and only when the
needed information cannot be obtained through a cheaper screenshot or existing
record. Inspection code must return compact JSON: IDs, names, bounds, token or
variable aliases, key component relationships, and visible text. It must not
dump entire node trees or image payloads.

Do not request inline base64 screenshots unless local network fetching is
blocked. Prefer short-lived screenshot URLs, download them immediately if they
need to be preserved, and store preserved design screenshots outside Git.

Do not call Figma Make, generate new designs, or write to Figma from this lane
unless the Owner explicitly asks for it.

## Required Pre-Read Checklist

Before every Figma read batch, write down:

1. Objective: what decision or implementation slice this batch supports.
2. Approved source: which final-design frame or component the Owner asked to
   follow.
3. Nodes: exact page, frame, component, or variable collection IDs.
4. Tools: the minimum MCP tools needed.
5. Expected payload: screenshot, metadata, variable map, component inventory,
   text inventory, or layout constraints.
6. Call budget: planned read calls and hard stop count.
7. Recording path: where the extracted facts and screenshot manifests will be
   saved.
8. Application target: the token, atom, component, module, or page state in the
   app that will use the data.
9. Stop condition: what result means enough information has been collected.

If any item is unknown, do not call Figma yet.

## Preferred Read Phases

### Phase 0: No-Quota Preparation

Read local product and design docs. Inspect current code and current foreground
screenshots. Define the exact app states that need Figma comparison.

No Figma read calls should be used in this phase.

### Phase 1: File And Page Inventory

Goal: confirm file structure without collecting full design data.

Budget: 1 to 2 read calls.

Collect:

- page names and IDs
- implementation-eligible pages
- excluded pages
- top-level frame names and IDs
- design token page ID
- component library page ID

Record the inventory in the review note for the implementation slice. Do not
re-read this inventory unless the Owner says the Figma file was reorganized.

### Phase 2: Token And Component Index

Goal: map design-system foundations before reading page details.

Budget: 3 to 8 read calls.

Collect:

- variable collection names
- semantic color tokens
- spacing tokens
- radius tokens
- typography styles or text role conventions
- component names and key variants

Record a Figma-to-code token map. Apply the mapping to code tokens first; do
not manually scatter one-off visual values across page CSS.

### Phase 3: Key State Screenshots

Goal: establish visual target evidence.

Budget: 1 screenshot call per key state.

For Auto SVGA short-term, expected key states are:

- launch
- preview default
- preview dirty/save affordance
- preview optimization detail
- optimization result comparison
- compare empty
- compare two files loaded
- compare drag supported
- unsupported drag
- edit default
- settings
- error/loading states only if final design includes them

Download screenshot URLs immediately to a stable local non-Git archive when
they are needed for later comparison. Do not commit the PNG files.

### Phase 4: Per-State Metadata

Goal: extract only the layout, text, and token details that are needed to
implement one state.

Budget: 1 to 3 read calls per state.

For each state, collect:

- frame size and layout direction
- major regions and their bounds
- visible text inventory
- interactive control inventory
- component instance names
- token or variable references when available
- spacing and alignment relationships
- responsive/min-width notes if present

Avoid full subtree dumps. If a frame is large, read only the region being
implemented.

### Phase 5: Implementation Without Figma Reads

Goal: apply collected facts locally.

No Figma read calls should be used while making ordinary code edits. Use the
recorded read packet, local screenshots, local tests, and foreground desktop
captures.

### Phase 6: Targeted Recheck

Goal: verify only uncertain details after local implementation.

Budget: 1 to 2 read calls per disputed area.

Re-read Figma only when:

- a local screenshot mismatch cannot be resolved from the stored packet
- a token alias is missing
- a state has changed in the final Figma file
- the Owner asks for a specific Figma-based comparison

Do not re-read the entire file to resolve a single component.

## Practical Budget Estimate

For a finalized Auto SVGA short-term design covering about 10 to 12 major
states:

| Work | Expected read calls |
| --- | ---: |
| File/page inventory | 1-2 |
| Token and component index | 3-8 |
| Key state screenshots | 10-14 |
| Per-state metadata | 20-36 |
| Targeted rechecks | 15-40 |
| Reserve | 40+ |

Expected total: 50 to 100 read calls for a serious implementation pass.

Upper bound: 120 to 140 read calls for a difficult pass with multiple unclear
states.

This fits within the Professional + Full daily quota, but only if calls are
batched and recorded. It does not support repeatedly reading the whole file
after each small CSS change.

## Call Batch Template

Use this template before every read batch:

```md
### Figma MCP Read Batch

- Date:
- Owner approval:
- File:
- Plan/seat baseline:
- Phase:
- Objective:
- Nodes:
- Tools:
- Planned calls:
- Hard stop:
- Expected output:
- Local record path:
- App target:
- Stop condition:
- Not reading:
```

## Recording Requirements

Every Figma read batch must leave a compact record.

Record:

- date and operator
- Figma file key
- page and node IDs
- tool names used
- number of calls used
- screenshot archive path if any
- SHA-256 for archived screenshots when preserved
- extracted facts
- app files or design tokens affected
- open questions

Do not commit Figma screenshots, exported design assets, or production design
reference images. Use a stable local archive outside Git, then commit only a
text manifest when a review needs traceability.

Recommended local archive root:

`/Users/huangtengxin/Documents/Auto_SVGA_References/figma-mcp/`

## Application Rules

Translate Figma information into the app through the design-system stack:

1. token
2. atom
3. molecule
4. component
5. module
6. page state

If a Figma value maps to an existing token, use the existing token.

If a Figma value has no token but is repeated or foundational, add or adjust a
token only after checking `DESIGN.md` and the design-system spec.

If a Figma value is a one-off visual exception, implement it only if it is
necessary for the final approved design and document why it is not a reusable
token.

Do not add product text, labels, helper copy, states, or controls that are not
present in the PRD or approved UI/UX documents, even if they appear in an
unfinished Figma draft.

## Rate-Limit Failure Handling

When a call fails due to rate limits:

1. Stop Figma reads immediately.
2. Record the last successful call and the failed call.
3. Continue only with already recorded local evidence.
4. If the missing information blocks implementation, report the exact missing
   nodes and wait for quota reset or Owner direction.

Do not try repeated small calls hoping one succeeds.

## Anti-Waste Rules

Never:

- inspect the `备份` page
- read whole pages when one node is enough
- use screenshot calls without saving or inspecting the result
- use inline base64 unless URL fetching is impossible
- repeatedly ask for the same screenshot after local CSS-only changes
- fetch variables for every small component when the token index already has
  the answer
- treat Figma Make AI credits as available for UI implementation unless the
  Owner explicitly asks to use Make
- implement from an unfinished Figma draft without Owner approval

## Resume Gate

The UI/UX lane may resume Figma-guided visual refinement only after the Owner
states that the design稿 is ready to implement or identifies a specific frame
or component to follow.

Until then, Figma MCP use is limited to documentation, planning, inventory, and
quota-safe preparation.
