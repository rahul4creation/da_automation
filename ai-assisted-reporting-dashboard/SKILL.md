---
name: ai-assisted-reporting-dashboard
description: AI-assisted workflow for Data Analysis reporting and dashboard development across PostgreSQL, Grafana, FlexReport, and Apache Superset. Use when Codex needs to support requirement intake, data understanding, SQL logic, dashboard or report build, review, testing, approval, delivery, governance, or project-wide validation for reporting and dashboard work.
---

# AI-Assisted Reporting Dashboard

## Overview

Use this skill to guide a Data Analysis team through the reporting and dashboard development lifecycle. The workflow mirrors the initiative phases: requirements, AI analysis, SQL logic, build, review, testing, and delivery.

AI should handle repetitive analysis, draft logic, consistency checks, documentation, and review-intensive work. Keep humans responsible for business decisions, exception handling, deployment approval, client sign-off, and final validation.

## Core Stack

- Backend: PostgreSQL
- Reporting and visualization: Grafana, FlexReport, Apache Superset
- Primary goals: faster delivery, better requirement coverage, reduced rework, stronger review quality, and consistent governance

## Workflow

Start with the earliest incomplete phase unless the user asks for a specific phase. Load the matching phase file before doing detailed work:

1. Requirement Intake: `phases/01-requirement-intake/PHASE.md`
2. AI Analysis and Understanding: `phases/02-ai-analysis-understanding/PHASE.md`
3. SQL Draft and Logic Preparation: `phases/03-sql-draft-logic-preparation/PHASE.md`
4. Dashboard or Report Development: `phases/04-dashboard-report-development/PHASE.md`
5. AI Review and Validation: `phases/05-ai-review-validation/PHASE.md`
6. Testing and Verification: `phases/06-testing-verification/PHASE.md`
7. Approval and Delivery: `phases/07-approval-delivery/PHASE.md`

Each phase directory acts as a detailed phase skill. Load the phase file for the current task, then use `references/artifacts.md` when you need standard output templates for briefs, mappings, SQL notes, build notes, review logs, test logs, or delivery summaries.

## Phase Selection

- If the user gives a raw business request, start with Phase 1.
- If requirements exist but data feasibility is unclear, start with Phase 2.
- If mapping exists and SQL is needed, start with Phase 3.
- If SQL exists and a BI artifact needs to be planned or built, start with Phase 4.
- If an artifact exists and needs audit or validation, start with Phase 5.
- If review findings are addressed and evidence is needed, start with Phase 6.
- If testing is complete and sign-off or release notes are needed, start with Phase 7.

## Execution Rules

- Produce concrete artifacts for the current phase, not generic advice.
- Preserve traceability from business requirement to source data, SQL logic, visual, validation test, and delivery note.
- Separate confirmed facts, assumptions, open questions, risks, and decisions.
- Prefer explicit KPI formulas, grains, filters, time windows, joins, and ownership over shorthand.
- Call out missing requirements early instead of silently guessing business logic.
- For SQL, prefer readable PostgreSQL with named CTEs, deterministic filters, clear aliases, and validation queries.
- For dashboards, optimize for scanning, comparison, drill-down paths, consistent naming, and minimal user confusion.
- For reviews, list findings by severity and phase, then recommend corrections.
- For testing, verify data correctness, UX/rendering, access, performance, edge cases, and refresh behavior.

## Phase Handoff

At the end of each phase, provide:

- Completed artifact name and summary
- Key assumptions and open questions
- Risks or blockers
- Recommended next phase
- Items requiring human decision or sign-off

Do not mark a phase complete when business definitions, data ownership, deployment approval, or client sign-off are unresolved.
