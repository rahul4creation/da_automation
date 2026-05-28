# Standard Artifacts

Use these templates to keep phase outputs consistent. Fill unknown values with `TBD` and list the owner or question needed to resolve them.

## Status Values

- `Confirmed`: Validated by an owner or trusted artifact.
- `Assumed`: Used temporarily and requires confirmation.
- `Open`: Missing or unclear.
- `Blocked`: Cannot proceed without a decision, data, or access.
- `Out of scope`: Explicitly excluded from current delivery.

## Severity Values

- `Critical`: Can materially mislead users, expose restricted data, or block delivery.
- `High`: Significant correctness, usability, or governance issue.
- `Medium`: Important issue that should be fixed but may not block delivery.
- `Low`: Minor cleanup, documentation, or enhancement.

## Requirement Brief

```markdown
# Requirement Brief

## Request

- Request name:
- Request type: New / Enhancement / Migration / Audit / Defect
- Business objective:
- Business decision supported:
- Priority:
- Requested delivery date:

## Stakeholders

| Role | Name/team | Responsibility | Sign-off required? |
| --- | --- | --- | --- |

## Platform

- Target platform: Grafana / FlexReport / Apache Superset / Undecided
- Platform reason:
- Workspace/environment:

## Scope

- In scope:
- Out of scope:
- Dependencies:

## KPI Catalog

| KPI | Business definition | Formula | Grain | Unit | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Dimensions and Filters

| Name | Type | Required? | Default | Allowed values/source | Notes |
| --- | --- | --- | --- | --- | --- |

## Data Expectations

- Source systems:
- Expected source tables/files:
- Refresh cadence:
- Main date basis:
- Timezone:
- History needed:

## Output Expectations

- Pages/sections:
- Visual/report types:
- Export/schedule needs:
- Drill-down needs:
- Access/security:

## Acceptance Criteria

| ID | Criteria | Verification method | Owner |
| --- | --- | --- | --- |

## Assumptions

| Assumption | Impact | Validation owner |
| --- | --- | --- |

## Open Questions

| Priority | Question | Why it matters | Owner |
| --- | --- | --- | --- |
```

## Source-to-Report Mapping

```markdown
# Source-to-Report Mapping

## Summary

- Reporting grain:
- Primary fact/source:
- Main date basis:
- Refresh expectation:

## Mapping

| Requirement | Type | Business definition | Source table.column | Transformation | Grain | Join path | Confidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Join Model

| From | To | Join key | Cardinality | Duplicate risk | Notes |
| --- | --- | --- | --- | --- | --- |

## Data Quality Checks Needed

| Check | Reason | Suggested query idea | Blocking? |
| --- | --- | --- | --- |

## Data Risks

| Severity | Risk | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
```

## SQL Logic Notes

```markdown
# SQL Logic Notes

## Objective

- Query purpose:
- Output grain:
- Target platform:
- Parameters:

## CTE Flow

| CTE | Purpose | Grain | Notes |
| --- | --- | --- | --- |

## Logic Decisions

| Area | Decision | Reason | Risk |
| --- | --- | --- | --- |

## KPI Formulas

| KPI | SQL expression summary | Requirement reference | Validation method |
| --- | --- | --- | --- |

## Validation Queries

| Query/check | Purpose | Expected result |
| --- | --- | --- |

## Performance Notes

- Estimated large tables:
- Filter pushdown opportunities:
- Index/key assumptions:
- Materialization or caching recommendation:
```

## Dashboard or Report Build Notes

```markdown
# Dashboard or Report Build Notes

## Artifact

- Name:
- Platform:
- Workspace/environment:
- Audience:
- Refresh:
- Access:

## Section Plan

| Section | User question | Components | Notes |
| --- | --- | --- | --- |

## Visual/Report Inventory

| Component | Type | KPI/field | Dataset/query | Filters | Interaction | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |

## Dataset Inventory

| Dataset/query | Source SQL | Grain | Refresh | Used by | Owner |
| --- | --- | --- | --- | --- | --- |

## Filter Inventory

| Filter | Source field | Default | Scope | Required? | Notes |
| --- | --- | --- | --- | --- | --- |

## Development Issues

| Severity | Issue | Impact | Recommendation | Owner |
| --- | --- | --- | --- | --- |
```

## Review Log

```markdown
# Review Log

## Review Summary

- Overall status: Pass / Pass with issues / Blocked
- Scope reviewed:
- Main recommendation:

## Requirement Coverage

| Requirement | SQL covered? | Visual/report covered? | Validation covered? | Status |
| --- | --- | --- | --- | --- |

## Findings

| ID | Severity | Area | Finding | Evidence | Recommendation | Owner | Blocking? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Correction Plan

| Priority | Action | Owner | Expected evidence | Target date |
| --- | --- | --- | --- | --- |
```

## Test Log

```markdown
# Test Log

## Verification Summary

- Overall status: Pass / Pass with known limitations / Blocked
- Tests executed:
- Tests passed:
- Tests failed:
- Release recommendation:

## Test Cases

| ID | Category | Test case | Expected result | Actual result | Status | Evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Defects

| ID | Severity | Defect | Evidence | Fix needed | Owner | Retest status |
| --- | --- | --- | --- | --- | --- | --- |

## Known Limitations

| Limitation | Impact | Accepted by | Follow-up |
| --- | --- | --- | --- |
```

## Delivery Summary

```markdown
# Delivery Summary

## Artifact

- Name:
- Platform:
- Environment:
- Version:
- Delivery date:
- Link/location:
- Business owner:
- Technical owner:
- Support owner:

## Delivered Scope

| Requirement | Delivered item | Evidence | Status |
| --- | --- | --- | --- |

## Review and Testing

- Review status:
- Testing status:
- Open defects:
- Accepted risks:

## Deployment

- Publish/deploy steps:
- Refresh schedule:
- Access groups:
- Rollback approach:
- Monitoring:

## Sign-Off

| Role | Name/team | Status | Date | Notes |
| --- | --- | --- | --- | --- |

## Post-Delivery Actions

| Action | Owner | Due date | Priority |
| --- | --- | --- | --- |
```
