# Approved Plans

This directory stores **approved architecture and plan documents** created exclusively by the `@architect` agent after human approval.

> **Only `@architect` may create or edit files in this directory.** Team leads and all other agents
> treat `.plans/` as **read-only**. Team leads log their execution details in `.agent-logs/project/` (or `.agent-logs/template/`) instead.

## Directory Structure

Plans are separated into two subdirectories:

```
.plans/
├── README.md              ← this file
├── template/              ← plans for the template itself (synced from upstream)
│   ├── README.md
│   └── <template-plan>.md
└── project/               ← plans for your project (protected from upstream sync)
    ├── README.md
    └── <project-plan>.md
```

| Directory | Purpose | Synced from upstream? | Protected by `merge=ours`? |
|-----------|---------|----------------------|---------------------------|
| `template/` | Plans for the agentic-vibe-coding template infrastructure (dashboard, agents, protocols) | **Template repo only** — removed from project repos during sync | Yes (merge=ours + sync cleanup) |
| `project/` | Architecture and launch plans for the project built with this template | **No** — never overwritten by template sync | **Yes** |

### Why the separation?

**Template context isolation**: Template plans exist only in the template repo. Project repos
only contain `.plans/project/`. This prevents template context from confusing project agents,
just as project plans don't exist in the template repo to confuse template agents. The sync
scripts automatically remove any template content that comes through during a merge.

## Naming Convention

Files are named with a date-timestamp and short description:
```
<YYYY-MM-DD>-<HHMMSS>-<short-name>.md
```

Examples:
- `template/2026-04-09-180237-strict-delegation-protocol.md`
- `project/2026-04-08-143022-architecture-task-app.md`
- `project/2026-04-08-143022-launch-plan-task-app.md`

## How Plans Are Created

1. A human user invokes `@architect` to design or plan a change
2. The architect reads ALL existing plans in `project/` to refresh context
3. The architect interviews the human and produces an architecture/plan document
4. The human reviews and approves (or requests changes)
5. The approved plan is saved to `project/` with a date-timestamp
6. Team leads read the relevant plan to understand scope and context
7. All subagents receive the plan file path as a reference during execution

## How Plans Are Referenced

- Agent memory logs in `.agent-logs/<project|template>/` include a **Plan** field linking to the relevant plan file
- When communicating with agents about ongoing work, share the plan file path for context
- Plans are never modified after approval — they serve as an immutable record

## Reproducibility

Architecture and launch plan documents are designed as **reproducible blueprints**. Each plan
contains detailed delegation payloads, interface contracts, naming conventions, expected outputs,
and test specifications — so that invoking `@architect` for the same feature produces near-identical
workstream briefs and delegation commands every time.

When `@architect` is invoked, it:
1. Reads all existing plans in `project/` to build context
2. Checks if the requested feature matches an existing plan
3. If a match is found, reuses the existing plan as a blueprint
4. Produces delegation payloads that are deterministic given the same plan inputs
