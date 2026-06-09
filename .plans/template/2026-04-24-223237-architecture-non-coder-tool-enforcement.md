# Architecture: Non-Coder Agent Tool Enforcement

- **Date**: 2026-04-24 22:32:37
- **Architect**: architect
- **Status**: approved
- **Feature Fingerprint**: non-coder-tool-enforcement

## Feature Fingerprint

- **Canonical Name**: `non-coder-tool-enforcement`
- **Aliases**: architect-edit-restriction, architect-tool-lockdown, non-coding-agent-enforcement, delegation-enforcement-expansion
- **Category**: infrastructure / workflow-enforcement

## Problem Statement

When the `edit` tool was removed from lead agents (backend-lead, frontend-lead, infra-lead) to enforce delegation to subagents, an unintended side effect emerged: the **architect agent** started editing files directly instead of delegating to leads. The architect's `execute` tool allows terminal-based file creation/modification (e.g., `echo "..." > file.py`), and when running in the Copilot default agent mode, the architect-first protocol is only a soft instruction — not a hard tool constraint.

Additionally, the **code-reviewer** agent has the `execute` tool, which could theoretically be misused to modify files instead of performing read-only review.

The core principle: **only `@developer`, `@tester`, and `@docs-writer` should create or modify files.** All other agents (architect, leads, code-reviewer) should plan, design, review, and delegate.

## Design

### Agent Role Matrix

| Agent | Role | May Edit Files | May Run Code/Tests | May Create Branches | `edit` Tool | `execute` Tool Scope |
|-------|------|---------------|-------------------|-------------------|-------------|---------------------|
| `architect` | Design, plan, delegate to leads | Only `.plans/` and own log | No | No | No | git read, dashboard events, date, own log only |
| `backend-lead` | Plan, delegate to subagents | Only own session log | No | Yes (git only) | No | git ops, dashboard events, own log only |
| `frontend-lead` | Plan, delegate to subagents | Only own session log | No | Yes (git only) | No | git ops, dashboard events, own log only |
| `infra-lead` | Plan, delegate to subagents | Only own session log | No | Yes (git only) | No | git ops, dashboard events, own log only |
| `code-reviewer` | Review, verdict only | No | No | No | No | git diff, read-only inspection only |
| `developer` | **Write application code** | **Yes** | **Yes** | No | **Yes** | Full |
| `tester` | **Write and run tests** | **Yes** | **Yes** | No | **Yes** | Full |
| `docs-writer` | **Write documentation** | **Yes** | No | No | **Yes** | Full |

### Changes Required

#### 1. `.github/agents/architect.agent.md`

**Add** a "FORBIDDEN ACTIONS" section (matching the lead agent pattern) immediately after "Your Responsibilities":

```markdown
## FORBIDDEN ACTIONS — Architect Must NEVER Do These
- ❌ **Write or edit application code** — only `@developer` writes code (via leads)
- ❌ **Write or edit test files** — only `@tester` writes tests (via leads)
- ❌ **Write or edit documentation** (except `.plans/` files and own log) — only `@docs-writer` writes docs (via leads)
- ❌ **Create feature branches** — only leads create branches
- ❌ **Run tests** — only `@tester` runs tests (via leads)
- ❌ **Fix code or bugs directly** — delegate to the appropriate lead
- ❌ **Use `execute` to create or modify files** outside of `.plans/` and own session log

If you find yourself about to write code, STOP and delegate to the appropriate `@<lead>`.
If you find yourself about to fix a bug, STOP and delegate to the appropriate `@<lead>`.
```

**Add** a "HARD DELEGATION CONSTRAINT" section after the FORBIDDEN ACTIONS:

```markdown
## HARD DELEGATION CONSTRAINT — Execute Tool Restrictions

**You do NOT have the `edit` tool. You CANNOT create or modify source files directly. This is intentional — it enforces delegation.**

Your `execute` tool (terminal commands) is RESTRICTED to:
- ✅ `git` read commands (status, log, branch --list, diff)
- ✅ `node dashboard/lib/emit-event.js` and `push-events.js` / `pull-events.js`
- ✅ `Get-Date` / `date` for timestamps
- ✅ `echo $env:CODESPACES` for environment detection
- ✅ Reading files (cat, type, Get-Content) for plan review
- ✅ Appending to your own session log in `.agent-logs/`
- ✅ Creating/editing files ONLY in `.plans/` (your exclusive domain)
- ❌ NEVER use `execute` to create or edit application code, test files, config files, or documentation outside `.plans/`
- ❌ NEVER use `execute` to run application code or tests
- ❌ NEVER use `execute` to install packages or modify dependencies

If a file outside `.plans/` needs to be created or modified, you MUST delegate to a lead, who MUST delegate to `@developer`, `@tester`, or `@docs-writer`.
```

**Update** the existing Constraints section to add:
```
- DO NOT use `execute` to create, edit, or delete any files outside `.plans/` and your own session log
- DO NOT fix bugs, write code, write tests, or write documentation — delegate to leads
- ONLY `@developer`, `@tester`, and `@docs-writer` may create or modify files in the repository (excluding `.plans/`)
```

#### 2. `.github/agents/code-reviewer.agent.md`

**Add** a "FORBIDDEN ACTIONS" section after "Your Responsibilities":

```markdown
## FORBIDDEN ACTIONS — Code Reviewer Must NEVER Do These
- ❌ **Write, edit, or fix code** — you are read-only; if changes are needed, return a "REQUEST CHANGES" verdict
- ❌ **Write or edit test files** — only `@tester` writes tests
- ❌ **Create or modify any files** — you produce a review verdict, nothing else
- ❌ **Run application code or tests** — only read and analyze
- ❌ **Use `execute` to modify files** — `execute` is for `git diff` and read-only inspection only

If you find a bug or issue, document it in your review verdict. Do NOT fix it yourself.
```

**Add** a "HARD DELEGATION CONSTRAINT" section:

```markdown
## HARD DELEGATION CONSTRAINT — Execute Tool Restrictions

**You do NOT have the `edit` tool. You CANNOT create or modify files. This is intentional — you are a read-only reviewer.**

Your `execute` tool is RESTRICTED to:
- ✅ `git diff`, `git log`, `git show` for reviewing changes
- ✅ `node dashboard/lib/emit-event.js` for dashboard events
- ✅ Reading files (cat, type, Get-Content) for review context
- ✅ Appending to your own session log in `.agent-logs/`
- ❌ NEVER use `execute` to create, edit, or delete any file
- ❌ NEVER use `execute` to run tests or application code
```

#### 3. `.github/copilot-instructions.md`

**Replace** the existing "Tool Enforcement" paragraph in the "Strict Delegation Protocol" section with an expanded version:

Current (single paragraph):
```
**Tool Enforcement**: Lead agents do NOT have the `edit` tool — they physically cannot create or modify files. This is by design. All file creation/modification must be delegated to the appropriate sub-agent (`@developer`, `@tester`, `@docs-writer`). Leads use the `execute` tool (terminal commands) only for git operations, dashboard events, and appending their own session logs.
```

Replace with:
```markdown
**Tool Enforcement**: Only coding agents (`@developer`, `@tester`, `@docs-writer`) have the `edit` tool and may create or modify files. All other agents — including `@architect`, all leads, and `@code-reviewer` — are **physically prevented** from editing files via tool restrictions.

| Agent Category | `edit` Tool | `execute` Scope | File Permissions |
|----------------|------------|-----------------|------------------|
| **Architect** (`@architect`) | ❌ No | git read, dashboard events, timestamps, own log, `.plans/` files only | Create/edit `.plans/` and own session log only |
| **Leads** (`@backend-lead`, `@frontend-lead`, `@infra-lead`) | ❌ No | git ops, dashboard events, own log only | Own session log only |
| **Code Reviewer** (`@code-reviewer`) | ❌ No | git diff, read-only inspection, own log only | Own session log only |
| **Coders** (`@developer`, `@tester`, `@docs-writer`) | ✅ Yes | Full terminal access | Full file creation/modification |

Non-coding agents must NEVER use the `execute` tool to create, edit, or delete application code, test files, config files, or documentation. The `execute` tool is restricted to: git operations, dashboard event emission, timestamp retrieval, and appending to the agent's own session log.
```

#### 4. `.plans/template/2026-04-09-180237-strict-delegation-protocol.md`

**Add** a new section "### 6. Non-Coder Agent Tool Restrictions" at the end of the "Design: Strict Delegation Protocol" section:

```markdown
### 6. Non-Coder Agent Tool Restrictions

The delegation enforcement extends beyond leads to ALL non-coding agents:

**Architect**:
- Has `execute` but NOT `edit`
- `execute` is restricted to: git read commands, dashboard events, timestamps, environment detection, reading files, and creating/editing ONLY in `.plans/` and own session log
- Must delegate ALL implementation work to leads, who delegate to coders
- The ONLY files the architect may create/edit are in `.plans/` and `.agent-logs/`

**Code Reviewer**:
- Has `execute` but NOT `edit`
- `execute` is restricted to: `git diff`, `git log`, `git show`, reading files, dashboard events, and own session log
- Must NEVER modify any file — produces review verdicts only
- If code needs changes, returns "REQUEST CHANGES" verdict to the lead

**General Rule**: Only `@developer`, `@tester`, and `@docs-writer` may create or modify files in the repository. All other agents (architect, leads, code-reviewer) operate in a plan/delegate/review capacity only.
```

## Repository Structure

No new files created. Modified files only:

| File | Change Type | Description |
|------|------------|-------------|
| `.github/agents/architect.agent.md` | Edit | Add FORBIDDEN ACTIONS + HARD DELEGATION CONSTRAINT sections, update Constraints |
| `.github/agents/code-reviewer.agent.md` | Edit | Add FORBIDDEN ACTIONS + HARD DELEGATION CONSTRAINT sections |
| `.github/copilot-instructions.md` | Edit | Expand Tool Enforcement section with Agent Role Matrix table |
| `.plans/template/2026-04-09-180237-strict-delegation-protocol.md` | Edit | Add section 6: Non-Coder Agent Tool Restrictions |

## Naming Conventions

N/A — no new code entities.

## Interface Contracts

N/A — documentation/configuration change only.

## Test Specifications

### Verification Tests (Manual)

1. **Architect tool list verification**: Confirm `architect.agent.md` YAML frontmatter does NOT contain `edit`
2. **Code-reviewer tool list verification**: Confirm `code-reviewer.agent.md` YAML frontmatter does NOT contain `edit`
3. **Lead tool list verification**: Confirm all 3 lead `.agent.md` files do NOT contain `edit`
4. **Coder tool list verification**: Confirm `developer.agent.md`, `tester.agent.md`, `docs-writer.agent.md` DO contain `edit`
5. **copilot-instructions.md**: Confirm the expanded Tool Enforcement section includes the Agent Role Matrix table
6. **Delegation protocol**: Confirm section 6 exists with non-coder restrictions
7. **Existing tests**: Run `cd dashboard; npm test` to ensure no regressions from doc changes

## Expected Output Manifest

| Workstream | Files Modified | Exports / Endpoints | Tests |
|------------|---------------|---------------------|-------|
| template-enforcement | `.github/agents/architect.agent.md` | N/A | Manual verification |
| template-enforcement | `.github/agents/code-reviewer.agent.md` | N/A | Manual verification |
| template-enforcement | `.github/copilot-instructions.md` | N/A | Manual verification |
| template-enforcement | `.plans/template/2026-04-09-180237-strict-delegation-protocol.md` | N/A | Manual verification |

## Reproducibility Notes

- This is a documentation/configuration-only change — no application code modified
- Changes follow the exact same FORBIDDEN ACTIONS + HARD DELEGATION CONSTRAINT pattern established for leads in the 2026-04-09 strict delegation protocol
- The Agent Role Matrix table is the canonical reference for tool permissions across all agents

## Approval

- Approved by: human user
- Approved at: 2026-04-24 22:32:37
