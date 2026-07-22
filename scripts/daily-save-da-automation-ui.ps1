param(
    [string]$RepoRoot = "D:\AIReview\da_automation",
    [string]$MessagePrefix = "Daily DA Automation UI save",
    [string]$RemoteName = "origin",
    [string]$BranchName = "",
    [string]$TagPrefix = "da-automation-daily",
    [switch]$NoPush,
    [switch]$NoTag
)

$ErrorActionPreference = "Stop"

Set-Location $RepoRoot

$timestamp = Get-Date -Format "dd-MM-yyyy HH:mm:ss"
$tagTimestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$tagName = "${TagPrefix}-${tagTimestamp}"
$createdTag = $false
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

Invoke-Git add -- `
    ".gitignore" `
    "scripts\daily-save-da-automation-ui.ps1" `
    "DA AUTOMATION UI" `
    "DA Review AI UI" `
    "excel_pdf_data_review_ui" `
    "projects\project_id" `
    "projects\sp"

$staged = git diff --cached --name-only
if ($staged) {
    Invoke-Git commit -m "${MessagePrefix}: $timestamp"
    Write-Log "Created commit for staged DA Automation UI changes."
    if (-not $NoTag) {
        Invoke-Git tag -a $tagName -m "${MessagePrefix}: $timestamp"
        $createdTag = $true
        Write-Log "Created rollback tag $tagName."
    }
} else {
    Write-Log "No staged changes to commit."
    Write-Log "No new rollback tag created because there was no new commit."
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

if ($createdTag) {
    Invoke-Git push $RemoteName $tagName
    Write-Log "Pushed rollback tag $tagName to $RemoteName."
}
