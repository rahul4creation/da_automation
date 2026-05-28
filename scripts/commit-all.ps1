param(
    [string]$Message = "Update project changes"
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    throw "This script must be run inside a Git repository."
}

Set-Location $repoRoot
git add -A

$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to commit."
    exit 0
}

git commit -m $Message
