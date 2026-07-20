# P6 Review Source Availability

Status: retrospective source inventory only. P6-R1 is not started.

This matrix records which sources were actually available and read for the P6
postmortem. When a complete Review Packet for a reviewed head could not be
located, the row says `unavailable` and lists the fallback source.

| Round | reviewedHead | external review available | full Review Packet available | parity report available | screenshots available | motion evidence available | normal App proof available | worker registry available | source actually read | fallback source used | limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `0fda2a601307506f84cc5f87deb1646081bc1889` | yes: `docs/loop/reviews/P6-external-product-review-1.md` | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | not identified | external review; nearby visible P6 packets were inspected for context only | external review text | No exact `review/P6-0fda2a6/REVIEW_PACKET.md` was found. |
| R2 | `d347cd4802ffe47cf2291f69fbebac6c0ec29457` | yes: `docs/loop/reviews/P6-external-product-review-2.md` | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | unavailable for exact reviewed head | not identified | external review; visible review roots were listed | external review text | No exact `review/P6-d347cd4/REVIEW_PACKET.md` was found. |
| R3 | `92c36b4af1dae15d226ab3848115a5e9537779d7` | yes: `docs/loop/reviews/P6-external-product-review-3.md` | yes: `review/P6-92c36b4/REVIEW_PACKET.md` | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | partial via packet context | external review; `review/P6-92c36b4/REVIEW_PACKET.md`; visible review root listing | external review when packet detail was historical | Packet is historical and explicitly rejected by external review. |
| R4 | `290272e056653dadd0d9a89d0a7a432335187bca` | yes: `docs/loop/reviews/P6-external-product-review-4.md` | yes: `review/P6-290272e/REVIEW_PACKET.md` | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | partial via packet context | external review; `review/P6-290272e/REVIEW_PACKET.md`; visible review root listing | external review for acceptance outcome | Packet is valid historical evidence but not owner-acceptance evidence. |
| R5 | `f1ecd57320fc82b83119bd822653057904158b6a` | yes: `docs/loop/reviews/P6-external-product-review-5.md` | yes: `review/P6-f1ecd57/REVIEW_PACKET.md` | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | yes: packet bundle available | partial via packet context | external review; `review/P6-f1ecd57/REVIEW_PACKET.md`; visible review root listing | external review for blocking findings | Packet evidence was rejected as invalid for acceptance. |
| R6 | `1977cbce7ffc53d215391468aeb5b20daf816f77` | yes: owner-provided R6 external review conclusions recorded in `P6_R6_EXTERNAL_REVIEW_SUMMARY.md` | yes: `review/P6-1977cbc/REVIEW_PACKET.md` | yes: `.artifacts/product/P6/p6-parity-report.json` and packet copy | yes: `.artifacts/product/P6/` and packet references | yes: `.artifacts/product/P6/motion-evidence/` and packet references | yes: `normal-smoke-parity.json`, `packaged-app-runtime-proof.json`, and App manifest | yes: `review/P6-1977cbc/worker-registry-final.json` and `.artifacts/product/P6/worker-registry-final.json` | `review/P6-1977cbc/REVIEW_PACKET.md`; `validation.json`; reviewer JSON; product evidence JSON; owner-provided R6 review conclusions | owner-provided review directive because standalone repo review file was unavailable | External review conclusion exists, but the standalone review file is not in the repo. |

## Inputs Read Update

The postmortem should cite this matrix instead of implying every round had an
exact Review Packet. Exact Review Packets were located for R3, R4, R5, and R6;
R1 and R2 relied on external review records and nearby visible P6 packet
context.
