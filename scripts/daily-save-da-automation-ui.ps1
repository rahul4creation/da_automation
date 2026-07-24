param(
    [string]$RepoRoot = "D:\AIReview\da_automation",
    [string]$MessagePrefix = "Daily DA Automation UI save",
    [string]$RemoteName = "origin",
    [string]$BranchName = "",
    [switch]$NoPush,
    [switch]$CreateTag,
    [switch]$NoTag
)

$ErrorActionPreference = "Stop"

$repo = Resolve-Path -LiteralPath $RepoRoot
$RepoRoot = $repo.Path
$logFolder = Join-Path $RepoRoot "logs"
$logPath = Join-Path $logFolder "daily-da-automation-ui-save.log"
$lockPath = Join-Path $logFolder "daily-da-automation-ui-save.lock"

if (-not (Test-Path -LiteralPath $logFolder)) {
    New-Item -ItemType Directory -Path $logFolder | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "$(Get-Date -Format 'dd-MM-yyyy HH:mm:ss') $Message"
    Add-Content -LiteralPath $logPath -Value $line
    Write-Host $line
}

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    foreach ($line in $output) {
        if ($line) {
            Write-Log "git: $line"
        }
    }
    if ($exitCode -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $exitCode."
    }
}

function Get-GitOutput {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )
    $output = & git @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
        return ""
    }
    return (($output | Out-String).Trim())
}

$lockStream = $null
try {
    $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
    Write-Log "Another daily save is already running. Skipping this run."
    exit 0
}

try {
    Set-Location -LiteralPath $RepoRoot
    Write-Log "Starting daily GitHub save."

    $insideWorkTree = Get-GitOutput -Arguments @("rev-parse", "--is-inside-work-tree")
    if ($insideWorkTree -ne "true") {
        throw "$RepoRoot is not a Git repository."
    }

    if (-not $BranchName) {
        $BranchName = Get-GitOutput -Arguments @("branch", "--show-current")
    }
    if (-not $BranchName) {
        throw "Unable to determine the current Git branch."
    }

    $remoteUrl = Get-GitOutput -Arguments @("remote", "get-url", $RemoteName)
    if ($remoteUrl) {
        Write-Log "Using remote ${RemoteName}: $remoteUrl"
        Invoke-Git -Arguments @("fetch", "--prune", $RemoteName)
        $remoteBranchExists = Get-GitOutput -Arguments @("rev-parse", "--verify", "$RemoteName/$BranchName")
        if ($remoteBranchExists) {
            $behindCountText = Get-GitOutput -Arguments @("rev-list", "--count", "HEAD..$RemoteName/$BranchName")
            $behindCount = if ($behindCountText) { [int]$behindCountText } else { 0 }
            if ($behindCount -gt 0) {
                Write-Log "Remote branch is ahead by $behindCount commit(s). Pulling with rebase and autostash."
                Invoke-Git -Arguments @("pull", "--rebase", "--autostash", $RemoteName, $BranchName)
            }
        }
    } else {
        Write-Log "No Git remote named '$RemoteName' is configured. The script will commit locally only."
    }

    Invoke-Git -Arguments @("add", "-A", "--", ".")

    $staged = Get-GitOutput -Arguments @("diff", "--cached", "--name-only")
    $timestamp = Get-Date -Format "dd-MM-yyyy HH:mm:ss"
    $createdTag = $false
    $tagName = ""

    if ($staged) {
        Write-Log "Staged changes:"
        foreach ($line in ($staged -split "`r?`n")) {
            if ($line) {
                Write-Log "  $line"
            }
        }
        Invoke-Git -Arguments @("commit", "-m", "${MessagePrefix}: $timestamp")
        Write-Log "Created daily save commit."

        if ($CreateTag -and -not $NoTag) {
            $tagBase = "da-automation-daily-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')"
            $tagName = $tagBase
            $suffix = 1
            while (Get-GitOutput -Arguments @("rev-parse", "--verify", "refs/tags/$tagName")) {
                $tagName = "$tagBase-$suffix"
                $suffix += 1
            }
            Invoke-Git -Arguments @("tag", "-a", $tagName, "-m", "${MessagePrefix}: $timestamp")
            $createdTag = $true
            Write-Log "Created rollback tag $tagName."
        }
    } else {
        Write-Log "No staged changes to commit."
    }

    if ($NoPush) {
        Write-Log "Push skipped because -NoPush was provided."
        exit 0
    }

    if (-not $remoteUrl) {
        Write-Log "Push skipped because no remote named '$RemoteName' exists."
        exit 0
    }

    Invoke-Git -Arguments @("push", "-u", $RemoteName, $BranchName)
    Write-Log "Pushed daily version to $RemoteName/$BranchName."

    if ($createdTag) {
        Invoke-Git -Arguments @("push", $RemoteName, $tagName)
        Write-Log "Pushed rollback tag $tagName to $RemoteName."
    }
} finally {
    if ($lockStream) {
        $lockStream.Dispose()
    }
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
