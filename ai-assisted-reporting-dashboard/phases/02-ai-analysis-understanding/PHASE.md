# Phase 2: AI Analysis and Understanding

## Purpose

Translate the approved requirement brief into a data understanding package. This phase verifies whether the requested KPIs, filters, dimensions, and visuals can be supported by available data before SQL implementation starts.

## Use This Phase When

- Requirements are captured but source tables, joins, or grain are unclear.
- A report/dashboard needs source-to-report mapping.
- Existing SQL or dashboards must be understood before enhancement or migration.
- The team needs to identify data gaps, duplicate risk, null handling, or conflicting business rules.

## Role of AI

- Read requirement briefs, schemas, sample rows, existing SQL, and data dictionaries.
- Map each business field to likely tables and columns.
- Explain joins, grain, date logic, filter logic, and transformation needs.
- Detect data risks and produce focused questions for data owners.
- Compare new requirements to existing logic when reference artifacts exist.

## Human Responsibilities

- Confirm source system ownership and canonical definitions.
- Approve assumptions about business rules, exclusions, and exception handling.
- Provide data access, schema samples, or existing report references.
- Decide how to handle unavailable fields or inconsistent source data.

## Required Inputs

- Requirement brief from Phase 1.
- KPI catalog and acceptance criteria.
- PostgreSQL schema details, table DDL, sample rows, data dictionary, or entity relationship notes.
- Existing SQL, dashboard exports, CSV samples, or report screenshots if available.
- Known source owners and business owners.

## Analysis Procedure

1. Read the requirement brief and extract every required output field, KPI, filter, and dimension.
2. For each item, identify candidate source table and column names.
3. Determine the natural grain of each source table and the required reporting grain.
4. Identify required joins and their cardinality: one-to-one, one-to-many, many-to-one, or many-to-many.
5. Identify date fields and choose the likely business date basis.
6. Identify transformation rules: type conversion, status normalization, currency conversion, timezone handling, deduplication, and exclusions.
7. Identify validation needs: expected counts, totals, historical report comparison, and sample records.
8. Flag feasibility risks and unresolved questions.
9. Produce a source-to-report mapping and data understanding notes.

## Mapping Checklist

- Every KPI maps to source fields or is marked unresolved.
- Every dimension maps to a source field and has display naming rules.
- Every filter has a source field, default behavior, and allowed values.
- Every date requirement identifies a source date field and timezone.
- Every join has a key, cardinality expectation, and duplicate risk assessment.
- Every aggregate has a grain and grouping rule.
- Every exclusion rule has a source condition.
- Every null-sensitive field has a null handling rule.
- Every slowly changing or historical attribute has effective-date logic when needed.
- Every security-sensitive field is marked.

## Data Risk Categories

- Missing source: Required field or KPI cannot be found.
- Ambiguous definition: Multiple possible columns or formulas exist.
- Grain mismatch: Source data is at a different level than the report output.
- Duplicate risk: Join or event history can multiply rows.
- Late arriving data: Source refresh timing can affect totals.
- Null risk: Required values can be blank or unknown.
- Status conflict: Business statuses differ across systems.
- Time conflict: Multiple date fields could produce different results.
- Access risk: Source contains restricted or sensitive data.
- Performance risk: Large joins or unfiltered scans may be expensive.

## Source-to-Report Output Pattern

Use this structure:

```markdown
## Data Understanding Summary

- Source systems:
- Primary fact table:
- Primary dimensions:
- Reporting grain:
- Main date basis:
- Refresh expectation:

## Source-to-Report Mapping

| Requirement | Type | Source table.column | Transformation | Grain | Join path | Confidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Join Model

| From | To | Join key | Cardinality | Duplicate risk | Notes |
| --- | --- | --- | --- | --- | --- |

## Data Quality Checks Needed

| Check | Purpose | Suggested query idea |
| --- | --- | --- |

## Open Questions

| Priority | Question | Owner | Blocking? |
| --- | --- | --- | --- |
```

## PostgreSQL Investigation Guidance

When database access or schema details are available, prefer these investigation patterns:

- Inspect columns with `information_schema.columns`.
- Estimate table size with catalog statistics before proposing heavy joins.
- Check uniqueness of join keys with `count(*)` versus `count(distinct key)`.
- Check null rates for required fields.
- Check date ranges and freshness for main date fields.
- Check status distributions and allowed filter values.
- Compare totals to existing trusted outputs when available.

## Quality Gate

Before handoff, complete the Phase 2 gate in `references/phase-gates.md`.

The phase is complete only when these are true:

- Each requirement is mapped, questioned, or rejected as unavailable.
- Reporting grain is defined.
- Join paths and duplicate risks are documented.
- KPI formulas have source fields and transformation notes.
- Date basis and refresh implications are documented.
- Data quality checks are proposed.
- Blocking questions are clearly assigned.

Do not move to Phase 3 while any Phase 2 exit gate item is `Incomplete` or `Blocked`. If the team proceeds with unresolved data assumptions, document each assumption as an accepted risk with owner, impact, and validation action.

## Common Failure Modes

- Mapping fields by name similarity without checking business meaning.
- Ignoring many-to-many joins that inflate totals.
- Treating current dimension values as historically correct when effective dating matters.
- Failing to separate source data gaps from dashboard design choices.
- Skipping reconciliation planning until testing.
