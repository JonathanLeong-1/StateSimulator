# Project Standards

## Architect-First Protocol (MANDATORY)

This project uses a multi-agent workflow. **All non-trivial changes MUST go through the proper agent workflow.** If you are a Copilot agent (including the default agent mode) receiving a request to implement features, fix bugs, refactor code, or make architectural changes:

1. **Check `.plans/project/` for an approved plan** that covers the requested change. If one exists, follow it.
2. **If no approved plan exists**, do NOT proceed with implementation. Instead:
   - Inform the user that this project requires changes to be routed through `@architect` first for design/planning, or through the appropriate team lead (`@backend-lead`, `@frontend-lead`, `@infra-lead`) for scoped feature work.
   - Suggest: _"This project follows an architect-first workflow. Please invoke `@architect` to design this change, or `@<lead>` to plan and delegate it — so the work is properly planned, tracked, and logged."_
3. **Exceptions** (changes that may proceed without a full `.plans/` architecture document):
   - Typo fixes in documentation only (`.md` files)
   - Updating dependencies / lockfiles
   - Changes explicitly requested by a team lead agent as part of an active plan

   **Even excepted changes MUST**:
   - Be made on a feature or fix branch (never directly on `main`)
   - Pass existing tests (run the project's test command)
   - Receive a self-review or peer review before merge

   **Removed exception**: "Single-line bug fixes with obvious correctness" is no longer excepted.
   All bug fixes, regardless of size, require a branch, test pass, and review.

   | Change Type | Plan Required | Branch Required | Tests Required | Review Required |
   |---|---|---|---|---|
   | Feature / Refactor / Architecture | Yes | Yes | Yes | Yes |
   | Bug fix (any size) | Yes | Yes | Yes | Yes |
   | Documentation typo (`.md` only) | No | Yes | No (if no code) | Self-review |
   | Dependency / lockfile update | No | Yes | Yes | Self-review |
   | Lead-delegated subtask | No (plan exists) | Yes | Yes | Yes |

**Why**: Direct edits bypass the planning, branching, testing, logging, and review protocols that this template enforces. Unplanned changes create drift from the architectural design and are not tracked in `.agent-logs/`.

## Repository
- Main branch: `main` (protected)
- Feature branches: `feature/<area>/<short-description>`
- Bug fix branches: `fix/<area>/<short-description>`

## Modular Architecture Preference
- The architect MUST default to modular/microservice architecture for all new projects
- Components should be stateless (except data/storage layers), independently deployable, and communicate via stable APIs
- Exceptions allowed only for trivially simple projects (< 3 components) or when human explicitly requests monolith
- Any deviation must be justified in the architecture document

## Branching Workflow
- Always create a feature branch before making changes
- Never commit directly to `main`
- Write descriptive commit messages: `<type>(<scope>): <description>`
- Types: feat, fix, docs, test, refactor, chore

## Planning Workflow
- For new projects, start with `@architect` to design the system architecture before tasking leads
- The architect reads all existing plans in `.plans/project/` first to refresh context and check for plan matches
- The architect iteratively interviews the human, produces architecture documents, determines the execution mode (local sequential vs Codespaces parallel), and decomposes into mode-aware workstream briefs
- After architecture approval, the architect produces a **Launch Plan** (saved to `.plans/project/`) that specifies execution waves, Codespace counts, sync points, and complete delegation payloads for reproducibility
- **Only `@architect` may create or edit files in `.plans/`** — team leads and all other agents treat `.plans/` as read-only
- **`.plans/template/`** contains plans for the template itself — synced from upstream, not project-specific
- **`.plans/project/`** contains plans for the project built with this template — protected from upstream sync via `merge=ours`
- Team leads MUST read the relevant `.plans/project/` file (architecture + launch plan) to understand context and their execution mode before executing
- Team leads MUST present execution plans to the human user for approval before starting work
- Team leads log their approved execution details and session summaries in `.agent-logs/project/` (or `.agent-logs/template/` for template work), NOT in `.plans/`
- Approved plans, architecture documents, and launch plans are saved to `.plans/project/` with date-timestamped filenames
- All agents must reference the relevant plan/architecture/launch plan files in their work and logs
- Workstream briefs include an Execution Context block (mode, wave, parallel peers, prerequisites, sync points)
- Plans are immutable after approval — they serve as the source of truth

## Code Quality
- All code must have tests before merge
- Run the project's test command before considering work complete
- Follow existing patterns in the codebase
- No commented-out code in commits

## Documentation
- Team leads MUST invoke @docs-writer after implementation to update project documentation
- `README.md` contains project-specific documentation (features, setup, usage)
- `TEMPLATE-GUIDE.md` contains template usage instructions — do not overwrite
- Architecture documents in `.plans/project/` serve as canonical design references
- **Only `@architect` may create or edit files in `.plans/`** — team leads and all other agents treat `.plans/` as read-only
- Agent logs in `.agent-logs/project/` (or `.agent-logs/template/`) must include plan references and full timestamps

## Agent Monitor Dashboard
- An optional web-based dashboard is available at `dashboard/`
- Launch with `node dashboard/start.js` (opens at http://127.0.0.1:4820)
- The dashboard reads `.agent-logs/`, `.plans/`, `.agent-events/`, and git branch data
- Agents may write structured events to `.agent-events/events.jsonl` using `dashboard/lib/log-event.js`
- The dashboard is purely additive — it does not affect existing agent behavior

### Dashboard v2 Event Types
Agents emit events via `node dashboard/lib/emit-event.js <agent> <event> [options]`.

| Event | Who | When | Example |
|-------|-----|------|---------|
| `session-start` | architect only | First command of new session | `...architect session-start --plan ".plans/file.md"` |
| `spawned --parent` | all agents | When starting work | `...agent spawned --parent "parent-agent"` |
| `thinking` | all agents | Major reasoning milestones | `...agent thinking --detail "Analyzing requirements"` |
| `todo-update` | agents with task lists | After manage_todo_list | `...agent todo-update --todos '[{...}]'` |

Note: `session-start` triggers a full dashboard data wipe. Only the architect should emit it.

### Multi-Workstream Event Protocol

When multiple workstreams run in parallel (e.g., in separate Codespaces), the dashboard supports per-workstream event files and cross-Codespace event transport.

#### Per-Workstream Event Files

Events are routed to workstream-specific files based on the `--workstream` flag:

| Workstream | Event File |
|------------|------------|
| _(none / architect)_ | `.agent-events/events.jsonl` |
| `backend` | `.agent-events/events-backend.jsonl` |
| `frontend` | `.agent-events/events-frontend.jsonl` |
| `infra` | `.agent-events/events-infra.jsonl` |

Usage: `node dashboard/lib/emit-event.js <agent> <event> --workstream <name> [options]`

Lead agents MUST include `--workstream <name>` on ALL `emit-event.js` calls. Subagents inherit the workstream from the lead's Delegation Payload and use the `{{WORKSTREAM}}` placeholder.

#### Cross-Codespace Event Transport

Events are transported between Codespaces via the `agent-events` orphan git branch:

- **`node dashboard/lib/push-events.js --workstream <name>`** — Commits and force-pushes the workstream's event file to the `agent-events` branch. Called by lead agents after gates 3, 4, and 7.
- **`node dashboard/lib/push-events.js --all`** — Pushes all local event files. Used by the architect after saving plans and delegation.
- **`node dashboard/lib/push-events.js --all --wipe`** — Clears the remote branch first (used at session-start by architect).
- **`node dashboard/lib/pull-events.js`** — Fetches the `agent-events` branch and copies all `events-*.jsonl` files to local `.agent-events/`. Used by the architect to monitor workstream progress.

#### The `agent-events` Orphan Branch

A git orphan branch named `agent-events` stores event files without polluting the main branch history. The branch is created automatically by `push-events.js` if it doesn't exist. Each workstream owns its event file exclusively — no merge conflicts.

#### Continuous Monitoring

Set `DASHBOARD_GIT_POLL=true` before starting the dashboard server to enable automatic 5-second polling that fetches workstream events from the `agent-events` branch. This keeps the dashboard updated in real time when workstreams run in separate Codespaces.

## Strict Delegation Protocol (MANDATORY)

All lead agents (backend-lead, frontend-lead, infra-lead) MUST follow the **7-Gate Mandatory Execution Sequence** when executing work. No gate may be skipped.
Leads MUST delegate to subagents — they must NEVER write code, run tests, review code, or write docs themselves.

**Tool Enforcement**: Only coding agents (`@developer`, `@tester`, `@docs-writer`) have the `edit` tool and may create or modify files. All other agents — including `@architect`, all leads, and `@code-reviewer` — are **physically prevented** from editing files via tool restrictions.

| Agent Category | `edit` Tool | `execute` Scope | File Permissions |
|----------------|------------|-----------------|------------------|
| **Architect** (`@architect`) | ❌ No | git read, dashboard events, timestamps, own log, `.plans/` files only | Create/edit `.plans/` and own session log only |
| **Leads** (`@backend-lead`, `@frontend-lead`, `@infra-lead`) | ❌ No | git ops, dashboard events, own log only | Own session log only |
| **Code Reviewer** (`@code-reviewer`) | ❌ No | git diff, read-only inspection, own log only | Own session log only |
| **Test Lead** (`@test-lead`) | ❌ No | git read, dashboard events, own log, `.test-specs/` file creation | `.test-specs/` and own session log only |
| **Coders** (`@developer`, `@tester`, `@docs-writer`) | ✅ Yes | Full terminal access | Full file creation/modification |

Non-coding agents must NEVER use the `execute` tool to create, edit, or delete application code, test files, config files, or documentation. The `execute` tool is restricted to: git operations, dashboard event emission, timestamp retrieval, and appending to the agent's own session log.

| Gate | Required Action | Cannot Proceed Until |
|------|----------------|---------------------|
| 0 | Plan Approval | Human approves execution plan |
| 1 | Branch Creation | Feature branch exists |
| 2 | Implementation | `@developer` returns completion report |
| 2.5 | Test Spec Readiness | Test-lead specs exist for workstream (or fallback documented) |
| 3 | Testing | `@tester` returns verdict "ALL PASS" |
| 4 | Code Review | `@code-reviewer` returns verdict "APPROVE" |
| 5 | Documentation | `@docs-writer` returns completion report |
| 6 | Pre-Commit Checklist | All 8 checkboxes verified TRUE |
| 7 | Commit & Report | Session log written, events emitted |

### Delegation Rules
- Leads MUST pass a **Delegation Payload** (plan ref, branch, task, acceptance criteria) to every subagent
- Subagents MUST return a **Completion Report** with structured fields including "Log Written: yes/no"
- Leads MUST verify each subagent's "Log Written" field is "yes" before proceeding
- If `@tester` reports failures → loop back to `@developer`, then re-test
- If `@code-reviewer` requests changes → loop back to `@developer`, re-test, re-review
- NEVER skip `@tester`, `@code-reviewer`, or `@docs-writer` — all three are mandatory
- All agents MUST write session logs to `.agent-logs/project/` (or `.agent-logs/template/`) and emit dashboard events

### Test-Lead Invocation (Mandatory)
- The `@test-lead` MUST be invoked after leads receive and present their execution plans
- The human (or architect during automated delegation) invokes `@test-lead` with the architecture plan and all workstream execution plans
- Test-lead runs in PARALLEL with Gate 2 (development) across all workstreams
- Test-lead produces specs to `.test-specs/project/` that leads use at Gate 3
- If test-lead is not invoked, Gate 2.5 fallback applies (developer's suggested tests used instead)

## Subagent Unavailable Fallback

The `runSubagent` tool may not be available in all VS Code Copilot Chat sessions. When this occurs, delegating agents (leads and architect) follow a tiered fallback:

| Tier | Mode | Description |
|------|------|-------------|
| Normal | runSubagent delegation | Standard protocol � leads invoke subagents |
| Tier 1 | Human-relay | Lead prepares delegation payloads for human to paste into separate agent chats |
| Tier 2 | Self-execution | Lead performs all subagent work itself (requires human's explicit blanket approval) |

**Detection**: Leads check for runSubagent availability at session start (Step 0, before Gate 0).

**Tier 2 constraints**: Even in self-execution mode, leads MUST follow the 7-gate sequence, write separate logs per role (developer-log, tester-log, code-reviewer-log, docs-writer-log), and note `Execution Mode: fallback-self-execution` in each log.

**Dashboard**: Leads emit a `fallback-mode` event with detail `tier-1` or `tier-2` so the dashboard shows when fallback is active.

**Architect**: Only supports Tier 1 (manual delegation payloads). The architect must never self-execute implementation work.

## Collaboration
- Each workstream operates on its own feature branch
- Use pull requests for integration to `main`
- Agents must document non-obvious decisions in code comments
