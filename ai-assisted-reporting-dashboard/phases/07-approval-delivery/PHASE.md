# Phase 7: Approval and Delivery

## Purpose

Package the verified dashboard or report for release, stakeholder sign-off, handover, support, and ongoing governance. This phase ensures the work is not merely built, but responsibly delivered.

## Use This Phase When

- Testing is complete and the artifact is ready for release.
- Stakeholders need a delivery summary or sign-off record.
- Deployment notes, rollback notes, or support ownership must be documented.
- A report/dashboard is being handed over to operations, support, or a client.

## Role of AI

- Summarize what was delivered and how it maps to requirements.
- Draft release notes, handover notes, and sign-off records.
- Identify unresolved limitations, support needs, and monitoring actions.
- Produce a clean delivery package for stakeholders.

## Human Responsibilities

- Approve deployment and production access.
- Provide business and technical sign-off.
- Execute platform publishing steps when credentials or production access are required.
- Own support, change management, and client communication.

## Required Inputs

- Project ID and project workspace path.
- Final dashboard/report name, link, export, or deployment location.
- Test log and verification recommendation.
- Review log and resolved issue summary.
- Requirement brief and acceptance criteria.
- Deployment environment and release schedule.
- Business owner, technical owner, support owner, and approver list.

## Delivery Procedure

1. Confirm all quality gates from prior phases are complete or accepted.
2. Record final artifact name, version, platform, environment, and link/location.
3. Summarize delivered scope and excluded scope.
4. Summarize test evidence and known limitations.
5. Document deployment, refresh, access, rollback, and support notes.
6. Confirm business and technical sign-off requirements.
7. Prepare handover notes and post-delivery monitoring actions.
8. Create the delivery summary.

## Delivery Package Checklist

- Artifact name and version.
- Platform: Grafana, FlexReport, or Apache Superset.
- Environment: development, UAT, staging, production, or client environment.
- Link, path, export location, or schedule.
- Delivered KPIs and sections.
- Data sources and refresh cadence.
- Access roles and owner.
- Testing summary and evidence references.
- Known limitations and accepted risks.
- Deployment notes and rollback approach.
- Support owner and escalation path.
- Business sign-off and technical sign-off.
- Enhancement backlog or future phases.

## Sign-Off Guidance

- Business sign-off confirms the artifact answers the correct business question and KPI definitions are accepted.
- Technical sign-off confirms implementation, performance, access, refresh, and supportability are acceptable.
- Client sign-off confirms delivery is accepted externally, when applicable.
- Accepted risks must name the approving owner and follow-up action.

## Delivery Summary Template

Use this structure:

```markdown
## Delivery Summary

- Artifact:
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

## Testing and Review Summary

- Review status:
- Testing status:
- Open defects:
- Accepted risks:

## Deployment Notes

- Publish/deploy steps:
- Refresh schedule:
- Access groups:
- Rollback approach:
- Monitoring:

## Known Limitations

| Limitation | Impact | Accepted by | Follow-up |
| --- | --- | --- | --- |

## Sign-Off

| Role | Name | Status | Date | Notes |
| --- | --- | --- | --- | --- |

## Post-Delivery Actions

| Action | Owner | Due date | Priority |
| --- | --- | --- | --- |
```

## Post-Delivery Monitoring

Recommend monitoring for:

- Refresh failures or stale data.
- Query latency and dashboard load time.
- User access issues.
- KPI reconciliation changes after first production refresh.
- User feedback and enhancement requests.
- Error logs or failed scheduled exports.

## Quality Gate

Before starting, complete the Project Context Gate in `references/phase-gates.md`.
Before closure, complete the Phase 7 gate in `references/phase-gates.md`.

The phase is complete only when these are true:

- Business and technical sign-off are documented.
- Deployment location and version are recorded.
- Support owner and escalation path are known.
- Known limitations and accepted risks have owners.
- Rollback or correction approach is documented.
- Post-delivery monitoring actions are assigned.

Do not mark the work delivered while any Phase 7 exit gate item is `Incomplete` or `Blocked`. A release without sign-off, support ownership, rollback notes, or accepted-risk ownership remains open.

## Common Failure Modes

- Marking work complete before sign-off is recorded.
- Delivering a link without documenting ownership or support path.
- Forgetting to list known limitations.
- Skipping rollback notes for production changes.
- Treating deployment as the end of governance.
