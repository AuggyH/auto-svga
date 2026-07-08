# Product Requirement Tickets

Status: active product delivery workflow
Owner role: Product Manager

This folder stores confirmed product delivery tickets. Use it only after a
Product Owner request has been evaluated, feasibility-reviewed, confirmed, and
promoted into `docs/product/PRODUCT_ROADMAP.md` or the closest subordinate
product brief.

Requirement tickets prevent confirmed work from stopping at documentation. Each
ticket gives one owner lane a durable implementation handoff and defines how
the completed work returns to QA.

## ID Format

```text
ASV-REQ-YYYYMMDD-###
```

Examples:

- `ASV-REQ-20260709-001.md`
- `ASV-REQ-20260709-002.md`

## Status Model

| Status | Meaning | Next owner |
| --- | --- | --- |
| Draft | PM is preparing the ticket after Product Owner confirmation. | Product Manager |
| Ready For Handoff | PRD anchor, owner, acceptance, and QA expectation are complete. | Product Manager |
| Routed | Ticket was sent to the accountable implementation owner. | Implementation owner |
| Accepted By Owner | Implementation owner accepted responsibility or raised a routing objection. | Implementation owner |
| In Progress | Implementation is underway. | Implementation owner |
| Implementation Ready | Owner says implementation is complete and ready for QA intake. | Test Engineer |
| QA Acceptance | Test Engineer is validating the implemented requirement. | Test Engineer |
| Closed | QA acceptance passed, or Product Owner/PM accepted the delivery state. | None |
| Deferred | PM intentionally moved the requirement out of the current delivery plan. | Product Manager |
| Cancelled | PM or Product Owner rejected the requirement after confirmation. | Product Manager |
| Superseded | Another requirement ticket replaces this one. | Linked ticket |

## Required Handoff

Every `ASV-REQ` ticket must name:

- PRD or product-brief anchor
- Product Owner confirmation source
- accountable implementation owner
- secondary owners, if any
- priority, importance, and response expectation
- acceptance criteria and evidence
- explicit non-goals
- QA acceptance scope
- privacy and asset boundaries

The implementation owner must return:

- requirement ticket ID
- implementation status
- commit or branch
- review file
- validation summary
- skipped checks or known limitations
- QA acceptance request and suggested regression scope

QA acceptance may be recorded in the requirement ticket, a linked QA report, or
a linked `ASV-QA` ticket when a defect is found. Defect tickets must not replace
the requirement ticket; they are children of the product delivery work.

## Template

Use `docs/product/requirements/templates/REQUIREMENT_TICKET_TEMPLATE.md`.
