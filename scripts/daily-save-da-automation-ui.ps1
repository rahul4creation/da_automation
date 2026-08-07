param(
    [string]$RepoRoot = "D:\AIReview\da_automation",
    [string]$MessagePrefix = "Daily DA Automation UI save",
    [string]$RemoteName = "origin",
    [string]$BranchName = "",
    [string]$ProjectWorkspaceRoot = "",
    [string]$TrackedProjectsRoot = "",
    [switch]$NoProjectMirror,
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

function Get-EnvFileValue {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    $pattern = "^\s*$([regex]::Escape($Name))\s*=\s*(.+?)\s*$"
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match $pattern) {
            return $matches[1].Trim().Trim('"').Trim("'")
        }
    }

    return ""
}

function Resolve-DefaultProjectWorkspaceRoot {
    $duplicateEnvPath = Join-Path $RepoRoot "DA AUTOMATION UI LIVE DUPLICATE\.env"
    $configuredRoot = Get-EnvFileValue -Path $duplicateEnvPath -Name "DA_PROJECTS_ROOT"
    if ($configuredRoot) {
        return $configuredRoot
    }

    return (Join-Path $RepoRoot "DA AUTOMATION UI LIVE DUPLICATE\projects-live-copy")
}

function Test-SameFileContent {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    if (-not (Test-Path -LiteralPath $DestinationPath)) {
        return $false
    }

    $sourceItem = Get-Item -LiteralPath $SourcePath
    $destinationItem = Get-Item -LiteralPath $DestinationPath
    if ($sourceItem.Length -ne $destinationItem.Length) {
        return $false
    }

    if ($sourceItem.Length -eq 0) {
        return $true
    }

    $sourceHash = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $DestinationPath -Algorithm SHA256).Hash
    return ($sourceHash -eq $destinationHash)
}

function Test-ProjectMirrorFileAllowed {
    param([string]$RelativePath)

    $allowedExtensions = @(".json", ".md", ".txt", ".sql")
    $excludedSegments = @("_trash", "uploads", "data", "exports", "raw", "logs", "tmp", "temp", "node_modules", "dist")
    $extension = [System.IO.Path]::GetExtension($RelativePath).ToLowerInvariant()
    if ($allowedExtensions -notcontains $extension) {
        return $false
    }

    $segments = $RelativePath -split '[\\/]+' | ForEach-Object { $_.ToLowerInvariant() }
    foreach ($segment in $segments) {
        if ($excludedSegments -contains $segment) {
            return $false
        }
    }

    return $true
}

function Sync-ProjectWorkspace {
    param(
        [string]$SourceRoot,
        [string]$DestinationRoot
    )

    if (-not $SourceRoot) {
        Write-Log "Project mirror skipped because no source workspace was configured."
        return
    }

    if (-not (Test-Path -LiteralPath $SourceRoot)) {
        Write-Log "Project mirror skipped because source workspace does not exist: $SourceRoot"
        return
    }

    if (-not (Test-Path -LiteralPath $DestinationRoot)) {
        New-Item -ItemType Directory -Path $DestinationRoot | Out-Null
    }

    $sourceResolved = (Resolve-Path -LiteralPath $SourceRoot).Path.TrimEnd('\', '/')
    $destinationResolved = (Resolve-Path -LiteralPath $DestinationRoot).Path.TrimEnd('\', '/')
    if ($sourceResolved.Equals($destinationResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Log "Project mirror skipped because source and destination are the same folder."
        return
    }

    $copiedCount = 0
    $unchangedCount = 0
    $skippedCount = 0
    Get-ChildItem -LiteralPath $sourceResolved -Recurse -Force -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($sourceResolved.Length).TrimStart('\', '/')
        if (-not (Test-ProjectMirrorFileAllowed -RelativePath $relativePath)) {
            $skippedCount += 1
            return
        }

        $destinationPath = Join-Path $destinationResolved $relativePath
        $destinationFolder = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationFolder)) {
            New-Item -ItemType Directory -Path $destinationFolder | Out-Null
        }

        if (Test-SameFileContent -SourcePath $_.FullName -DestinationPath $destinationPath) {
            $unchangedCount += 1
            return
        }

        Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Force
        $copiedCount += 1
    }

    Write-Log "Project mirror complete from '$sourceResolved' to '$destinationResolved'. Copied/updated: $copiedCount. Unchanged: $unchangedCount. Skipped: $skippedCount."
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

    if (-not $NoProjectMirror) {
        if (-not $ProjectWorkspaceRoot) {
            $ProjectWorkspaceRoot = Resolve-DefaultProjectWorkspaceRoot
        }
        if (-not $TrackedProjectsRoot) {
            $TrackedProjectsRoot = Join-Path $RepoRoot "projects"
        }
        Sync-ProjectWorkspace -SourceRoot $ProjectWorkspaceRoot -DestinationRoot $TrackedProjectsRoot
    } else {
        Write-Log "Project mirror skipped because -NoProjectMirror was provided."
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
