# Agentic Vibe Coding — Template Guide

> **This file documents how to use this template repository.** It is intentionally separate
> from `README.md` so that when you customize your project, `README.md` can be updated with
> your project-specific content without losing the template usage instructions.

## What Is This Template?

A template repository for running a **multi-agent GitHub Copilot coding team** in VS Code
and GitHub Codespaces. Specialized AI agents collaborate across Git branches — team leads
plan and delegate, developers write code, testers validate, reviewers gatekeep quality,
and docs writers keep documentation current.

## Architecture Overview

This guide sets up a **multi-agent coding team** where specialized GitHub Copilot agents
collaborate across Git branches to produce a working product. Each agent has a defined role
(architect, team lead, developer, tester, reviewer) with restricted tools and focused instructions.

```
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR (You)                        │
│          Uses @architect to design the system               │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   ARCHITECT                            │ │
│  │   Interviews you → Designs MODULAR architecture →      │ │
│  │   Produces workstream briefs for each team lead        │ │
│  └────┬──────────────┬──────────────┬──────────────┬──────┘ │
│       │              │              │              │        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Team Lead│  │ Team Lead│  │ Team Lead│  │ Test Lead│     │
│  │ (Backend)│  │(Frontend)│  │  (Infra) │  │(Testing) │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       │             │             │             │           │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐   (produces       │
│  │Developer │  │Developer │  │Developer │   test specs)     │
│  │  Agent   │  │  Agent   │  │  Agent   │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │             │             │                         │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐                   │
│  │  Tester  │  │  Tester  │  │  Tester  │  ← uses test-lead │
│  │  Agent   │  │  Agent   │  │  Agent   │   specs as input  │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                             │
│  ┌──────────┐  ┌──────────┐                                 │
│  │Code      │  │  Docs    │  ← also documents test cases    │
│  │Reviewer  │  │  Writer  │                                 │
│  └──────────┘  └──────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```
## Quick Start

### In VS Code (Local)
1. Create a new repo using **"Use this template"** on GitHub (see [Template Inheritance](#template-inheritance)), then clone it locally
2. Open VS Code with GitHub Copilot Chat installed
3. Open Copilot Chat and select an agent from the agent picker:
   - `@architect` — **Start here for new projects.** Designs system architecture through iterative discussion
   - `@backend-lead` — Plans and delegates backend work
   - `@frontend-lead` — Plans and delegates frontend/UI work
   - `@infra-lead` — Plans and delegates infrastructure/DevOps work
   - `@code-reviewer` — Reviews code changes on a branch
4. Or use a slash command:
   - `/design-architecture` — Iteratively design a system architecture for a new project
   - `/plan-sprint` — Break a feature into assigned workstreams
   - `/implement-feature` — Direct a lead to implement something
   - `/run-tests` — Run tests on a branch
   - `/review-and-merge` — Get a code review

### In GitHub Codespaces (Parallel Agents)
1. Create a new repo using **"Use this template"** on GitHub
2. Open **Code** → **Codespaces** → **Create codespace**
3. The devcontainer auto-installs Copilot and configures the environment
4. Open multiple Codespaces for parallel workstreams on different branches

## Agent Team

| Agent | Role | You invoke? | Tools |
|-------|------|:-----------:|-------|
| `@architect` | Interviews you, designs system architecture, decomposes into workstream briefs | Yes | Read, search, web, todo, askQuestions + lead subagents |
| `@backend-lead` | Plans backend work, creates branches, delegates | Yes | All + subagents |
| `@frontend-lead` | Plans frontend work, creates branches, delegates | Yes | All + subagents |
| `@infra-lead` | Plans infra/DevOps work, delegates | Yes | All + subagents |
| `@test-lead` | Reads plans, produces test specifications for @tester (does NOT look at code) | Yes | Read, search, execute, web, todo, askQuestions |
| `@code-reviewer` | Reviews diffs, flags issues | Yes | Read-only |
| `@developer` | Writes code per spec (subagent only) | No | Read, edit, search, execute |
| `@tester` | Writes/runs tests (subagent only) | No | Read, edit, search, execute |
| `@docs-writer` | Writes documentation (subagent only) | No | Read, search, edit |

## Planning Workflow (Human-in-the-Loop)

### Recommended: Start with the Architect

For new projects, **start with `@architect`** rather than going directly to team leads.
The architect-first workflow ensures a coherent system design before any code is written.

> **Important: `.plans/` is architect-only.** Only `@architect` creates or edits files in `.plans/`.
> Team leads read plans from `.plans/project/` for context, but log their execution details in `.agent-logs/`.
> **Architect-first protocol:** All non-trivial changes must go through `@architect`
> (for design/planning) or the appropriate team lead (for scoped work). If you prompt Copilot
> directly without invoking an agent, it will remind you to route through the proper workflow.
> This ensures all changes are planned, tracked, and logged.

#### Architect Workflow
1. You describe your project/application to `@architect` (e.g., `@architect "I want to build a task management SaaS app"`)
2. The architect **interviews you** in iterative rounds — scope, users, tech preferences, scale, security
3. After each round, the architect summarizes what was learned and confirms with you
4. The architect produces a **System Architecture Document** covering all layers (frontend, backend, data, infra)
5. You **approve, revise, or reject** the architecture
6. The approved architecture is saved to `.plans/project/<date>-<time>-architecture-<name>.md`
7. The architect **determines your execution mode** — asks whether you're using local VS Code (sequential) or GitHub Codespaces (parallel), analyzes workstream dependencies, and produces a **Launch Plan** with execution waves
8. You **review and confirm the Launch Plan**
9. The architect **decomposes the architecture into mode-aware workstream task briefs** — each brief includes execution context (wave, parallel peers, prerequisites, sync points)
10. You choose:
    - **Manual delegation**: Copy-paste each task brief into a separate Copilot Chat session or Codespace, following the Launch Plan's wave order
    - **Automated delegation**: Tell the architect to invoke the team leads directly, respecting wave scheduling

#### Direct Team Lead Workflow (Skip Architect)

For smaller features or when you already know the architecture, you can go directly to team leads:

1. You describe a feature to a team lead (e.g., `@backend-lead "Add JWT authentication"`)
2. The lead reads the relevant `.plans/project/` file (if one exists) for architectural context
3. The lead analyzes the request and presents a **draft execution plan** with tasks, files, and branches
4. The lead asks you to **approve, modify, or reject** the plan
5. You iterate until the plan is right
6. The lead logs the approved execution details in `.agent-logs/` (NOT in `.plans/`)

### Execution Phase (Same for Both Workflows)
6. The lead creates a feature branch and delegates to subagents
7. Each subagent receives the **plan reference** so they understand context
8. After coding → testing → docs → review, the lead reports completion

#### Test Planning Workflow (Parallel with Development)

After the architect produces plans and leads present their execution plans:

1. You invoke `@test-lead` with the architecture plan and workstream execution plans
2. The test-lead reads ALL plans and produces test specifications for each workstream
3. Test specs are written to `.test-specs/project/` (one file per workstream)
4. When team leads reach Gate 3 (Testing), they use the test-lead's specs as PRIMARY input for `@tester`
5. This ensures tests are designed from requirements/plans, not just the implementation

> **Key principle**: Test-lead NEVER looks at implementation code. Tests are derived purely from the architectural plan and acceptance criteria. This catches implementation drift from the design.

### Referencing Plans and Architecture Documents
- All approved architectures and plans live in `.plans/project/` with date-timestamps
- Template plans (agent protocols, dashboard features) live in `.plans/template/`
- **Only `@architect` creates or edits files in `.plans/`** — all other agents treat `.plans/` as read-only
- Team leads log their approved execution details and session summaries in `.agent-logs/project/` (or `.agent-logs/template/` for template work)
- Architecture documents are prefixed with `architecture-` for easy identification
- Agent logs reference which plan/architecture they worked on
- You can share plan file paths when communicating with agents across sessions
- Team leads should reference the architecture document when making implementation decisions

## Repository Structure

```
.github/
├── agents/           # Agent role definitions
├── prompts/          # Slash command workflows
├── instructions/     # File-type coding standards
├── hooks/            # Safety gates (blocks dangerous commands)
├── workflows/        # CI/CD and template sync automation
└── copilot-instructions.md  # Project-wide standards
.devcontainer/
└── devcontainer.json # Codespaces environment
.agent-logs/          # Agent session logs (auto-generated)
├── template/         # Template infrastructure logs (synced from upstream)
└── project/          # Project-specific logs (protected from upstream sync)
.agent-events/        # Structured agent event logs (JSONL, auto-generated)
.test-specs/          # Test specifications from @test-lead (auto-generated)
├── template/         # Template test specs
└── project/          # Project-specific test specs (protected from upstream sync)
.plans/               # Approved plan documents (auto-generated)
├── template/         # Template infrastructure plans (synced from upstream)
└── project/          # Project-specific plans (protected from upstream sync)
dashboard/            # Agent Monitor Dashboard (web UI)
scripts/
├── sync-template.sh  # Bash sync script (Linux/macOS/Codespaces)
└── sync-template.ps1 # PowerShell sync script (Windows)
.gitattributes        # Merge strategies for template inheritance
```

## Orchestrator Runbook (What YOU Do)

You are the human orchestrator. Agents write code — you control architecture approval, planning approval, branching, merging, and phasing.

### Initial Setup (Once)

1. **Create your project repo** from the template:
   - On GitHub, navigate to your org's `agentic-vibe-coding` template repo
   - Click **"Use this template" → "Create a new repository"**
   - Choose your org, name the repo, and set visibility

2. **Clone and connect to the upstream template** for future updates:
   ```bash
   git clone https://github.com/YOUR_ORG/my-new-project.git
   cd my-new-project

   # Connect to template for ongoing updates (bash/macOS/Linux)
   ./scripts/sync-template.sh https://github.com/mobius-logic/agentic-vibe-coding.git

   # Or on Windows PowerShell
   .\scripts\sync-template.ps1 -TemplateUrl "https://github.com/mobius-logic/agentic-vibe-coding.git"
   ```

3. **Protect `main`** on GitHub: **Settings → Branches → Add rule → Require PR reviews**.

### Phase 0: Architecture Design (Recommended for New Projects)

| Step | You Do |
|------|--------|
| 1 | Open Copilot Chat and invoke `@architect` with your project description |
| 2 | Answer the architect's interview questions (scope, users, tech, scale, security) |
| 3 | Review the proposed **System Architecture Document** |
| 4 | Request changes or **approve** the architecture |
| 5 | Answer the architect's **execution mode question** (local VS Code = sequential, Codespaces = parallel, or constrained parallel with a slot count) |
| 6 | Review the **Launch Plan** — number of waves, Codespace count per wave, sync points |
| 7 | Review the **mode-aware workstream task briefs** the architect produces |
| 8 | Choose: copy-paste briefs to separate sessions/Codespaces following the Launch Plan, or tell the architect to delegate |

### Phase 1: Parallel Workstreams (e.g. Infra + Backend)

| Step | You Do |
|------|--------|
| 1 | Open **Codespace A** (or local VS Code) — invoke `@infra-lead` with the architect's task brief (or your own request) |
| 2 | **Review and approve the plan** the lead presents to you |
| 3 | Open **Codespace B** — invoke `@backend-lead` with the architect's task brief |
| 4 | **Review and approve the plan** |
| 5 | Wait for each agent to finish executing the approved plans |
| 6 | Review the output (skim files, check agent's completion summary) |
| 7 | Push the branches, create PRs on GitHub |
| 8 | Merge independent workstream first, then rebase and merge dependent ones |

**Pushing a branch after an agent finishes:**
```bash
git status
git log --oneline -5
git push origin feature/infra/project-setup
```

**Rebasing a dependent branch after merging its dependency:**
```bash
git fetch origin
git rebase origin/main
git push origin feature/backend/simulation-core --force-with-lease
```

### Phase 2: Dependent Workstream (e.g. Frontend)

| Step | You Do |
|------|--------|
| 1 | Ensure Phase 1 PRs are merged to `main` |
| 2 | Pull latest: `git checkout main && git pull` |
| 3 | Invoke `@frontend-lead` — **approve its plan** |
| 4 | Wait, review, push, create PR |

### Phase 3: Review + Final Merge

| Step | You Do |
|------|--------|
| 1 | Invoke `@code-reviewer` targeting the open PR branch |
| 2 | Review the agent's findings |
| 3 | If fixes needed: tell the relevant `@<lead>` to fix them |
| 4 | Once clean: merge the final PR on GitHub |

### Single-Machine Alternative (No Codespaces)

When the architect asks about your execution mode, choose **Sequential (Local VS Code)**. The architect will produce a Launch Plan with a linear execution order and workstream briefs that include `git pull origin main` reminders between steps.

Run agents sequentially in a single VS Code window:
```
@architect → interview → approve architecture → confirm sequential mode → review Launch Plan → get workstream briefs
@infra-lead → paste brief #1 → approve plan → wait → push → PR → merge → git pull
@backend-lead → paste brief #2 → approve plan → wait → push → PR → merge → git pull
@frontend-lead → paste brief #3 → approve plan → wait → push → PR → merge → git pull
@code-reviewer → review
```

The Launch Plan's "Sequential Fallback Order" section gives you the exact sequence to follow.

## Decision Cheat Sheet

| Situation | What to do |
|-----------|-----------|
| Starting a new project | Use `@architect` to design the architecture first |
| Architect presents architecture | Review carefully, ask questions, then approve |
| Architect asks about execution mode | Answer: local VS Code (sequential), Codespaces (parallel), or constrained parallel with slot count |
| Architect presents Launch Plan | Review wave structure, Codespace count, sync points, then confirm |
| Architect produces workstream briefs | Follow the Launch Plan — open Codespaces per wave (parallel) or run leads in order (sequential) |
| Leads present execution plans | Invoke `@test-lead` with the architecture plan and workstream plans — it produces test specs in parallel with development |
| Agent presents a plan | Review it carefully, suggest changes, then approve |
| Agent says "done" | Check `git log`, skim files, then `git push origin <branch>` |
| Agent made a mistake | Tell it what's wrong in the same chat session |
| Tests fail | Tell the agent "tests are failing, fix them" |
| Agent asks a question | Answer it — you're the product owner |
| Need to reference prior work | Check `.plans/project/` for architecture docs and approved plans, `.agent-logs/project/` for session logs |
| Merge conflict | `git fetch origin && git rebase origin/main` on the conflicting branch |
| Agent's work log is wrong | Check `.agent-logs/project/` (or `.agent-logs/template/`) for the agent's memory file |

## Agent Memory Logs

Each agent writes a dated summary log to `.agent-logs/<project|template>/<agent-name>-log.md` tracking:
- Plan reference (which `.plans/project/` file they worked on)
- Tasks completed with timestamps
- Files created/modified
- Fixes applied and lessons learned
- Git commit IDs for traceability
- Subagents invoked (for team leads)

Logs are ordered **oldest on top, newest at bottom**. They persist across sessions so agents can review their prior work and avoid repeating mistakes.

## Plans Directory

Approved plans are saved to `.plans/` with date-timestamped filenames:
```
.plans/
├── template/
│   └── 2026-04-09-180237-strict-delegation-protocol.md
├── project/
│   ├── 2026-04-08-143022-architecture-task-app.md
│   └── 2026-04-08-143022-launch-plan-task-app.md
└── README.md
```

- **`template/`** contains plans for the template itself (synced from upstream)
- **`project/`** contains project-specific plans (protected from upstream sync via `merge=ours`)

## Agent Monitor Dashboard

An optional web-based dashboard that gives you real-time visibility into agent activity — which agents are active, what branches they're working on, task progress, and a live event timeline.

### Quick Start

```bash
# From your project root
node dashboard/start.js

# Or open the browser automatically
node dashboard/start.js --open

# Custom port
node dashboard/start.js --port 8080
```

The dashboard opens at **http://127.0.0.1:4820** and auto-refreshes every 3 seconds.

### What It Shows

| Panel | Description |
|-------|-------------|
| **Summary Bar** | Active agent count, branch count, task completion, event count |
| **Agent Cards** | Each agent with status (active/working/completed/idle), current branch, task progress bar |
| **Branch Status** | All feature/fix branches with their status, last commit, and date |
| **Plans** | Plans from `.plans/` (template + project) with task completion progress |
| **Event Timeline** | Chronological feed of all agent events |

### How It Works

The dashboard reads data from three sources — all already part of the template:

1. **`.agent-logs/**/*.md`** — Human-readable session logs (existing, now in template/ and project/ subdirs)
2. **`.plans/**/*.md`** — Approved plan documents (existing, now in template/ and project/ subdirs)
3. **Git branches** — Local and remote branch data (existing)
4. **`.agent-events/events.jsonl`** — Structured machine-readable events (new, optional)

The dashboard **works without any events being emitted** — it still shows git branches, plans, and agent logs. The event stream adds richer real-time data.

### Agent Event Format

Agents can optionally write structured events to `.agent-events/events.jsonl` (one JSON object per line):

```json
{
  "ts": "2026-04-09T14:30:22Z",
  "agent": "backend-lead",
  "event": "task-completed",
  "branch": "feature/backend/auth",
  "plan": ".plans/project/2026-04-09-auth.md",
  "task": "Implement JWT middleware",
  "taskIndex": 1,
  "taskTotal": 5,
  "status": "in-progress"
}
```

**Event types**: `spawned`, `plan-loaded`, `task-started`, `task-completed`, `branch-created`, `branch-pushed`, `subagent-invoked`, `session-complete`, `error`

### Programmatic Event Logging

For agents or scripts running in a Node.js context:

```javascript
const { logAgentEvent } = require('./dashboard/lib/log-event.js');

logAgentEvent({
  agent: 'backend-lead',
  event: 'task-completed',
  branch: 'feature/backend/auth',
  task: 'Implement JWT middleware',
  taskIndex: 1,
  taskTotal: 5,
});
```

### Dashboard Architecture

```
Browser (localhost:4820)
  ↕  polling GET /api/*
Dashboard Server (Node.js, zero dependencies)
  ↕  reads
.agent-logs/  .plans/  .agent-events/  git branches
```

The server is a zero-dependency Node.js HTTP application. No npm install required.

### Dashboard REST API

The dashboard server exposes the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | Returns array of agents with status (event-based, enriched with filesystem inference) |
| `/api/branches` | GET | Returns current branch and all branches |
| `/api/plans` | GET | Returns array of parsed plan documents |
| `/api/events` | GET | Returns recent events (supports `?limit=N` query param) |
| `/api/logs` | GET | Returns all agent logs |
| `/api/logs/:agent` | GET | Returns a specific agent's log |
| `/api/activity` | GET | Returns filesystem activity snapshot (5s TTL cache) |
| `/api/summary` | GET | Returns aggregate dashboard summary |
| `/api/graph` | GET | Returns `{ nodes, edges }` agent relationship graph |
| `/api/stream` | GET | Server-Sent Events (SSE) stream for real-time event push |

### Agent Event Types

Agents emit structured events via `dashboard/lib/emit-event.js`. The following event types are recognized:

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `spawned` | Agent session started (resets prior state, prunes completed agents from graph) | — |
| `session-start` | Architect-only: resets all dashboard state and starts a fresh session | `--plan` |
| `task-started` | Agent began a task | `--task`, `--taskIndex`, `--taskTotal` |
| `task-completed` | Agent finished a task | `--task`, `--status` |
| `session-complete` | Agent session ended | `--status` |
| `branch-created` | Agent created a git branch | `--branch` |
| `question-asked` | Agent asked the user a question | `--detail` |
| `heartbeat` | Signal that an agent is alive and describe current activity | `--detail`, `--phase` |

#### Heartbeat Events

Agents emit `heartbeat` events periodically (every 15–30s) while actively working. This lets dashboard-only users see real-time activity. Agents with no heartbeat for 60 seconds are downgraded from "working" to "active" status.

The `--phase` argument describes what the agent is currently doing:

| Phase | Meaning |
|-------|---------|
| `thinking` | Reasoning / planning |
| `coding` | Writing or editing code |
| `searching` | Reading files / searching codebase |
| `reviewing` | Reviewing code or docs |
| `waiting` | Waiting for subagent or user |
| `delegating` | Delegating work to a subagent |

#### Workstream Grouping

When multiple agents work in parallel (e.g. `backend-lead` and `frontend-lead` in separate Codespaces), the dashboard groups them into **workstreams**. Pass `--workstream <name>` on any event to explicitly set the workstream, or it will be inferred from the agent's position in the delegation graph.

#### emit-event.js CLI Usage

```
node dashboard/lib/emit-event.js <agent> <event> [options]
```

**Options:**

| Argument | Description |
|----------|-------------|
| `--task` | Task description |
| `--taskIndex` | Current task number (integer) |
| `--taskTotal` | Total tasks (integer) |
| `--branch` | Branch name |
| `--plan` | Plan file path |
| `--status` | Status string (e.g. `done`) |
| `--detail` | Human-readable detail (used by `heartbeat` and `question-asked`) |
| `--phase` | Agent activity phase (`thinking`, `coding`, `searching`, `reviewing`, `waiting`, `delegating`) |
| `--workstream` | Workstream label for parallel workflow grouping |

**Examples:**

```bash
# Agent spawned (resets previous session state)
node dashboard/lib/emit-event.js architect spawned

# Heartbeat with phase
node dashboard/lib/emit-event.js backend-lead heartbeat --detail "Implementing auth module" --phase coding

# Task started in a named workstream
node dashboard/lib/emit-event.js backend-lead task-started --task "Implement auth" --workstream backend
```

### Backward Compatibility

- The dashboard is **purely additive** — no existing files change behavior
- Existing projects without `dashboard/` are unaffected
- The dashboard handles missing `.agent-events/` gracefully
- Agent event logging is **optional** — agents still write their markdown logs as before
- `.agent-events/` is protected by `.gitattributes` (`merge=ours`) during template sync

## Customization

- Edit `.github/agents/*.agent.md` to tune agent behavior for your tech stack
- Edit `.github/copilot-instructions.md` for your project's conventions
- Add `.github/instructions/*.instructions.md` for language/framework-specific rules
- See [AGENTIC-TEAM-SETUP-GUIDE.md](AGENTIC-TEAM-SETUP-GUIDE.md) for the full setup guide

## Adapting This Template for Your Project

1. Use **"Use this template"** on GitHub to create a new repo (see [Template Inheritance](#template-inheritance) below)
2. Update `README.md` with **your** project's name, description, and usage instructions
3. Keep `TEMPLATE-GUIDE.md` as a reference for how the agentic workflow operates
4. Customize agent definitions in `.github/agents/` for your tech stack
5. Start invoking agents — they will update `README.md` with project-specific docs as they build

---

## Template Inheritance

This repo is designed to be a **living template**: child projects created from it can
continuously pull in improvements to agents, hooks, prompts, and tooling — without
overwriting their project-specific plans, logs, or documentation.

### How It Works

```
┌──────────────────────────────┐
│   Template Repo (upstream)   │  ← Org maintains agents, 
|                              |     hooks, prompts
│  github.com/mobius-logic/    │
│       agentic-vibe-coding    │
└──────────┬───────────────────┘
           │  one-way sync (pull only)
           ▼
┌──────────────────────────────┐
│   Child Project Repo         │  ← Team's project code + 
|                              |      plans + logs
│  github.com/ORG/my-project   │
└──────────────────────────────┘
```

| What syncs (from template) | What is protected / removed (project-specific) |
|---|---|
| `.github/agents/` | `.plans/project/` (protected) |
| `.github/hooks/` | `.agent-logs/project/` (protected) |
| `.github/prompts/` | `.agent-events/` (protected) |
| `.github/instructions/` | `README.md` (protected) |
| `.github/copilot-instructions.md` | All project source code (protected) |
| `.devcontainer/` | `.plans/template/` (removed after sync) |
| `dashboard/` | `.agent-logs/template/` (removed after sync) |
| `TEMPLATE-GUIDE.md` | |
| `scripts/` | |

> **Template context isolation**: Template plans and logs (`.plans/template/`, `.agent-logs/template/`) are automatically removed from project repos during sync. This ensures project agents only see project-specific context — the same way the template repo only sees template context. The sync scripts handle this in step 6.

### One-Time Setup (Org Admin)

1. **Mark this repo as a GitHub Template**:
   - Go to **Settings → General** on the template repo
   - Check **"Template repository"**
   - This enables the **"Use this template"** button for your org

2. **Set repo visibility** to Internal (org-wide) or Public as needed

### Creating a New Project from the Template

1. On GitHub, navigate to the template repo
2. Click **"Use this template" → "Create a new repository"**
3. Choose your org, name the repo, set visibility
4. Clone the new repo locally

> **Why "Use this template" instead of Fork?**
> Template repos create a **clean copy** with no fork relationship — no accidental
> PRs back to the template, clean commit history, and the child repo is fully independent.

### Connecting to the Upstream Template

After creating from the template, connect the child repo so it can pull future updates:

**Bash / Git Bash / macOS / Linux / Codespaces:**
```bash
# First run — supply the template URL
./scripts/sync-template.sh https://github.com/mobius-logic/agentic-vibe-coding.git

# Subsequent runs — URL is remembered
./scripts/sync-template.sh
```

**PowerShell (Windows):**
```powershell
# First run — supply the template URL
.\scripts\sync-template.ps1 -TemplateUrl "https://github.com/mobius-logic/agentic-vibe-coding.git"

# Subsequent runs — URL is remembered
.\scripts\sync-template.ps1
```

The sync script:
1. Adds or verifies the `upstream` remote
2. Configures the `ours` merge driver to protect project-specific files
3. Fetches and merges the latest template changes
4. Leaves `.plans/project/`, `.agent-logs/project/`, and `README.md` untouched
5. Removes `.plans/template/` and `.agent-logs/template/` content that came through the merge (template context should only exist in the template repo)

> **Codespace note:** Both scripts auto-detect GitHub Codespaces and verify
> access to the upstream template repo before fetching. The default Codespace
> `GITHUB_TOKEN` is scoped to the current repo only — it cannot access the
> upstream template. The scripts configure `gh` as the Git credential helper and
> test API access. If access fails, you will see a clear error message directing
> you to run `gh auth login` to authenticate with your full GitHub account.

### Automated Sync via GitHub Actions (Optional)

For hands-off updates, enable the included workflow in your child repo:

1. Edit `.github/workflows/sync-template.yml`
2. Set the `TEMPLATE_REPO` variable to your org's template URL:
   ```yaml
   env:
     TEMPLATE_REPO: "https://github.com/mobius-logic/agentic-vibe-coding.git"
   ```
3. The workflow runs **weekly on Mondays at 09:00 UTC** (configurable via cron)
4. When updates are found, it creates a **pull request** for your team to review
5. You can also trigger it manually via **Actions → Sync Template Updates → Run workflow**

The PR includes a checklist and shows exactly what changed. Project-specific files
are automatically protected.

### How File Protection Works

The `.gitattributes` file uses Git's merge driver system to protect project-specific
paths and isolate template context:

```gitattributes
# Protect project-specific content during sync
.plans/project/**        merge=ours
.agent-logs/project/**   merge=ours
README.md                merge=ours

# Isolate template context (sync scripts remove new files in step 6)
.plans/template/**       merge=ours
.agent-logs/template/**  merge=ours
```

When `merge=ours` is configured (`git config merge.ours.driver true` — the sync scripts
do this automatically), Git keeps **your local version** of these paths during any merge
from upstream, even if the template has different content in those paths.

### Workflow Summary

```
Org Admin (once):
  Template repo → Settings → ✅ Template repository

New Project:
  "Use this template" → clone → ./scripts/sync-template.sh <URL>

Ongoing Updates (choose one):
  Manual:    ./scripts/sync-template.sh
  Automated: GitHub Actions creates PRs weekly
```

### FAQ

**Q: What if I customized an agent file and the template also changed it?**
A: You'll get a normal merge conflict. Git will show both versions and you choose
which changes to keep. The sync script warns you when this happens.

**Q: Can a child repo push changes back to the template?**
A: No. The `upstream` remote is read-only by design (created via HTTPS clone URL).
There is no fork relationship, so GitHub won't suggest PRs back to the template.

**Q: What if I never want automated syncing?**
A: Delete `.github/workflows/sync-template.yml` from your child repo. You can always
run the sync script manually when you want updates.

**Q: Can I sync only specific paths (e.g., just agents)?**
A: The merge-based approach syncs everything the template changed. If you need more
granular control, you can `git merge --no-commit` then selectively `git checkout HEAD -- <path>`
to revert specific files before committing.

