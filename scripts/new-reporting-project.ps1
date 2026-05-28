param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$ProjectName = "",
    [string]$Owner = "",
    [string]$ProjectsRoot = "projects"
)

$ErrorActionPreference = "Stop"

if ($ProjectId -notmatch "^[a-z0-9][a-z0-9-]{1,62}$") {
    throw "ProjectId must use lowercase letters, digits, and hyphens only, and must start with a letter or digit."
}

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    throw "This script must be run inside a Git repository."
}

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    $ProjectName = $ProjectId
}

$projectRoot = Join-Path (Join-Path $repoRoot $ProjectsRoot) $ProjectId
if (Test-Path -LiteralPath $projectRoot) {
    throw "Project already exists: $projectRoot"
}

$directories = @(
    "",
    "phases/01-requirement-intake",
    "phases/02-ai-analysis-understanding",
    "phases/03-sql-draft-logic-preparation",
    "phases/04-dashboard-report-development",
    "phases/05-ai-review-validation",
    "phases/06-testing-verification",
    "phases/07-approval-delivery",
    "inputs",
    "data-dictionary",
    "sql",
    "dashboards",
    "review",
    "tests",
    "delivery",
    "evidence"
)

foreach ($directory in $directories) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $directory) | Out-Null
}

$today = Get-Date -Format "yyyy-MM-dd"
$projectFile = Join-Path $projectRoot "PROJECT.md"
$projectContent = @"
# Project: $ProjectName

- Project ID: $ProjectId
- Status: Not started
- Current phase: 01-requirement-intake
- Business owner: $Owner
- Technical owner:
- Support owner:
- Target platform:
- Created date: $today
- Last updated: $today

## Scope

- In scope:
- Out of scope:

## Phase Status

| Phase | Status | Gate recommendation | Last artifact | Owner |
| --- | --- | --- | --- | --- |
| 01-requirement-intake | Not started | TBD | TBD | $Owner |
| 02-ai-analysis-understanding | Not started | TBD | TBD | TBD |
| 03-sql-draft-logic-preparation | Not started | TBD | TBD | TBD |
| 04-dashboard-report-development | Not started | TBD | TBD | TBD |
| 05-ai-review-validation | Not started | TBD | TBD | TBD |
| 06-testing-verification | Not started | TBD | TBD | TBD |
| 07-approval-delivery | Not started | TBD | TBD | TBD |

## Key Decisions

| Date | Decision | Owner | Evidence |
| --- | --- | --- | --- |

## Open Blockers

| Blocker | Phase | Owner | Next action | Target date |
| --- | --- | --- | --- | --- |
"@

Set-Content -LiteralPath $projectFile -Value $projectContent -Encoding UTF8

$phaseFiles = @{
    "phases/01-requirement-intake/requirement-brief.md" = "# Requirement Brief`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 01-requirement-intake`n- Owner: $Owner`n- Status: Draft`n"
    "phases/02-ai-analysis-understanding/source-to-report-mapping.md" = "# Source-to-Report Mapping`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 02-ai-analysis-understanding`n- Status: Draft`n"
    "phases/03-sql-draft-logic-preparation/sql-logic-notes.md" = "# SQL Logic Notes`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 03-sql-draft-logic-preparation`n- Status: Draft`n"
    "phases/04-dashboard-report-development/build-notes.md" = "# Dashboard or Report Build Notes`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 04-dashboard-report-development`n- Status: Draft`n"
    "phases/05-ai-review-validation/review-log.md" = "# Review Log`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 05-ai-review-validation`n- Status: Draft`n"
    "phases/06-testing-verification/test-log.md" = "# Test Log`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 06-testing-verification`n- Status: Draft`n"
    "phases/07-approval-delivery/delivery-summary.md" = "# Delivery Summary`n`n- Project ID: $ProjectId`n- Project name: $ProjectName`n- Phase: 07-approval-delivery`n- Status: Draft`n"
}

foreach ($phaseFile in $phaseFiles.Keys) {
    Set-Content -LiteralPath (Join-Path $projectRoot $phaseFile) -Value $phaseFiles[$phaseFile] -Encoding UTF8
}

Write-Host "Created reporting project workspace: $projectRoot"
