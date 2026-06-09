# Project Plans

This directory contains plans for the **project** built using the agentic-vibe-coding template.

> These plans are **protected from upstream sync** via `merge=ours` in `.gitattributes`.
> Template updates will never overwrite project-specific plans.

## What Belongs Here

- Architecture documents for your application (produced by `@architect`)
- Launch plans for project features
- Any project-specific design decisions

## What Does NOT Belong Here

- Template infrastructure plans → those live in `.plans/template/`
- Agent logs or execution details → those go in `.agent-logs/project/`

## Naming Convention

Files are named with a date-timestamp and short description:
```
<YYYY-MM-DD>-<HHMMSS>-architecture-<project-name>.md
<YYYY-MM-DD>-<HHMMSS>-launch-plan-<project-name>.md
```

## Reproducibility

Architecture and launch plan documents in this directory are designed to be **reproducible
blueprints**. Each plan contains enough detail (delegation payloads, interface contracts,
naming conventions, expected outputs) that invoking `@architect` for the same feature will
produce near-identical workstream briefs and delegation commands every time.

When `@architect` is invoked, it reads ALL plans in this directory first to:
1. Refresh its memory of what has been built before
2. Check if the requested feature already has an existing plan
3. Reuse the existing plan as a blueprint if one matches
