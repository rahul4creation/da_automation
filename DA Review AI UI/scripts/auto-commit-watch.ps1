param(
    [string]$MessagePrefix = "Auto-commit",
    [int]$QuietSeconds = 5
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    throw "This script must be run inside a Git repository."
}

Set-Location $repoRoot
Write-Host "Watching $repoRoot for changes. Press Ctrl+C to stop."

while ($true) {
    $status = git status --porcelain
    if ($status) {
        Start-Sleep -Seconds $QuietSeconds
        $statusAfterWait = git status --porcelain
        if ($statusAfterWait) {
            git add -A
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "$MessagePrefix: $timestamp"
        }
    }

    Start-Sleep -Seconds 2
}
