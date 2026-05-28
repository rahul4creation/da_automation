# Phase 1: Requirement Intake

## Purpose

Turn an unstructured business request into a complete, testable requirement brief for a report or dashboard. This phase prevents rework by making business intent, KPI definitions, data expectations, owners, and acceptance criteria explicit before any SQL or dashboard work begins.

## Use This Phase When

- A stakeholder asks for a new dashboard, report, KPI, export, alert, or enhancement.
- The request arrives as a ticket, email, meeting note, screenshot, image, chat message, or partial specification.
- Existing reports need to be rebuilt, migrated, standardized, or audited.
- The team needs to decide whether Grafana, FlexReport, or Apache Superset is the right target platform.

## Role of AI

- Extract and structure requirements from messy input.
- Identify missing business definitions, data details, access needs, and sign-off owners.
- Ask targeted clarification questions.
- Draft the first requirement brief and acceptance criteria.
- Detect scope creep, ambiguous KPI names, and duplicate report requests.

## Human Responsibilities

- Confirm business objective and priority.
- Approve KPI definitions and acceptance criteria.
- Resolve ownership, exception handling, access policy, and client sign-off.
- Decide what is in scope for the current delivery.

## Required Inputs

- Business objective and decision supported by the report/dashboard.
- Stakeholder names, user groups, and approvers.
- Expected platform: Grafana, FlexReport, Apache Superset, or undecided.
- Known data sources, tables, systems, or existing reports.
- KPI names, formulas, grains, dimensions, filters, date ranges, and refresh needs.
- Mockups, screenshots, Excel samples, PDF reports, or reference dashboards if available.
- Security, export, scheduling, and delivery expectations.

## Intake Procedure

1. Restate the request in one sentence.
2. Identify the business decision the artifact will support.
3. List audience groups and what each group needs to see or do.
4. Capture all requested KPIs, dimensions, filters, date logic, and drill paths.
5. Capture expected outputs: dashboard, paginated report, scheduled email, export, alert, or embedded view.
6. Capture non-functional needs: refresh interval, performance target, access level, deployment environment, and support owner.
7. Classify every requirement as confirmed, assumed, unclear, or out of scope.
8. Convert unclear items into specific questions with suggested options where useful.
9. Draft acceptance criteria that can be tested later.
10. Produce the requirement brief using `references/artifacts.md`.

## Requirement Extraction Checklist

- Objective: What decision, action, or monitoring need will this support?
- Audience: Who will use it and what permissions should they have?
- Platform: Why Grafana, FlexReport, or Superset?
- Scope: New build, enhancement, migration, audit, or defect fix?
- KPIs: Names, definitions, formulas, numerator, denominator, rounding, and units.
- Grain: Row-level, daily, weekly, monthly, customer, product, region, user, or transaction.
- Dimensions: Required grouping and drill-down fields.
- Filters: Required defaults, optional filters, cascading filters, and user-specific filters.
- Time logic: Event date, created date, posting date, closed date, timezone, fiscal calendar, and comparison period.
- Data sources: System, schema, table, file, API, owner, and freshness.
- Visuals: KPI card, trend, table, breakdown, map, funnel, alert, export, or detail page.
- Layout: Summary-to-detail flow, tabs, sections, and priority order.
- Security: User roles, row-level security, sensitive columns, masking, and audit needs.
- Delivery: Environment, schedule, refresh, export, notification, and deployment date.
- Acceptance: How business users will know the artifact is correct.

## Platform Selection Guidance

- Grafana: Prefer for operational monitoring, time-series metrics, alerting, infrastructure or near-real-time visibility.
- FlexReport: Prefer for formatted, printable, paginated, exported, or client-facing reports with strict layout needs.
- Apache Superset: Prefer for exploratory BI dashboards, slices, datasets, filters, and self-service analysis.
- Undecided: Document the decision criteria and ask for expected interaction, format, refresh, and governance needs.

## Clarification Question Patterns

- KPI definition: "For `<KPI>`, what is the exact numerator, denominator, date basis, and exclusion rule?"
- Grain: "Should this be calculated at transaction, customer, daily, monthly, or another grain?"
- Date logic: "Should the report use created date, completed date, posted date, or business effective date?"
- Filters: "Which filters are mandatory, which are optional, and what default values should apply?"
- Reconciliation: "Which existing report, extract, or manual calculation should be used as the expected result?"
- Access: "Which roles can view this report, and are any rows or fields restricted?"
- Sign-off: "Who can approve KPI logic and final delivery?"

## Output Format

Produce:

- Requirement brief
- KPI catalog
- Question log
- Assumption log
- Scope decision list
- Acceptance criteria
- Phase handoff note
- Entry and exit gate status from `references/phase-gates.md`

Use this structure for the phase answer:

```markdown
## Requirement Brief

...

## KPI Catalog

| KPI | Definition | Formula | Grain | Filters | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Open Questions

| Priority | Question | Why it matters | Suggested owner |
| --- | --- | --- | --- |

## Assumptions

| Assumption | Impact | Validation needed |
| --- | --- | --- |

## Acceptance Criteria

- ...

## Handoff

- Ready for: Phase 2 AI Analysis and Understanding
- Blockers:
- Human decisions:
```

## Quality Gate

Before handoff, complete the Phase 1 gate in `references/phase-gates.md`.

The phase is complete only when these are true:

- Business objective is explicit.
- Primary audience and approver are named.
- Target platform is selected or decision criteria are documented.
- Each KPI has a definition or an owner for clarification.
- Grain, filters, time window, and refresh expectations are known or explicitly questioned.
- Security and delivery expectations are captured.
- Acceptance criteria are testable.

Do not move to Phase 2 while any Phase 1 exit gate item is `Incomplete` or `Blocked`. If leadership asks to proceed anyway, record the item as an accepted risk with owner, impact, and follow-up.

## Common Failure Modes

- Treating KPI names as definitions.
- Missing date basis or timezone.
- Mixing dashboard requirements with one-off analysis.
- Accepting "same as old report" without identifying the old report and reconciliation source.
- Starting SQL before source ownership and grain are understood.
