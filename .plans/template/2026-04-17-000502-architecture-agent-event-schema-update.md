# Architecture: Agent Dashboard Event Schema Update

- **Date**: 2026-04-17 00:05:02
- **Architect**: architect
- **Status**: approved

## Project Summary

Update all 8 agent definition files (.github/agents/*.agent.md) and copilot-instructions.md to emit Dashboard v2 event types. This enables the new dashboard features: spawn graph with parent links, thinking chains, todo list tracking, and session isolation.

## Architecture Style

Configuration/documentation change — modifying agent prompt definitions only. No application code changes.

## Scope

### Files to Modify (9 total)
1. `.github/agents/architect.agent.md`
2. `.github/agents/backend-lead.agent.md`
3. `.github/agents/frontend-lead.agent.md`
4. `.github/agents/infra-lead.agent.md`
5. `.github/agents/developer.agent.md`
6. `.github/agents/tester.agent.md`
7. `.github/agents/docs-writer.agent.md`
8. `.github/agents/code-reviewer.agent.md`
9. `.github/copilot-instructions.md`

### New Event Types to Add

| Event Type | CLI Command | Who Emits | When |
|------------|-------------|-----------|------|
| `session-start` | `node dashboard/lib/emit-event.js architect session-start --plan ".plans/<file>.md"` | architect only | FIRST command of a new user request, before `spawned` |
| `spawned --parent` | `node dashboard/lib/emit-event.js <agent> spawned --parent "<parent-agent>"` | all agents | When starting; parent is the invoking agent ("" for architect) |
| `thinking` | `node dashboard/lib/emit-event.js <agent> thinking --detail "<brief summary>"` | all agents | At major reasoning milestones (not every thought) |
| `todo-update` | `node dashboard/lib/emit-event.js <agent> todo-update --todos '<JSON array>'` | agents using manage_todo_list | After each todo list update |

### Changes Per Agent

#### architect.agent.md
- **Add**: `session-start` as the very first emission (before `spawned`), with `--plan` once architecture plan is known
- **Update**: `spawned` → `spawned --parent ""`
- **Add**: `thinking --detail "..."` guidance at key milestones (after each discovery round, when starting design, when analyzing dependencies)
- **Add**: `todo-update` guidance when architect uses manage_todo_list

#### backend-lead.agent.md, frontend-lead.agent.md, infra-lead.agent.md
- **Update**: `spawned` → `spawned --parent "architect"` (or parent from handshake payload)
- **Add**: `thinking --detail "..."` guidance (when planning execution, analyzing plan, preparing delegation)
- **Add**: `todo-update --todos '[...]'` guidance (when tracking gate checklist progress)

#### developer.agent.md
- **Update**: `spawned` → `spawned --parent "<lead-agent>"` (from delegation payload)
- **Add**: `thinking --detail "..."` guidance (when analyzing task, making implementation decisions)

#### tester.agent.md
- **Update**: `spawned` → `spawned --parent "<lead-agent>"` (from delegation payload)
- **Add**: `thinking --detail "..."` guidance (when planning test strategy)

#### docs-writer.agent.md
- **Update**: `spawned` → `spawned --parent "<lead-agent>"` (from delegation payload)
- **Add**: `thinking --detail "..."` guidance (when analyzing what needs documenting)

#### code-reviewer.agent.md
- **Add entire events section** (currently has none):
  - `spawned --parent "<lead-agent>"`
  - `task-started --task "Reviewing <branch>"`
  - `thinking --detail "..."` (when analyzing code patterns)
  - `task-completed --task "Review complete"`
  - `session-complete --status done`

#### copilot-instructions.md
- **Add**: Reference section documenting Dashboard v2 event types under Agent Monitor Dashboard section
- **Add**: Note that `session-start` should only be emitted by the architect agent

## Design Decisions

1. **session-start only from architect**: Architect is the session root. This event triggers dashboard data wipe.
2. **Parent from delegation payload**: Subagents extract parent from the lead's delegation. Leads extract parent from the architect's handshake. Falls back to "architect" for leads.
3. **thinking kept lightweight**: Brief one-line summaries at major milestones only. Over-emission would clutter the dashboard.
4. **todo-update mirrors manage_todo_list**: Each manage_todo_list call should be followed by a todo-update emission.
5. **code-reviewer gets full event section**: Parity with other subagents; previously had zero instrumentation.

## Testing Strategy

- No unit tests needed (these are markdown prompt files)
- Validation: grep all agent files to confirm new event types are present
- Manual validation: run a sample workflow and verify dashboard shows spawn graph, thinking, todos

## Approval
- Approved by: human user
- Approved at: 2026-04-17 00:05:02
