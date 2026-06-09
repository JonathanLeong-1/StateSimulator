# Test Specifications

This directory contains test specifications produced by the `@test-lead` agent.

Test specifications are generated from architecture and execution plans — NOT from implementation code.
They define what should be tested (test cases, acceptance criteria, edge cases) before code is written.

## Structure

- **`project/`** — Test specs for project features (protected from upstream sync via `merge=ours`)
- **`template/`** — Test specs for template features

## File Naming Convention

```
<YYYY-MM-DD>-<workstream>-test-spec.md
```

Example: `2026-05-05-backend-test-spec.md`

## Who Writes Here

Only `@test-lead` creates or edits files in this directory.
Team leads READ test specs from here when delegating to `@tester` at Gate 3.
