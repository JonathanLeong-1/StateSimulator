# Fix: sync-template scripts fail in Codespaces despite gh auth setup-git

**Date**: 2026-04-13
**Status**: Approved
**Author**: @architect

---

## Problem

`sync-template.sh` (and `.ps1`) fail with "write access to repository not granted" (HTTP 403) when run in GitHub Codespaces, even though `gh auth setup-git` succeeds.

### Root Cause

`gh auth setup-git` configures git to use `gh`'s credential helper. However, in Codespaces, `gh` itself authenticates with the **Codespace-scoped `GITHUB_TOKEN`** — an installation token (`ghs_...`) that only grants access to the *current repository*. When git fetches from the *upstream template* repo (a different repository), the credential helper returns this scoped token, and GitHub rejects it with a 403.

`gh auth setup-git` is necessary but not sufficient: it routes credentials through `gh`, but doesn't upgrade the token scope.

## Solution

### Strategy

Move the Codespace auth logic from a **pre-flight block** to a **pre-fetch access check** that:

1. Extracts the upstream repo owner/name from the remote URL
2. Tests actual access with `gh api repos/{owner}/{repo} --silent`
3. If access fails → instructs the user to run `gh auth login` (interactive device-flow login grants a user-scoped token with full repo access), then exits with a clear error
4. If access passes → proceeds to `git fetch` as normal

### Why `gh auth login`?

`gh auth login` performs an interactive OAuth device flow that replaces the scoped `GITHUB_TOKEN` with a **user-scoped PAT** stored in `gh`'s credential store. This token has the user's full repo access — including the upstream template repo. After login, `gh auth setup-git` routes git through this upgraded token.

## Scope

### Files to modify

| File | Change |
|---|---|
| `scripts/sync-template.sh` | Replace Codespace auth block (lines ~52-60) with post-remote-config access-check function; call it before `git fetch` |
| `scripts/sync-template.ps1` | Same logic ported to PowerShell |

### Changes NOT in scope

- `devcontainer.json` — no changes needed
- `dashboard/` — no changes
- New files — none required

## Implementation Details

### Bash (`sync-template.sh`)

**Remove** the current Codespace authentication block (lines 52-60).

**Add** a helper function after the remote configuration section (after section 1, before section 3):

```bash
# ── 2b. Verify upstream access (Codespaces) ─────────────────────────────────
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
    error "Fix: run 'gh auth login' to authenticate with your GitHub account,"
    error "then re-run this script."
    error ""
    error "  gh auth login"
    error "  ./scripts/sync-template.sh"
    exit 1
}
```

Call `check_upstream_access` immediately before the `git fetch` line.

### PowerShell (`sync-template.ps1`)

Same logic: remove old Codespace block, add `Test-UpstreamAccess` function, call before fetch.

## Acceptance Criteria

1. In a Codespace with default `GITHUB_TOKEN`, running `sync-template.sh` without `gh auth login` prints a clear error message directing the user to run `gh auth login`
2. After `gh auth login`, running `sync-template.sh` successfully fetches from upstream
3. Outside Codespaces, the scripts behave exactly as before (no regression)
4. All existing dashboard tests pass (55/55)
5. Both `.sh` and `.ps1` scripts are updated consistently

## Delegation

- **Workstream**: `@infra-lead` → `@developer` → `@tester` → `@code-reviewer` → `@docs-writer`
- **Branch**: `fix/infra/sync-template-token-scope`
- **7-gate protocol**: mandatory
