# Project Workspaces

Use this reference whenever a user may work on more than one reporting/dashboard project.

## Project Identity Rules

- Every project must have a stable `project_id`.
- Use lowercase letters, digits, hyphens, and underscores only.
- Prefer short IDs such as `sales-kpi-dashboard`, `finance-aging-report`, `ops-sla-grafana`, or `sample_project`.
- Do not mix artifacts from different projects.
- When the user mentions a project name but not an ID, derive a safe ID and confirm it when the context is ambiguous.

## Required Project Context

Before starting phase work, know or create:

- `project_id`
- Project name
- Business owner or requester
- Current phase
- Artifact root path
- Target platform if known
- Active blockers or gate status if resuming

If any required project context is missing, pause phase progression and create a project setup note or ask for the missing owner/decision.

## Default Workspace Layout

Use this layout unless the user gives another structure:

```text
projects/<project_id>/
  PROJECT.md
  phases/
    01-requirement-intake/
    02-ai-analysis-understanding/
    03-sql-draft-logic-preparation/
    04-dashboard-report-development/
    05-ai-review-validation/
    06-testing-verification/
    07-approval-delivery/
  inputs/
  data-dictionary/
  sql/
  dashboards/
  review/
  tests/
  delivery/
  evidence/
```

## Project File

Maintain `projects/<project_id>/PROJECT.md` as the project control file:

```markdown
# Project: <project_name>

- Project ID:
- Status: Not started / Active / Blocked / Delivered / On hold
- Current phase:
- Business owner:
- Technical owner:
- Support owner:
- Target platform:
- Created date:
- Last updated:

## Scope

- In scope:
- Out of scope:

## Phase Status

| Phase | Status | Gate recommendation | Last artifact | Owner |
| --- | --- | --- | --- | --- |

## Key Decisions

| Date | Decision | Owner | Evidence |
| --- | --- | --- | --- |

## Open Blockers

| Blocker | Phase | Owner | Next action | Target date |
| --- | --- | --- | --- | --- |
```

## Artifact Naming

Use predictable filenames inside each project:

- `phases/01-requirement-intake/requirement-brief.md`
- `phases/02-ai-analysis-understanding/source-to-report-mapping.md`
- `phases/03-sql-draft-logic-preparation/sql-logic-notes.md`
- `phases/04-dashboard-report-development/build-notes.md`
- `phases/05-ai-review-validation/review-log.md`
- `phases/06-testing-verification/test-log.md`
- `phases/07-approval-delivery/delivery-summary.md`

For multiple versions, append a version or date:

- `requirement-brief-v2.md`
- `review-log-2026-05-28.md`

## Project Switching Rules

- When switching projects, state the old `project_id` and new `project_id`.
- Load the new project's `PROJECT.md` before continuing.
- Check the current phase and gate status before producing new artifacts.
- Never assume the same database, KPI formula, owner, or acceptance criteria applies across projects.

## Portfolio or Cross-Project Work

Use portfolio mode when a task compares or audits multiple projects.

In portfolio mode:

- List all included `project_id` values.
- Keep findings grouped by project.
- Separate shared standards from project-specific exceptions.
- Do not close a finding for one project because another project has evidence.

## Sensitive Data Rule

Do not store secrets, credentials, or sensitive raw data in project folders. Store only metadata, sanitized samples, links, or evidence references unless the user explicitly confirms the repository is approved for that data.
