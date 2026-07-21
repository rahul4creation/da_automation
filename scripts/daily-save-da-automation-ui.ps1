param(
    [string]$RepoRoot = "D:\AIReview\da_automation",
    [string]$MessagePrefix = "Daily DA Automation UI save"
)

$ErrorActionPreference = "Stop"

Set-Location $RepoRoot

$timestamp = Get-Date -Format "dd-MM-yyyy HH:mm:ss"
$logFolder = Join-Path $RepoRoot "logs"
$logPath = Join-Path $logFolder "daily-da-automation-ui-save.log"

if (-not (Test-Path $logFolder)) {
    New-Item -ItemType Directory -Path $logFolder | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "$(Get-Date -Format 'dd-MM-yyyy HH:mm:ss') $Message"
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

Write-Log "Starting daily save."

git add -- ".gitignore" "scripts\daily-save-da-automation-ui.ps1" "DA AUTOMATION UI"

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Log "No staged changes to commit."
    exit 0
}

git commit -m "${MessagePrefix}: $timestamp"
Write-Log "Created commit for staged DA Automation UI changes."
