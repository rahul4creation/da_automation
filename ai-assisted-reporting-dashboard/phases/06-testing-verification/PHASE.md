# Phase 6: Testing and Verification

## Purpose

Verify that the dashboard or report is accurate, usable, performant, secure, and ready for delivery. This phase turns review findings and acceptance criteria into evidence-backed test results.

## Use This Phase When

- A reviewed dashboard/report needs formal testing.
- SQL corrections have been made and need retesting.
- Business users need evidence before sign-off.
- A migration or enhancement must be reconciled against prior outputs.

## Role of AI

- Convert acceptance criteria into test cases.
- Suggest SQL validation and reconciliation checks.
- Organize test evidence and defects.
- Identify gaps in test coverage.
- Summarize verification status and release readiness.

## Human Responsibilities

- Execute tests that require platform access, credentials, or stakeholder review.
- Confirm expected results where business judgment is required.
- Approve known limitations and release exceptions.
- Provide screenshots, exports, query results, or sign-off evidence.

## Required Inputs

- Reviewed SQL and final or near-final dashboard/report.
- Requirement brief and acceptance criteria.
- Review log and correction plan.
- Expected values from trusted reports, source extracts, samples, or stakeholder calculations.
- Access roles and target environments.

## Testing Procedure

1. Build test cases from acceptance criteria, review findings, and high-risk logic.
2. Separate tests by category: data, filter, visual/report, access, performance, export, refresh, and regression.
3. Define expected result and evidence needed for each test.
4. Execute or guide execution of SQL validation tests.
5. Verify dashboard/report behavior in the target platform.
6. Log actual results, status, evidence, and defects.
7. Retest fixes and update status.
8. Produce final verification recommendation.

## Test Categories

- Data correctness: KPI totals, row counts, formulas, joins, exclusions, null handling, and date logic.
- Requirement coverage: Every acceptance criterion has a test.
- Filter behavior: Defaults, combinations, cascading filters, empty states, and parameter values.
- Visual/report behavior: Titles, units, formatting, sorting, drill-downs, page breaks, and totals.
- Access/security: Role visibility, restricted data, row-level security, and export permissions.
- Performance: Load time, query time, timeout behavior, and large date ranges.
- Refresh: Data freshness, schedule, cache behavior, and late arriving records.
- Export/scheduling: CSV, Excel, PDF, email, print, and file naming where applicable.
- Regression: Existing behavior remains stable after enhancement or migration.

## Data Verification Patterns

- Compare dashboard totals to raw source query totals.
- Reconcile monthly or daily aggregates against trusted reports.
- Test boundary dates at the start and end of the selected range.
- Test records with nulls, duplicate candidates, cancelled statuses, and edge-case categories.
- Test one known entity end to end from source row to displayed output.
- Verify denominator logic for rates and percentages.
- Verify totals when filters are applied and cleared.

## Test Log Template

Use this structure:

```markdown
## Verification Summary

- Overall status: Pass / Pass with known limitations / Blocked
- Tests executed:
- Tests passed:
- Tests failed:
- Open defects:
- Release recommendation:

## Test Log

| ID | Category | Test case | Expected result | Actual result | Status | Evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Defect Log

| Severity | Defect | Evidence | Fix needed | Owner | Retest status |
| --- | --- | --- | --- | --- | --- |

## Known Limitations

| Limitation | Impact | Accepted by | Follow-up |
| --- | --- | --- | --- |

## Handoff

- Ready for: Phase 7 Approval and Delivery
- Blockers:
- Human decisions:
```

## Status Definitions

- Pass: Actual result matches expected result.
- Fail: Actual result does not match expected result and requires action.
- Blocked: Test cannot run because data, access, environment, or decision is missing.
- Not applicable: Test does not apply to this artifact and the reason is documented.
- Accepted risk: Test failed or limitation exists, but a responsible owner approved delivery.

## Quality Gate

The phase is complete only when these are true:

- Every acceptance criterion has a test result.
- Critical and high defects are fixed or explicitly accepted by an owner.
- Data reconciliation evidence is documented.
- Access and export behavior are verified when required.
- Retest status is recorded for fixes.
- Final recommendation is clear.

## Common Failure Modes

- Testing only happy-path filters.
- Comparing totals without matching date basis, grain, or exclusions.
- Skipping access and export tests.
- Marking failures as known limitations without owner approval.
- Failing to retest after SQL or dashboard changes.
