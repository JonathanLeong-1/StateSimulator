# Architecture: Template Workflow Enhancements — Modular Bias, Test Lead, Docs Update

- **Date**: 2026-05-05 14:43:07
- **Architect**: architect
- **Status**: approved
- **Feature Fingerprint**: template-workflow-modular-test-lead

## Feature Fingerprint

- **Canonical Name**: `template-workflow-modular-test-lead`
- **Aliases**: modular architecture bias, test team lead, test-lead agent, docs test documentation
- **Category**: template infrastructure

## Project Summary

Three fundamental changes to the multi-agent template workflow:
1. Architect always prefers modular/microservice architecture (stateless, API-connected, independently deployable components)
2. New `@test-lead` cross-cutting agent that generates test specifications from plans (not code), running parallel to development
3. `@docs-writer` expanded to document test cases from test-lead

## Architecture Style

Template infrastructure change — modifies agent behavior definitions, gated workflow, and documentation.

## Change 1: Architect Modular Architecture Bias

### Design Principle

The architect agent MUST prefer modular decomposition as its default architecture style:
- **Stateless components**: Each module/service is stateless unless it is a data/storage component
- **Independent deployment**: Each component can run irrespective of other components
- **Stable interfaces**: Components communicate via well-defined APIs (REST, gRPC, message queues, events)
- **Single responsibility**: Each module handles one bounded context

### Exception Criteria

The architect MAY deviate from modular architecture ONLY when:
- The project is trivially simple (e.g., a single CLI utility with < 3 commands)
- The human explicitly requests a monolithic approach
- The architect MUST document the justification in the architecture document when deviating

### Implementation

Add to `architect.agent.md` Phase 2 a new section "Architecture Style Selection" with these rules:
```
## Modular Architecture Bias (MANDATORY)

When designing systems, you MUST default to modular/microservice architecture:

1. **Decompose into independent modules** — each module handles one bounded context
2. **Stateless by default** — modules must not hold state between requests (except data/storage layers)
3. **API-first interfaces** — all inter-module communication via stable APIs (REST, gRPC, events, message queues)
4. **Independent deployability** — each module can be deployed, scaled, and updated independently
5. **Failure isolation** — one module failing should not cascade to others

### When to Deviate

You may propose a monolithic or simpler architecture ONLY if:
- The project has fewer than 3 components/features AND is a simple utility (e.g., CLI tool)
- The human explicitly requests monolithic design
- You MUST justify any non-modular choice in the architecture document under "Architecture Style Justification"

### Modular Architecture Checklist

For EVERY component in your design, verify:
- [ ] Stateless? (or justified as a data/storage component)
- [ ] Has a defined API interface? (REST endpoint, gRPC service, event schema, etc.)
- [ ] Can run independently? (has its own entry point, can be tested in isolation)
- [ ] Single responsibility? (handles one bounded context)
- [ ] Failure-isolated? (one component crashing doesn't take down others)
```

## Change 2: Test Lead Agent (`@test-lead`)

### Role Definition

The `@test-lead` is a **cross-cutting lead agent** that owns test planning. It:
- Reads the architecture plan and all workstream execution plans
- Produces test specifications (test plans, test cases, acceptance criteria) based PURELY on the plans
- Does NOT look at implementation code
- Runs in PARALLEL with Gate 2 (development) — invoked as soon as leads present execution plans
- Writes test specs to `.test-specs/project/` (or `.test-specs/template/`)

### Invocation Timing

```
Architect saves plan
    ↓
Leads read plans → Present execution plans → Human approves
    ↓ (simultaneously)
    ├── Leads start Gate 1-2 (branch creation + development)
    └── Test-lead invoked → reads plans → produces test specs
        ↓
    Gate 2 completes → Lead reads test-lead specs → Passes to @tester at Gate 3
```

The human (or architect during automated delegation) invokes `@test-lead` with:
- Architecture plan reference
- All workstream execution plans
- The test-lead produces specs for ALL workstreams in one session

### Test Specification Output Format

Test-lead writes to `.test-specs/project/<date>-<workstream>-test-spec.md`:
```
# Test Specification: <Workstream>
- **Date**: <timestamp>
- **Architecture Plan**: <path>
- **Workstream Plan**: <path>
- **Test Lead**: test-lead

## Unit Tests

### Module: <module-name>
| Test Case | Input | Expected Output | Type |
|-----------|-------|-----------------|------|
| <case>    | <in>  | <out>           | unit |

## Integration Tests

### Interface: <api-endpoint-or-contract>
| Test Case | Setup | Action | Expected | Type |
|-----------|-------|--------|----------|------|
| <case>    | <setup> | <action> | <expected> | integration |

## Edge Cases & Error Scenarios

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| <case>    | <scenario> | <behavior>      |

## Acceptance Criteria Verification

| Acceptance Criterion (from plan) | Test Case(s) |
|----------------------------------|--------------|
| <criterion>                      | <test refs>  |
```

### Tool Permissions

| Agent | `edit` Tool | `execute` Scope | File Permissions |
|-------|------------|-----------------|------------------|
| `@test-lead` | ❌ No | git read, dashboard events, own log, `.test-specs/` file creation | `.test-specs/` and own session log only |

The test-lead writes test specs via terminal commands (like how the architect writes `.plans/`).

### Agent Configuration

```yaml
---
description: "Use when: planning tests, creating test specifications, designing test strategy, test planning. Test team lead, QA planning, test architecture."
tools: [read, search, execute, web, todo, askQuestions]
agents: []
user-invocable: true
---
```

The test-lead is user-invocable (the human invokes it after leads present their plans).

### Dashboard Events

The test-lead emits events with `--workstream testing`:
- `spawned --parent "architect"` or `--parent ""`
- `thinking --detail "..."`
- `task-started --task "Producing test specs for <workstream>"`
- `task-completed --task "Test specs written for <workstream>"`
- `session-complete --status done`

### Per-Workstream Event File

| Workstream | Event File |
|------------|------------|
| `testing` | `.agent-events/events-testing.jsonl` |

## Change 3: Docs Writer Test Documentation

### Expanded Responsibilities

The `@docs-writer` receives an additional field in its Delegation Payload:
- **Test Specs Reference**: Path to `.test-specs/project/<file>.md`

When present, docs-writer MUST include a "Test Plan" section in documentation covering:
- Summary of test strategy (from test-lead's spec)
- Key test scenarios (unit, integration, edge cases)
- How to run the tests
- Test coverage expectations

### Updated Delegation Payload for @docs-writer

```
## Delegation Payload
- **Plan Reference**: <path to .plans/ file>
- **Branch**: <current feature branch name>
- **Lead Agent**: <which lead>
- **Workstream**: <workstream>
- **Task**: Update docs for <features>
- **Acceptance Criteria**: README.md updated, test plan documented
- **Files to Create/Modify**: README.md, docs/testing.md (if complex)
- **Test Specs Reference**: .test-specs/project/<file>.md  ← NEW
- **Context**: <what was added/changed>
```

## Updated Gated Workflow

### Modified Gate Sequence

```
GATE 0: PLAN APPROVAL (unchanged)
  └── Human approves execution plan

GATE 1: BRANCH CREATION (unchanged)
  └── Lead creates feature branch

GATE 2: IMPLEMENTATION (unchanged — runs in parallel with test-lead)
  └── Lead invokes @developer
  └── PARALLEL: Test-lead produces test specs (if not already done)

GATE 2.5 (NEW): TEST SPEC READINESS
  └── Lead verifies test-lead specs exist at .test-specs/project/<file>.md
  └── If specs not ready: wait or proceed with developer's suggested tests as fallback
  └── Gate condition: Test spec file exists for this workstream

GATE 3: TESTING (MODIFIED)
  └── Lead invokes @tester with DELEGATION PAYLOAD
  └── Payload includes test-lead's spec as PRIMARY test guidance
  └── Developer's "Suggested Tests" are SECONDARY/supplementary
  └── Gate condition: Tester verdict "ALL PASS"

GATE 4: CODE REVIEW (unchanged)
GATE 5: DOCUMENTATION (MODIFIED)
  └── Delegation payload now includes Test Specs Reference
  └── Docs-writer documents test plan in addition to features

GATE 6: PRE-COMMIT CHECKLIST (MODIFIED)
  └── Added: [ ] Test specs exist from @test-lead
  └── Added: [ ] Test documentation included by @docs-writer

GATE 7: COMMIT & REPORT (unchanged)
```

## New Directory Structure

```
.test-specs/
├── project/       # Test specs for project features
├── template/      # Test specs for template features  
└── README.md
```

Protected from upstream sync via `.gitattributes` (`merge=ours` on `.test-specs/project/`).

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `.github/agents/test-lead.agent.md` | CREATE | New test-lead agent definition |
| `.github/agents/architect.agent.md` | MODIFY | Add modular architecture bias section |
| `.github/agents/backend-lead.agent.md` | MODIFY | Add Gate 2.5, update Gate 3 delegation |
| `.github/agents/frontend-lead.agent.md` | MODIFY | Add Gate 2.5, update Gate 3 delegation |
| `.github/agents/infra-lead.agent.md` | MODIFY | Add Gate 2.5, update Gate 3 delegation |
| `.github/agents/tester.agent.md` | MODIFY | Acknowledge test-lead specs as primary input |
| `.github/agents/docs-writer.agent.md` | MODIFY | Add test documentation responsibility |
| `.github/copilot-instructions.md` | MODIFY | Add modular bias, test-lead to agent table, updated gates |
| `TEMPLATE-GUIDE.md` | MODIFY | Update diagram, agent table, workflow description |
| `.test-specs/README.md` | CREATE | Directory readme |
| `.gitattributes` | MODIFY | Add merge=ours for .test-specs/project/ |

## Naming Conventions

- **Test-lead branch**: Not applicable (test-lead does not create branches — it writes specs)
- **Test spec files**: `.test-specs/project/<YYYY-MM-DD>-<workstream>-test-spec.md`
- **Test-lead log**: `.agent-logs/<project|template>/test-lead-log.md`
- **Event workstream**: `testing`

## Approval

- Approved by: human user
- Approved at: 2026-05-05 14:43:07
