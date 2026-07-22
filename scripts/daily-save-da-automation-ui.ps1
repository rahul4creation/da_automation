param(
    [string]$RepoRoot = "D:\AIReview\da_automation",
    [string]$MessagePrefix = "Daily DA Automation UI save",
    [string]$RemoteName = "origin",
    [string]$BranchName = "",
    [switch]$NoPush
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

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Write-Log "Starting daily save."

Invoke-Git add -- ".gitignore" "scripts\daily-save-da-automation-ui.ps1" "DA AUTOMATION UI"

$staged = git diff --cached --name-only
if ($staged) {
    Invoke-Git commit -m "${MessagePrefix}: $timestamp"
    Write-Log "Created commit for staged DA Automation UI changes."
} else {
    Write-Log "No staged changes to commit."
}

if ($NoPush) {
    Write-Log "Push skipped because -NoPush was provided."
    exit 0
}

$remoteUrl = git remote get-url $RemoteName 2>$null
if (-not $remoteUrl) {
    Write-Log "No Git remote named '$RemoteName' is configured. Add a GitHub repository remote first, for example: git remote add origin https://github.com/<github-user>/<repo-name>.git"
    exit 0
}

if (-not $BranchName) {
    $BranchName = git branch --show-current
}
if (-not $BranchName) {
    throw "Unable to determine the current Git branch."
}

Invoke-Git push -u $RemoteName $BranchName
Write-Log "Pushed daily version to $RemoteName/$BranchName."
