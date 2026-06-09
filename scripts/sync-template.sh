#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# sync-template.sh — Pull updates from the upstream template repository
#
# Usage:
#   ./scripts/sync-template.sh [TEMPLATE_URL]
#
# If TEMPLATE_URL is omitted, the script uses the existing "upstream" remote.
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
set -euo pipefail

TEMPLATE_URL="${1:-}"
UPSTREAM_REMOTE="upstream"
UPSTREAM_BRANCH="main"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[sync]${NC} $*"; }
warn()  { echo -e "${YELLOW}[sync]${NC} $*"; }
error() { echo -e "${RED}[sync]${NC} $*" >&2; }

# ── Pre-flight checks ───────────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    error "Not inside a Git repository. Run this from your project root."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    error "Working tree is dirty. Commit or stash changes before syncing."
    exit 1
fi

# ── Codespace upstream access check ─────────────────────────────────────────
# In Codespaces the default GITHUB_TOKEN is scoped to the current repo only.
# gh auth setup-git routes git credentials through gh, but the token still
# cannot access a different (upstream) repo. This function detects that
# situation and directs the user to run `gh auth login` for a full-scope token.
check_upstream_access() {
    # Only needed in Codespaces where GITHUB_TOKEN is repo-scoped
    if [ "${CODESPACES:-}" != "true" ] && [ -z "${CODESPACE_NAME:-}" ]; then
        return 0
    fi

    if ! command -v gh &>/dev/null; then
        warn "Codespace detected but gh CLI not found."
        warn "If fetch fails, install gh or use a PAT."
        return 0
    fi

    # Clear the Codespace-scoped GITHUB_TOKEN so gh uses stored credentials
    # (or prompts for login) instead of the repo-scoped installation token.
    unset GITHUB_TOKEN

    # Ensure gh credential helper is active
    gh auth setup-git 2>/dev/null || true

    # Extract owner/repo from upstream URL
    local url
    url=$(git remote get-url "$UPSTREAM_REMOTE" 2>/dev/null) || return 0
    local slug
    slug=$(echo "$url" | sed -E 's#.*github\.com[:/]##; s/\.git$//')

    if [ -z "$slug" ] || ! echo "$slug" | grep -q '/'; then
        warn "Cannot parse upstream repo slug from URL: $url"
        return 0
    fi

    info "Checking access to upstream repo ($slug)..."
    if gh api "repos/$slug" --silent 2>/dev/null; then
        info "Access confirmed."
        return 0
    fi

    error "Cannot access upstream repo: $slug"
    error "The Codespace token is scoped to the current repo only."
    error ""
    error "Fix: clear the scoped token and log in with your GitHub account:"
    error ""
    error "  unset GITHUB_TOKEN"
    error "  gh auth login"
    error "  ./scripts/sync-template.sh"
    exit 1
}

# ── 1. Configure upstream remote ────────────────────────────────────────────
if git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
    CURRENT_URL=$(git remote get-url "$UPSTREAM_REMOTE")
    info "Upstream remote already exists: $CURRENT_URL"
    if [ -n "$TEMPLATE_URL" ] && [ "$CURRENT_URL" != "$TEMPLATE_URL" ]; then
        warn "Updating upstream URL to: $TEMPLATE_URL"
        git remote set-url "$UPSTREAM_REMOTE" "$TEMPLATE_URL"
    fi
else
    if [ -z "$TEMPLATE_URL" ]; then
        error "No upstream remote found. Provide the template URL:"
        error "  ./scripts/sync-template.sh https://github.com/YOUR_ORG/agentic-vibe-coding.git"
        exit 1
    fi
    info "Adding upstream remote: $TEMPLATE_URL"
    git remote add "$UPSTREAM_REMOTE" "$TEMPLATE_URL"
fi

# ── 2. Configure the "ours" merge driver ────────────────────────────────────
if ! git config merge.ours.driver &>/dev/null; then
    info "Configuring 'ours' merge driver..."
    git config merge.ours.driver true
else
    info "'ours' merge driver already configured."
fi

# ── 3. Fetch upstream ───────────────────────────────────────────────────────
check_upstream_access
info "Fetching upstream/$UPSTREAM_BRANCH..."
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

# ── 4. Check if there are changes to merge ──────────────────────────────────
LOCAL_HEAD=$(git rev-parse HEAD)
UPSTREAM_HEAD=$(git rev-parse "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH")
MERGE_BASE=$(git merge-base HEAD "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" 2>/dev/null || echo "")

if [ "$LOCAL_HEAD" = "$UPSTREAM_HEAD" ]; then
    info "Already up to date with upstream template."
    exit 0
fi

if [ "$UPSTREAM_HEAD" = "$MERGE_BASE" ]; then
    info "Already up to date (local is ahead of upstream)."
    exit 0
fi

# ── 5. Merge upstream changes ───────────────────────────────────────────────
CURRENT_BRANCH=$(git branch --show-current)
info "Merging upstream/$UPSTREAM_BRANCH into $CURRENT_BRANCH..."

if git merge "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" \
    --no-edit \
    -m "chore(template): sync with upstream template $(date +%Y-%m-%d)" \
    --allow-unrelated-histories; then
    info "Template merge complete."
else
    warn "Merge conflicts detected. Resolve them, then commit."
    warn "Project-specific files (.plans/project/, .agent-logs/project/, README.md) should be safe"
    warn "thanks to .gitattributes merge=ours."
    warn ""
    warn "After resolving conflicts:"
    warn "  git add ."
    warn "  git commit"
    exit 1
fi

# ── 6. Remove template context (should not exist in project repos) ───────────
# Template plans and logs belong only in the template repo. The merge may have
# brought new files that merge=ours couldn't block (new files have no conflict).
# Remove them so project agents are not confused by template context.
CLEANED=false
for dir in .plans/template .agent-logs/template; do
    if [ -d "$dir" ]; then
        # Find all files except README.md
        FILES=$(find "$dir" -type f ! -name "README.md" 2>/dev/null)
        if [ -n "$FILES" ]; then
            info "Removing template content from $dir/ (not needed in project repos)..."
            echo "$FILES" | xargs git rm --quiet 2>/dev/null || true
            CLEANED=true
        fi
    fi
done
if [ "$CLEANED" = true ]; then
    git commit --no-edit -m "chore(template-sync): remove template plans/logs from project repo"
    info "Cleaned up template-specific content."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
info ""
info "✓ Synced with upstream template."
info "  Protected paths (kept your version):"
info "    .plans/project/**"
info "    .agent-logs/project/**"
info "    README.md"
info ""
info "  Removed (template context, not needed in project repos):"
info "    .plans/template/**"
info "    .agent-logs/template/**"
info ""
info "  Updated paths (from template):"
info "    .github/agents/"
info "    .github/hooks/"
info "    .github/prompts/"
info "    .github/instructions/"
info "    .devcontainer/"
info "    TEMPLATE-GUIDE.md"
info "    scripts/"
