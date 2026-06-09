# Agent Memory Logs

This directory contains session logs written by each agent. Agents append to their log file
at the end of every session to track completed tasks, fixes, commit IDs, plan references,
and lessons learned.

> **Team leads log their approved execution details here**, not in `.plans/`.
> Only `@architect` writes to `.plans/`. All other agents write session logs here.

## Directory Structure

Logs are separated into two subdirectories:

```
.agent-logs/
├── README.md              ← this file
├── template/              ← logs from template infrastructure work (synced from upstream)
│   └── <agent>-log.md
└── project/               ← logs from project feature work (protected from upstream sync)
    └── <agent>-log.md
```

| Directory | Purpose | Synced from upstream? | Protected by `merge=ours`? |
|-----------|---------|----------------------|---------------------------|
| `template/` | Logs from agents working on the template itself (dashboard, agents, protocols) | **Template repo only** — removed from project repos during sync | Yes (merge=ours + sync cleanup) |
| `project/` | Logs from agents working on the project built with this template | **No** — never overwritten by template sync | **Yes** |

### Which directory to use?

- If you are working on a **project feature** (architecture from `.plans/project/`) → write to `.agent-logs/project/`
- If you are working on **template infrastructure** (plans from `.plans/template/`) → write to `.agent-logs/template/`
- Default to `.agent-logs/project/` when unsure

## Log Ordering

Entries are ordered **oldest on top, newest at bottom** (chronological append-only).
Agents must never overwrite, delete, or reorder previous entries.

## Log Format

Each entry includes:
- **Timestamp**: Full `YYYY-MM-DD HH:MM:SS` date-time
- **Plan reference**: Path to the `.plans/project/` file being worked on (or "N/A")
- **Branch**: The git branch
- **Commit**: Short commit hash
- **Tasks/files/fixes**: What was done
- **Subagents invoked** (for team leads): Which subagents were called
- **Lessons learned**: Patterns to follow or avoid

## Files

Each subdirectory (`template/` or `project/`) contains the same set of agent log files:

| File | Agent |
|------|-------|
| `architect-log.md` | Architect |
| `backend-lead-log.md` | Backend Team Lead |
| `frontend-lead-log.md` | Frontend Team Lead |
| `infra-lead-log.md` | Infrastructure Team Lead |
| `developer-log.md` | Developer (subagent) |
| `tester-log.md` | Tester (subagent) |
| `code-reviewer-log.md` | Code Reviewer |
| `docs-writer-log.md` | Documentation Writer |

These files are committed to the repo so agents can read their history in future sessions.
