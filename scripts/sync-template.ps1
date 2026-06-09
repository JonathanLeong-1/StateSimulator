# ──────────────────────────────────────────────────────────────────────────────
# sync-template.ps1 — Pull updates from the upstream template repository
#
# Usage:
#   .\scripts\sync-template.ps1 [-TemplateUrl <URL>]
#
# If -TemplateUrl is omitted, the script uses the existing "upstream" remote.
# On first run you must supply the URL so the remote can be created.
#
# What this script does:
#   1. Adds/verifies the "upstream" remote pointing to the template repo
#   2. Configures the "ours" merge driver (keeps local project files safe)
#   3. Fetches the latest template changes
#   4. Merges upstream/main into the current branch
#   5. Project-specific paths (.plans/project/, .agent-logs/project/, README.md)
#      are protected by .gitattributes merge=ours — they will NOT be overwritten
#   6. Removes any template plans/logs that came through the merge
#      (template context should not exist in project repos)
#
# Safe to run repeatedly — idempotent.
# ──────────────────────────────────────────────────────────────────────────────
param(
    [string]$TemplateUrl = ""
)

$ErrorActionPreference = "Stop"
$UpstreamRemote = "upstream"
$UpstreamBranch = "main"

function Write-Info  { param([string]$Msg) Write-Host "[sync] $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[sync] $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[sync] $Msg" -ForegroundColor Red }

# ── Pre-flight checks ───────────────────────────────────────────────────────
$ErrorActionPreference = "SilentlyContinue"
$isGitRepo = git rev-parse --is-inside-work-tree 2>$null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) {
    Write-Err "Not inside a Git repository. Run this from your project root."
    exit 1
}

$dirty = git status --porcelain
if ($dirty) {
    Write-Err "Working tree is dirty. Commit or stash changes before syncing."
    exit 1
}

# ── Codespace upstream access check ─────────────────────────────────────────
# In Codespaces the default GITHUB_TOKEN is scoped to the current repo only.
# gh auth setup-git routes git credentials through gh, but the token still
# cannot access a different (upstream) repo. This function detects that
# situation and directs the user to run `gh auth login` for a full-scope token.
function Test-UpstreamAccess {
    # Only needed in Codespaces where GITHUB_TOKEN is repo-scoped
    if ($env:CODESPACES -ne "true" -and -not $env:CODESPACE_NAME) {
        return
    }

    $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghCmd) {
        Write-Warn "Codespace detected but gh CLI not found."
        Write-Warn "If fetch fails, install gh or use a PAT."
        return
    }

    # Clear the Codespace-scoped GITHUB_TOKEN so gh uses stored credentials
    # (or prompts for login) instead of the repo-scoped installation token.
    Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue

    # Ensure gh credential helper is active
    $ErrorActionPreference = "SilentlyContinue"
    gh auth setup-git 2>$null
    $ErrorActionPreference = "Stop"

    # Extract owner/repo from upstream URL
    $ErrorActionPreference = "SilentlyContinue"
    $url = git remote get-url $UpstreamRemote 2>$null
    $ErrorActionPreference = "Stop"
    if (-not $url) { return }

    $slug = $url -replace '.*github\.com[:/]', '' -replace '\.git$', ''
    if (-not $slug -or $slug -notmatch '/') {
        Write-Warn "Cannot parse upstream repo slug from URL: $url"
        return
    }

    Write-Info "Checking access to upstream repo ($slug)..."
    $ErrorActionPreference = "SilentlyContinue"
    gh api "repos/$slug" --silent 2>$null
    $accessOk = $LASTEXITCODE -eq 0
    $ErrorActionPreference = "Stop"

    if ($accessOk) {
        Write-Info "Access confirmed."
        return
    }

    Write-Err "Cannot access upstream repo: $slug"
    Write-Err "The Codespace token is scoped to the current repo only."
    Write-Err ""
    Write-Err "Fix: clear the scoped token and log in with your GitHub account:"
    Write-Err ""
    Write-Err "  Remove-Item Env:GITHUB_TOKEN"
    Write-Err "  gh auth login"
    Write-Err "  .\scripts\sync-template.ps1"
    exit 1
}

# ── 1. Configure upstream remote ────────────────────────────────────────────
$ErrorActionPreference = "SilentlyContinue"
$currentUrl = git remote get-url $UpstreamRemote 2>$null
$remoteExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($remoteExitCode -eq 0) {
    Write-Info "Upstream remote already exists: $currentUrl"
    if ($TemplateUrl -and $currentUrl -ne $TemplateUrl) {
        Write-Warn "Updating upstream URL to: $TemplateUrl"
        git remote set-url $UpstreamRemote $TemplateUrl
    }
} else {
    if (-not $TemplateUrl) {
        Write-Err "No upstream remote found. Provide the template URL:"
        Write-Err "  .\scripts\sync-template.ps1 -TemplateUrl https://github.com/YOUR_ORG/agentic-vibe-coding.git"
        exit 1
    }
    Write-Info "Adding upstream remote: $TemplateUrl"
    git remote add $UpstreamRemote $TemplateUrl
}

# ── 2. Configure the "ours" merge driver ────────────────────────────────────
$ErrorActionPreference = "SilentlyContinue"
$oursDriver = git config merge.ours.driver 2>$null
$oursExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($oursExitCode -ne 0) {
    Write-Info "Configuring 'ours' merge driver..."
    git config merge.ours.driver true
} else {
    Write-Info "'ours' merge driver already configured."
}

# ── 3. Fetch upstream ───────────────────────────────────────────────────────
Test-UpstreamAccess
Write-Info "Fetching $UpstreamRemote/$UpstreamBranch..."
git fetch $UpstreamRemote $UpstreamBranch
if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to fetch from upstream."
    exit 1
}

# ── 4. Check if there are changes to merge ──────────────────────────────────
$localHead = git rev-parse HEAD
$upstreamHead = git rev-parse "$UpstreamRemote/$UpstreamBranch"
$ErrorActionPreference = "SilentlyContinue"
$mergeBase = git merge-base HEAD "$UpstreamRemote/$UpstreamBranch" 2>$null
$ErrorActionPreference = "Stop"

if ($localHead -eq $upstreamHead) {
    Write-Info "Already up to date with upstream template."
    exit 0
}

if ($upstreamHead -eq $mergeBase) {
    Write-Info "Already up to date (local is ahead of upstream)."
    exit 0
}

# ── 5. Merge upstream changes ───────────────────────────────────────────────
$currentBranch = git branch --show-current
$today = Get-Date -Format "yyyy-MM-dd"
Write-Info "Merging $UpstreamRemote/$UpstreamBranch into $currentBranch..."

git merge "$UpstreamRemote/$UpstreamBranch" `
    --no-edit `
    -m "chore(template): sync with upstream template $today" `
    --allow-unrelated-histories

if ($LASTEXITCODE -ne 0) {
    Write-Warn "Merge conflicts detected. Resolve them, then commit."
    Write-Warn "Project-specific files (.plans/project/, .agent-logs/project/, README.md) should be safe"
    Write-Warn "thanks to .gitattributes merge=ours."
    Write-Warn ""
    Write-Warn "After resolving conflicts:"
    Write-Warn "  git add ."
    Write-Warn "  git commit"
    exit 1
}

# ── 6. Remove template context (should not exist in project repos) ───────────
# Template plans and logs belong only in the template repo. The merge may have
# brought new files that merge=ours couldn't block (new files have no conflict).
# Remove them so project agents are not confused by template context.
$templateDirs = @(".plans/template", ".agent-logs/template")
$cleaned = $false
foreach ($dir in $templateDirs) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Recurse -File | Where-Object { $_.Name -ne "README.md" }
        if ($files.Count -gt 0) {
            Write-Info "Removing template content from $dir/ (not needed in project repos)..."
            foreach ($f in $files) {
                git rm --quiet $f.FullName 2>$null
            }
            $cleaned = $true
        }
    }
}
if ($cleaned) {
    git commit --no-edit -m "chore(template-sync): remove template plans/logs from project repo"
    Write-Info "Cleaned up template-specific content."
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Info ""
Write-Info "Synced with upstream template."
Write-Info "  Protected paths (kept your version):"
Write-Info "    .plans/project/**"
Write-Info "    .agent-logs/project/**"
Write-Info "    README.md"
Write-Info ""
Write-Info "  Removed (template context, not needed in project repos):"
Write-Info "    .plans/template/**"
Write-Info "    .agent-logs/template/**"
Write-Info ""
Write-Info "  Updated paths (from template):"
Write-Info "    .github/agents/"
Write-Info "    .github/hooks/"
Write-Info "    .github/prompts/"
Write-Info "    .github/instructions/"
Write-Info "    .devcontainer/"
Write-Info "    TEMPLATE-GUIDE.md"
Write-Info "    scripts/"

Write-Info ""
Write-Info "Review the changes with: git log --oneline -5"
