# Phase 4: Dashboard or Report Development

## Purpose

Convert approved SQL logic and requirements into a usable dashboard or report in Grafana, FlexReport, or Apache Superset. This phase focuses on the build plan, visual structure, dataset wiring, filter behavior, naming, and implementation notes required for review.

## Use This Phase When

- SQL logic is ready and a report/dashboard must be designed or built.
- An existing dashboard needs an enhancement, migration, or standardization pass.
- A design needs to be translated into platform-specific panels, reports, datasets, filters, and sections.
- The team needs a clear development handoff before implementation in the BI tool.

## Role of AI

- Recommend visual types based on business decisions and data shape.
- Design dashboard/report layout from summary to detail.
- Convert requirements into panel, section, dataset, and filter inventory.
- Suggest platform-specific implementation patterns.
- Check naming consistency and user flow before review.

## Human Responsibilities

- Build or approve the artifact in the target platform when credentials or UI access are required.
- Confirm final visual design, branding, deployment workspace, and access.
- Decide tradeoffs where platform limitations affect the requested design.
- Validate with stakeholders that the layout supports the business workflow.

## Required Inputs

- Project ID and project workspace path.
- Requirement brief and acceptance criteria.
- Approved SQL draft or dataset definition.
- Source-to-report mapping.
- Target platform and workspace/project.
- Required branding, naming conventions, export expectations, and access rules.
- Any reference screenshots, wireframes, or current dashboard/report links.

## Development Procedure

1. Restate the target platform and primary user workflow.
2. Choose the artifact type: operational dashboard, BI dashboard, paginated report, scheduled export, alert view, or detail drill-through.
3. Define page/section structure from highest-level summary to supporting details.
4. Map each KPI and requirement to a visual, table, report band, alert, or export field.
5. Define filters, variables, parameters, defaults, and interactions.
6. Connect each visual to a dataset/query and document the SQL source.
7. Define naming for artifact, pages, panels, metrics, fields, filters, and datasets.
8. Identify platform-specific setup steps and limitations.
9. Produce build notes, inventory tables, and review-ready handoff.

## Visual Design Guidance

- Put highest-priority KPIs first.
- Use trends for time movement, bars for comparison, tables for detailed review, and alerts for threshold monitoring.
- Avoid pie charts unless the number of categories is small and the user needs part-to-whole comparison.
- Keep KPI cards limited to values that users act on.
- Use consistent units, decimal places, date formats, and color meanings.
- Put filters where users expect them and document default values.
- Keep titles short but specific enough to avoid ambiguity.
- Make drill-down paths obvious.
- Avoid mixing unrelated grains in the same visual without clear labeling.

## Platform Guidance

### Grafana

- Use for time-series monitoring, operational metrics, alerts, and near-real-time visibility.
- Define dashboard variables for time range, environment, customer, region, or service where needed.
- Prefer panels with clear time fields and low-latency queries.
- Document alert thresholds and notification channels if alerts are included.

### FlexReport

- Use for paginated, printable, highly formatted, client-facing, or export-heavy reports.
- Define report sections, grouping, headers, footers, totals, page breaks, and export behavior.
- Ensure datasets return stable columns and pre-shaped values where formatting is strict.
- Document parameters and expected print/export formats.

### Apache Superset

- Use for BI dashboards, reusable datasets, exploratory analysis, and slice-based visual composition.
- Define datasets, charts, metrics, dimensions, filters, and dashboard tabs.
- Use semantic metric names consistently.
- Document dashboard-level filters and chart-level filter overrides.

## Build Inventory Template

Use this structure:

```markdown
## Artifact Summary

- Name:
- Platform:
- Workspace/project:
- Audience:
- Refresh:
- Access:

## Page or Section Plan

| Section | Purpose | Primary user question | Components |
| --- | --- | --- | --- |

## Visual Inventory

| Visual | Type | KPI/field | Dataset/query | Filters | Interaction | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |

## Dataset Inventory

| Dataset/query | Source SQL | Grain | Refresh | Used by | Notes |
| --- | --- | --- | --- | --- | --- |

## Filter and Parameter Inventory

| Filter | Source field | Default | Scope | Required? | Notes |
| --- | --- | --- | --- | --- | --- |

## Development Issues

| Issue | Impact | Recommendation | Owner |
| --- | --- | --- | --- |
```

## Development Checklist

- Every required KPI appears in a visual, report field, export, or documented exclusion.
- Every visual has a source dataset/query.
- Every filter has default behavior and scope.
- Date controls match the SQL date basis.
- Units, decimals, labels, and descriptions are consistent.
- Empty, loading, and no-data states are considered.
- Access rules and row-level restrictions are documented.
- Export and scheduling requirements are documented.
- Performance risks are called out.
- The build is ready for review with screenshots, exports, or configuration notes where possible.

## Quality Gate

Before starting, complete the Project Context Gate in `references/phase-gates.md`.
Before handoff, complete the Phase 4 gate in `references/phase-gates.md`.

The phase is complete only when these are true:

- The artifact structure supports the stated business workflow.
- Panel/report inventory maps back to requirements.
- SQL or dataset ownership is clear.
- Filter behavior is documented.
- Platform-specific implementation notes are recorded.
- Known limitations or open implementation issues are assigned.

Do not move to Phase 5 while any Phase 4 exit gate item is `Incomplete` or `Blocked`. A dashboard/report without component inventory, filter behavior, access expectations, and build evidence is not review-ready.

## Common Failure Modes

- Building visuals before confirming the user decision flow.
- Using attractive visuals that do not answer a business question.
- Creating filters that do not match SQL parameters.
- Hiding important exclusions in visual titles or tooltips only.
- Mixing report and dashboard behavior without defining the expected output.
