# Phase 3: SQL Draft and Logic Preparation

## Purpose

Create readable, reviewable PostgreSQL logic that turns mapped source data into report-ready datasets. This phase should produce both the SQL draft and the supporting validation queries needed for review and testing.

## Use This Phase When

- Source-to-report mapping is available and SQL needs to be drafted.
- Existing SQL needs cleanup, review, optimization, or conversion for PostgreSQL.
- A dashboard/report needs a dataset query, view definition, materialized view plan, or extract logic.
- KPI formulas and filters need to be made executable.

## Role of AI

- Draft PostgreSQL with clear CTE stages and meaningful aliases.
- Translate KPI formulas into SQL expressions.
- Add validation queries for counts, totals, duplicates, and nulls.
- Flag performance risks and suggest practical improvements.
- Document assumptions and logic decisions for reviewers.

## Human Responsibilities

- Confirm production schema names, credentials, and deployment path.
- Approve business logic assumptions.
- Decide whether to create views, materialized views, stored procedures, dashboard queries, or scheduled extracts.
- Review performance impact before production deployment.

## Required Inputs

- Requirement brief and acceptance criteria.
- Source-to-report mapping.
- Table schemas, sample rows, existing SQL, or known query snippets.
- Platform target: Grafana, FlexReport, or Superset.
- Parameter/filter requirements.
- Data volume or performance constraints if known.

## SQL Drafting Procedure

1. Restate the query objective and output grain.
2. List required output columns and map each to source fields or formulas.
3. Define parameters for dates, filters, role access, and optional user selections.
4. Build SQL in CTE stages: parameters, base source, cleaned source, joined data, aggregated metrics, final select.
5. Keep joins explicit and document why each join is inner or outer.
6. Apply filters as early as safe without changing business meaning.
7. Implement deduplication before aggregation when source multiplicity can inflate totals.
8. Use stable, descriptive aliases and dashboard-friendly column names.
9. Add validation queries immediately after the main draft.
10. Add SQL logic notes for handoff to review.

## Preferred PostgreSQL Structure

Use this pattern unless the existing codebase has a better local standard:

```sql
with params as (
    select
        cast(:start_date as date) as start_date,
        cast(:end_date as date) as end_date
),
base_events as (
    select
        ...
    from schema.table_name t
    cross join params p
    where t.event_date >= p.start_date
      and t.event_date < p.end_date + interval '1 day'
),
cleaned as (
    select
        ...
    from base_events
),
aggregated as (
    select
        ...
    from cleaned
    group by ...
)
select
    ...
from aggregated
order by ...;
```

## SQL Quality Checklist

- Query states the intended grain.
- Date filters are deterministic and timezone assumptions are documented.
- Joins have explicit keys and expected cardinality.
- Aggregations use the correct grouping fields.
- KPI formulas match the requirement brief.
- `count(distinct ...)` is used only when the business meaning requires it.
- Null handling is explicit with `coalesce`, `nullif`, or filtered logic where needed.
- Division avoids divide-by-zero errors with `nullif`.
- Currency, percentage, and duration calculations include units.
- Column names are dashboard/report friendly.
- No unexplained magic constants.
- No `select *` in final report logic.
- Validation queries are included.

## Validation Query Set

Prepare queries for:

- Row count at each major CTE or source stage.
- Distinct key count before and after joins.
- Duplicate detection for join keys.
- Null rate for required fields.
- Date range and freshness.
- KPI total reconciliation.
- Filter value distribution.
- Sample records for edge cases.

Example validation patterns:

```sql
-- Duplicate risk check
select join_key, count(*) as row_count
from schema.table_name
group by join_key
having count(*) > 1
order by row_count desc
limit 50;

-- Null rate check
select
    count(*) as total_rows,
    count(*) filter (where important_field is null) as null_rows
from schema.table_name;

-- Reconciliation check
select
    date_trunc('month', event_date)::date as month_start,
    sum(metric_amount) as metric_total
from schema.table_name
group by 1
order by 1;
```

## Platform-Specific Notes

- Grafana: Prefer time columns named clearly, parameterize time range with dashboard variables, and keep query latency low.
- FlexReport: Return stable column order, print-friendly labels, and pre-shaped data when strict layout or export is required.
- Superset: Consider reusable datasets, semantic metric definitions, and filterable dimensions.

## Output Format

Produce:

~~~markdown
## SQL Objective

- Purpose:
- Output grain:
- Parameters:

## Main SQL Draft

```sql
...
```

## Validation Queries

```sql
...
```

## Logic Notes

| Area | Decision | Reason | Risk |
| --- | --- | --- | --- |

## Assumptions and Open Questions

...

## Handoff

- Ready for: Phase 4 Dashboard or Report Development
- Review focus:
- Human decisions:
~~~

## Quality Gate

The phase is complete only when these are true:

- SQL covers every mapped requirement or explicitly excludes unresolved items.
- Query grain and parameters are documented.
- Join and filter logic are explainable.
- Validation queries are included.
- KPI formulas are traceable to the requirement brief.
- Review risks and assumptions are listed.

## Common Failure Modes

- Starting from visuals instead of data grain.
- Joining dimensions after aggregation in a way that changes totals.
- Filtering on display labels instead of stable keys.
- Forgetting inclusive/exclusive date boundaries.
- Omitting validation queries because the main query "looks right".
