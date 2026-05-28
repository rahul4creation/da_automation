# Phase Gates

Use this reference before moving between phases. A phase cannot pass when any required gate item is `Incomplete` or `Blocked`.

## Gate Status Rules

- `Complete`: Evidence exists and the item is ready.
- `Incomplete`: Work is missing or unclear.
- `Blocked`: Waiting on data, access, decision, owner, environment, or sign-off.
- `Not applicable`: The item does not apply and the reason is documented.

## Gate Evidence Rules

Every completed gate item needs evidence, such as a requirement section, table/column mapping, SQL snippet, screenshot, exported file, validation query result, review finding, test result, approval note, ticket link, or named stakeholder confirmation.

For every incomplete or blocked item, capture:

- What is missing
- Why it matters
- Owner
- Next action
- Target date or decision point when known
- Whether the next phase is blocked

## Gate Report Template

```markdown
## Phase Gate Status

- Current phase:
- Recommended next phase:
- Gate recommendation: Pass / No-go / Conditional pass with accepted risk
- Human approval required from:

## Entry Gate

| Item | Status | Evidence | Owner | Notes |
| --- | --- | --- | --- | --- |

## Exit Gate

| Item | Status | Evidence | Owner | Notes |
| --- | --- | --- | --- | --- |

## Blockers and Accepted Risks

| Type | Item | Impact | Owner | Next action | Accepted by |
| --- | --- | --- | --- | --- | --- |
```

## Phase 1 Gate: Requirement Intake

### Entry Gate

| Item | Required condition |
| --- | --- |
| Request received | Raw request, ticket, screenshot, email, meeting note, or user prompt exists. |
| Request owner known | Business requester or proxy owner is identified. |
| Intake scope known | New report, dashboard, enhancement, migration, audit, or defect is identified. |
| Initial business area known | Domain, team, process, or subject area is identified. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Business objective | Objective and decision supported by the artifact are documented. |
| Stakeholders | Audience, business owner, technical owner if known, and approver are documented. |
| Platform path | Grafana, FlexReport, Superset, or platform decision criteria are documented. |
| KPI catalog | Each KPI has definition, formula or open question, grain, owner, and status. |
| Dimensions and filters | Required dimensions, filters, defaults, and allowed values are captured or questioned. |
| Time logic | Date basis, time range, timezone, refresh need, and comparison period are captured or questioned. |
| Data expectations | Known source systems, tables, files, reports, or data owners are listed. |
| Security and delivery | Access, export, schedule, environment, and delivery expectations are captured. |
| Acceptance criteria | Testable acceptance criteria exist for business, data, and user experience. |
| Open questions | Open questions have priority, owner, and impact. |
| Scope decision | In-scope and out-of-scope items are separated. |

## Phase 2 Gate: AI Analysis and Understanding

### Entry Gate

| Item | Required condition |
| --- | --- |
| Requirement brief | Phase 1 requirement brief is available and approved or marked with accepted risks. |
| KPI catalog | KPI definitions or unresolved KPI questions are available. |
| Data access path | Schema, DDL, sample rows, data dictionary, existing SQL, or owner path is available. |
| Acceptance criteria | Testable criteria are available to guide mapping and validation. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Source-to-report mapping | Every KPI, dimension, filter, and output field is mapped, questioned, or rejected as unavailable. |
| Grain defined | Reporting grain and source grain are documented. |
| Join model | Join paths, keys, cardinality, and duplicate risks are documented. |
| Date logic | Source date fields, timezone, and refresh implications are documented. |
| Transformations | Calculations, exclusions, status logic, conversions, and null handling are documented. |
| Data quality risks | Missing data, ambiguity, nulls, duplicates, late data, and performance risks are logged. |
| Validation plan | Validation checks needed for SQL and testing are listed. |
| Owner assignments | Blocking data questions have owners and next actions. |

## Phase 3 Gate: SQL Draft and Logic Preparation

### Entry Gate

| Item | Required condition |
| --- | --- |
| Mapping ready | Phase 2 mapping is complete or unresolved items have accepted risks. |
| Schema available | Required table and column structure is available. |
| KPI rules available | KPI formulas, filters, grain, and date logic are documented. |
| SQL target known | Dashboard query, dataset, view, materialized view, export, or report dataset target is known. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Main SQL draft | PostgreSQL draft exists with named CTEs or a clear equivalent structure. |
| Traceability | Every selected column and KPI traces to a requirement or mapping item. |
| Parameters | Date range, filters, role constraints, and optional parameters are defined. |
| Join safety | Join type, keys, cardinality expectation, and duplicate handling are documented. |
| KPI correctness | Formulas, aggregation grain, null handling, divide-by-zero handling, and units are implemented. |
| Validation queries | Row count, duplicate, null, date, filter, and KPI reconciliation checks are provided. |
| Performance notes | Large table, filter, index/key, caching, and materialization risks are noted where relevant. |
| Review notes | Assumptions, open questions, and review focus areas are documented. |

## Phase 4 Gate: Dashboard or Report Development

### Entry Gate

| Item | Required condition |
| --- | --- |
| SQL ready | SQL draft and validation notes are available. |
| Platform chosen | Grafana, FlexReport, or Superset target is selected. |
| Requirements ready | Requirement brief and acceptance criteria are available. |
| Build access path | Workspace, environment, owner, or implementation path is known. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Artifact structure | Pages, sections, panels, charts, report bands, or exports are defined. |
| Visual inventory | Every required KPI/output maps to a visual, table, report field, export, or documented exclusion. |
| Dataset inventory | Every component has source SQL or dataset reference, grain, and owner. |
| Filter behavior | Filter defaults, scope, interactions, and date controls are documented. |
| Naming consistency | Artifact, sections, fields, filters, metrics, and datasets follow consistent names. |
| Platform behavior | Refresh, alerts, export, print, drill-down, or scheduling details are documented as applicable. |
| Access expectations | Roles, sensitive data, row-level security, and export permissions are documented. |
| Build evidence | Screenshot, configuration note, link, export, or implementation checklist exists. |
| Development issues | Known issues have severity, owner, and next action. |

## Phase 5 Gate: AI Review and Validation

### Entry Gate

| Item | Required condition |
| --- | --- |
| Review artifacts | Requirement brief, mapping, SQL, build notes, and available screenshots/exports are available. |
| Review scope | SQL, visual/report, filter, access, performance, and governance scope is defined. |
| Acceptance criteria | Criteria from Phase 1 are available for coverage review. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Coverage matrix | Each requirement has SQL, visual/report, and validation coverage status. |
| SQL review | Joins, filters, aggregation, KPI formulas, date logic, null handling, and duplicate risks are reviewed. |
| UX/report review | Layout, naming, units, formatting, filters, exports, and user flow are reviewed. |
| Governance review | Access, ownership, documentation, and consistency across reports are reviewed. |
| Findings logged | Findings have severity, evidence, recommendation, owner, and blocking status. |
| Critical/high resolution | Critical and high findings are fixed or formally accepted with owner and impact. |
| Testing focus | Required test cases and high-risk areas for Phase 6 are identified. |

## Phase 6 Gate: Testing and Verification

### Entry Gate

| Item | Required condition |
| --- | --- |
| Review completed | Phase 5 findings are resolved, assigned, or accepted. |
| Testable artifact | Dashboard/report/query/export is available in a testable environment. |
| Expected results | Trusted source, sample, prior report, or stakeholder expected values are available. |
| Test access | Required roles, credentials, exports, and environment access are available or assigned. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Acceptance coverage | Every acceptance criterion has a test result. |
| Data tests | KPI totals, source reconciliation, joins, filters, nulls, duplicates, and date boundaries are tested. |
| UI/report tests | Visuals, sorting, formatting, drill-downs, exports, print, and empty states are tested as applicable. |
| Access tests | Role visibility, row restrictions, sensitive fields, and export permissions are tested where applicable. |
| Performance tests | Load time, query time, large date ranges, and refresh behavior are tested or marked not applicable. |
| Evidence captured | Query results, screenshots, exports, or notes are captured for each test. |
| Defects resolved | Critical/high defects are fixed or accepted as risks with owner approval. |
| Retest done | Fixed defects have retest status. |
| Release recommendation | Pass, blocked, or pass with accepted risks is documented. |

## Phase 7 Gate: Approval and Delivery

### Entry Gate

| Item | Required condition |
| --- | --- |
| Testing complete | Phase 6 release recommendation is pass or pass with accepted risks. |
| Delivery artifact ready | Final dashboard/report/query/export exists in the target environment or release package. |
| Owners known | Business owner, technical owner, support owner, and approver are identified. |
| Deployment path known | Publish, access, refresh, rollback, and monitoring path is known. |

### Exit Gate

| Item | Required condition |
| --- | --- |
| Delivery summary | Final artifact, platform, environment, version, link/location, owners, and scope are documented. |
| Deployment record | Publish steps, refresh schedule, access groups, rollback, and monitoring are documented. |
| Review/test summary | Review status, test status, open defects, and accepted risks are documented. |
| Sign-off | Business and technical sign-off are recorded; client sign-off is recorded when applicable. |
| Support handoff | Support owner, escalation path, known limitations, and post-delivery actions are assigned. |
| Governance closure | Future enhancements, monitoring checks, and change ownership are documented. |
