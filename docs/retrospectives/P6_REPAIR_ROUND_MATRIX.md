# P6 Repair Round Matrix

Scope: P6 initial implementation through Repair 6. This is a retrospective
matrix only; it does not start P6-R1.

## Calculation Method

The rough change mix below is based on commit subjects, changed-file paths, and
review packet summaries between each reviewed head. It is directional, not a
line-accurate accounting:

- product runtime: `tools/shared/product-frontend/`, Web preview runtime, Electron main/preload/renderer.
- tests / evidence: `tools/p6/`, tests, generated evidence contracts.
- protocol / docs: `docs/loop/`, `docs/product/p6/`, review and governance docs.
- packaging / handoff: package scripts, owner handoff builder, App ZIP/proof.

## Matrix

| Round | Reviewed head | Main target | Product runtime | Host changes | Evidence tools | Worker/protocol | Packaging/handoff | Internal claim | External result | New findings | Repeated findings | Incorrectly claimed closed | Actual progress | Why not closed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `0fda2a6` | Bootstrap shared frontend, evidence, macOS internal package | Medium: shared frontend foundation existed, but Desktop still used prototype surface | Medium: Electron host adapter started | Medium: parity report generated broad PASS | Low: worker prompts existed, but formal visible Worker rigor missing | Medium: package existed but omitted/unsafe for owner use | HUMAN_REQUIRED, evidence PASS-like | REPAIR_REQUIRED, `FULL_WEB_PARITY_NOT_ACHIEVED` | Different Web/Desktop surfaces; JSON inventory smaller than markdown; unconditional PASS generator; no normal App proof | motion proof weak; reviewer false PASS; privacy handoff | Web/Desktop parity, reviewer PASS, App proof | Established P6 direction and app package seed | Shared source and runtime proof were not actually aligned; evidence was mostly structural |
| R2 | `d347cd4` | Integrate true shared frontend and normal proof repair | Medium: Electron default began using shared frontend | High: normal proof and host startup repairs | Medium: inventory and proof stability improved | Low/medium: still before hard Worker registry | Medium | HUMAN_REQUIRED | REPAIR_REQUIRED, `LOCAL_PREVIEW_PARTIAL_PARITY_ONLY` | Multi-worker coordination and visible review handoff became required | normal proof still fragile; parity evidence incomplete | Normal App proof and product parity | Electron moved closer to shared surface; tests passed | Process and evidence contracts still not trustworthy; Web/Desktop full parity not proven |
| R3 | `92c36b4` | Harden Worker protocol and visible handoff | Low: mostly no product behavior | Low | Medium: refreshed parity evidence | High: registry/context packets/visibility protocol | High: handoff builder | HUMAN_REQUIRED | REPAIR_REQUIRED, visual direction accepted but parity not proven | Loading like Empty; Invalid stale state; state proof passed despite failed fields | parity existence-as-behavior; motion evidence weak; reviewer non-independent | Generic PASS evidence; normal proof | Formal Worker mechanics and owner-visible handoff improved | Repair budget was spent on protocol and packaging while runtime vertical flows stayed weak |
| R4 | `290272e` | Replace synthetic PASS with real runtime evidence | Medium: canonical shared shell and accessibility audit | High: host bridge/latest artifact integration | High: runtime parity, mutation tests, reports | High: A1-A5 reused with handoffs | High: App ZIP and privacy audit improved | HUMAN_REQUIRED with honest non-pass report | REPAIR_REQUIRED, honest parity available but incomplete | Specific failing UI regions/features/interactions/states/motions | normal source proof; registry stale; terminal readiness early | Owner acceptance readiness despite 59 non-pass entries | First honest matrix of remaining failures | Evidence became truthful, but product parity still incomplete |
| R5 | `f1ecd57` | Close all visible non-pass evidence entries | Medium: product states and host menus | Medium/high: host runtime menus and normal proof | High: scenario motion parity and runtime inventory | High: all Workers integrated in order | High: final package/handoff gates | HUMAN_REQUIRED; parityStatus pass, nonPass=0 | REPAIR_REQUIRED, evidence and normal App proof invalid | Per-interaction trace missing; second SVGA/reference/latest artifact proof missing; reviewer B category mismatch | Loading/Empty; invalid; motion; state mismatch; registry drift | All required parity closed | Substantial source and evidence progress | Evidence still accepted wrong state/view/fixture/proof paths; no robust vertical owner |
| R6 | `1977cbc` | Final allowed repair: stricter inventory/state/motion/normal App/handoff | Medium: shared state behavior; invalid alias repair | Medium: visible normal app startup path | High: strict evidence gates, mutation tests, final parity | High: registry final binding and handoffs | High: final package, privacy and stale-root repairs | HUMAN_REQUIRED; evidenceCompleteness COMPLETE; all machine reports PASS | No post-budget external review; owner requested retrospective | No new external review yet; budget exhausted | Same classes are only partially closed until external review confirms | Cannot claim closed without external review | Best evidence state so far; portable package complete | P6 used full repair budget without owner/product acceptance; next step must be postmortem before P6-R1 |

## Rough Change Mix

| Round | Product runtime | Tests / evidence | Protocol / docs | Packaging / handoff |
| --- | ---: | ---: | ---: | ---: |
| R1 | 30% | 30% | 20% | 20% |
| R2 | 35% | 30% | 20% | 15% |
| R3 | 5% | 25% | 45% | 25% |
| R4 | 25% | 35% | 20% | 20% |
| R5 | 25% | 40% | 15% | 20% |
| R6 | 20% | 45% | 15% | 20% |

## Pattern

P6 made real technical progress, but the repair cadence repeatedly shifted
between product runtime, evidence, protocol, and handoff hygiene. The milestone
did not keep one vertical user journey owner responsible from product behavior
through evidence and final review.
