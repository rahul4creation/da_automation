# Phase 5: AI Review and Validation

## Purpose

Perform a structured review before testing and delivery. This phase checks requirement coverage, SQL correctness, KPI logic, visual/report usability, naming consistency, governance, and unresolved risks.

## Use This Phase When

- A SQL draft, dashboard, or report is ready for review.
- Existing artifacts need an audit for gaps, duplicates, inconsistencies, or open issues.
- A project-wide validation is needed across multiple reports or dashboards.
- A migration or enhancement must be checked against original requirements.

## Role of AI

- Compare requirements to SQL, visuals, filters, and acceptance criteria.
- Review SQL logic for errors, duplicate risk, missing filters, null issues, and formula mismatches.
- Review dashboard/report usability, naming, layout, and consistency.
- Identify defects and improvements by severity.
- Produce a review log and coverage summary.

## Human Responsibilities

- Confirm whether findings are valid in the business context.
- Decide priority and release blocking status.
- Approve exceptions and known limitations.
- Assign owners and target resolution dates.

## Required Inputs

- Requirement brief and acceptance criteria.
- Source-to-report mapping.
- SQL draft and validation queries.
- Dashboard/report build notes.
- Screenshots, exports, configuration notes, or links where available.
- Known stakeholder comments, prior defects, or comparison reports.

## Review Procedure

1. Confirm review scope and artifacts available.
2. Build a requirement coverage matrix.
3. Review SQL against source mapping and KPI definitions.
4. Review filters, date logic, parameters, and access behavior.
5. Review visual/report layout, naming, units, formatting, and interaction flow.
6. Review validation queries and whether they are enough to prove correctness.
7. Identify defects, risks, duplicates, gaps, and improvement opportunities.
8. Assign severity and release-blocking status.
9. Produce a review log and recommended correction plan.

## Severity Guidance

- Critical: Wrong KPI, missing mandatory requirement, security exposure, or logic that can materially mislead users.
- High: Significant data mismatch, duplicate inflation risk, broken filter, missing validation evidence, or serious usability issue.
- Medium: Naming inconsistency, incomplete documentation, unclear visual behavior, edge-case handling gap, or performance concern.
- Low: Minor formatting, cosmetic issue, non-blocking label cleanup, or future enhancement.

## SQL Review Checklist

- KPI formulas match the requirement brief.
- Aggregation grain is correct.
- Date basis and boundaries are correct.
- Joins use stable keys and expected cardinality.
- Inner joins do not unintentionally drop valid records.
- Outer joins do not introduce duplicate or null-driven artifacts.
- Filters match dashboard/report controls.
- Null handling and divide-by-zero handling are explicit.
- Deduplication logic is present where needed.
- Validation queries test the risky parts of the logic.
- Performance risks are visible.

## Dashboard/Report Review Checklist

- Every required KPI and visual is present or explicitly excluded.
- Summary metrics and detailed views reconcile.
- Filters are named clearly and behave consistently.
- Visual titles describe the measure, grain, and date basis where needed.
- Units and decimals are consistent.
- Color meanings are consistent and accessible.
- Export and print behavior match requirements.
- No sensitive fields are exposed to unauthorized users.
- User flow supports scanning, comparison, and drill-down.
- No duplicated panels or conflicting definitions exist.

## Project-Wide Validation Checklist

Use this when reviewing multiple dashboards/reports:

- Duplicate KPI names with different formulas.
- Same report field sourced from different tables without explanation.
- Inconsistent filter names or default values.
- Conflicting date logic across artifacts.
- Repeated SQL patterns that should be standardized.
- Unowned datasets, panels, reports, or validations.
- Open issues without owner or target date.

## Output Format

Produce:

```markdown
## Review Summary

- Overall status: Pass / Pass with issues / Blocked
- Critical findings:
- High findings:
- Main recommendation:

## Requirement Coverage

| Requirement | SQL covered? | Visual/report covered? | Validation covered? | Status |
| --- | --- | --- | --- | --- |

## Review Log

| Severity | Area | Finding | Evidence | Recommendation | Owner | Blocking? |
| --- | --- | --- | --- | --- | --- | --- |

## Correction Plan

| Priority | Action | Owner | Expected evidence |
| --- | --- | --- | --- |

## Handoff

- Ready for: Phase 6 Testing and Verification
- Blockers:
- Human decisions:
```

## Quality Gate

The phase is complete only when these are true:

- Requirement coverage is documented.
- SQL and visual/report findings are logged with severity.
- Critical and high findings have owners or are explicitly accepted as risks.
- Review recommendations are concrete.
- Testing focus areas are identified.

## Common Failure Modes

- Reviewing only the dashboard surface and ignoring SQL logic.
- Treating missing validation evidence as a minor issue.
- Reporting findings without evidence or owner.
- Marking a review pass while business definitions are still disputed.
- Ignoring consistency across multiple reports in the same project.
