# P6 Root Cause Tree

This is a retrospective only. It proposes corrective actions but does not start
P6-R1 implementation.

## Cause / Effect Tree

```text
P6 did not reach product acceptance after 6/6 repairs
├─ Evidence reported PASS before product behavior was trustworthy
│  ├─ Early parity generator wrote broad or unconditional pass states
│  ├─ Item evidence was artifact-bound rather than behavior-bound
│  ├─ Mutation tests arrived after multiple repair rounds
│  └─ Reviewer scope checked handoff integrity more than product semantics
├─ Work was split by technical layer instead of user journey
│  ├─ A1 inventory, A2 shared UI, A3 host, A4 evidence, A5 package all helped
│  ├─ No single owner owned Empty -> Loading -> Loaded -> Invalid recovery
│  ├─ No single owner owned multi-source acceptance end to end
│  └─ A0 integration found cross-layer issues late
├─ Machine and human gates were blurred
│  ├─ Machine gates tried to imply visual parity
│  ├─ HUMAN_REQUIRED was used for both owner taste and technical uncertainty
│  ├─ Reviewer B PASS could coexist with category-level HUMAN_REQUIRED
│  └─ Owner packet could be generated while technical gaps remained
├─ Contract was too broad for one repair loop
│  ├─ Web/Desktop full feature, region, state, interaction, motion, app runtime,
│  │  packaging, privacy, and handoff all competed for the same budget
│  └─ Protocol/handoff repairs consumed product repair capacity
└─ Failure-first validation was late
   ├─ Tests proved fields existed before proving failures were caught
   ├─ Screenshots were generated before same-state/fixture contracts stabilized
   └─ Motion evidence measured frames before trigger/state equivalence
```

## 5 Whys

### Why did P6 consume all repairs without product acceptance?

1. Because external review repeatedly found product parity or proof gaps after
   internal reports passed.
2. Because internal validation often checked report structure, artifact
   existence, hashes, and packet integrity before checking user-visible
   behavior.
3. Because P6 decomposed work by technical layer rather than by vertical user
   workflows.
4. Because evidence generation and final review were too close to the
   implementers and too late in the integration sequence.
5. Because the milestone contract combined product parity, desktop app
   packaging, evidence architecture, privacy, and workflow governance into one
   large budget.

### Why did similar findings repeat?

1. Each round fixed the visible symptom found by the external review.
2. The next round then exposed the same class in a nearby state, interaction,
   motion, or handoff path.
3. There was no finding ledger updated after every external review.
4. There was no automatic "same finding appeared twice" root-cause stop.
5. Repair prompts did not require one root-cause hypothesis and a test designed
   to disprove it.

## Top Root Causes

| Rank | Root cause | Supporting rounds | Impact | Confidence | Corrective action |
| ---: | --- | --- | --- | --- | --- |
| 1 | Evidence architecture was self-referential and initially optimized for pass reporting rather than failure detection. | R1, R3, R5 | Internal PASS did not reliably map to product parity. | High | Build failure-first validators before closing a finding; require mutation tests for every critical gate. |
| 2 | Work was split by technical layer, not vertical user workflow. | R1-R6 | Cross-layer user journeys lacked a single owner. | High | P6-R1 must use vertical work packages: state correctness, multi-source flow, interaction, visual/motion, app delivery. |
| 3 | Machine and human gates were conflated. | R4, R5 | Owner review was asked to decide while technical gates still had unresolved classes. | High | Separate `TECHNICAL_REVIEW_REQUIRED` from owner visual acceptance; machine must prove behavior, human judges aesthetics. |
| 4 | Reviewer independence was incomplete. | R1, R3, R5 | Reviewer PASS missed product and evidence failures. | High | Reviewer B must review product visuals/contact sheets independently, not only packet integrity. |
| 5 | Contract scope exceeded repair-loop capacity. | R1-R6 | Protocol, packaging, privacy, evidence, and product code competed in the same budget. | Medium/high | Split P6-R1 into staged packages with entry/exit gates; do not let protocol repairs consume product repair budget without owner approval. |
| 6 | A0 integration checks happened too late for cross-worker failures. | R4-R6 | Worker PASS accumulated before end-to-end behavior was known. | Medium/high | Run vertical integration checks after each slice, not only after all A1-A5 technical layers. |

## Non-root Causes

- "Screenshots were wrong" is a symptom.
- "Tests were weak" is a mechanism, not the root.
- "Worker forgot" is insufficient; the deeper cause was ownership and gate
  design.
- "Multi-worker is unreliable" is false; the issue was task slicing and
  acceptance sequencing.
