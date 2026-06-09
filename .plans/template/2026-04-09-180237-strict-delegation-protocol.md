# Plan: Strict Agent Delegation & Logging Protocol

- **Date**: 2026-04-09 18:02:37
- **Designed by**: @architect
- **Status**: approved

## Problem Statement

Lead agents (frontend-lead, backend-lead, infra-lead) are not consistently delegating work to subagents (developer, tester, code-reviewer, docs-writer) in the correct sequence. Key issues:

1. No mandatory gates between delegation phases — leads can skip subagents
2. No standardized delegation payload — subagents receive ad-hoc context
3. No pre-PR checklist — no gate verifying all subagents completed
4. Code-reviewer has conflicting tool permissions (read-only but expected to log)
5. No subagent completion verification — leads don't confirm subagents logged
6. No structured back-reporting — subagents don't return standardized results
7. Architect doesn't enforce leads acknowledge plan receipt

## Design: Strict Delegation Protocol

### 1. Mandatory Execution Sequence (All Leads)

Every lead agent MUST follow this exact sequence. No step may be skipped. Each step is a **GATE** — the lead MUST verify the gate condition before proceeding.

```
GATE 0: PLAN APPROVAL
  └─ Human approves execution plan
  └─ Lead reads and references .plans/ file
  └─ Lead emits: plan-loaded event
  └─ ✅ Gate condition: Human said "approved" or equivalent

GATE 1: BRANCH CREATION
  └─ Lead creates feature branch
  └─ Lead emits: branch-created event
  └─ ✅ Gate condition: Branch exists (git branch --list)

GATE 2: IMPLEMENTATION (per task)
  └─ Lead emits: task-started event
  └─ Lead invokes @developer with DELEGATION PAYLOAD (see §2)
  └─ Lead emits: subagent-invoked event
  └─ Lead verifies @developer report (files changed, no errors)
  └─ Lead emits: task-completed event
  └─ ✅ Gate condition: Developer returned completion report

GATE 3: TESTING (mandatory — cannot skip)
  └─ Lead invokes @tester with DELEGATION PAYLOAD
  └─ Lead emits: subagent-invoked event
  └─ Lead verifies: all tests pass, coverage meets expectations
  └─ ✅ Gate condition: Tester returned "all tests pass"
  └─ 🛑 If tests fail: loop back to GATE 2 to fix, then re-test

GATE 4: CODE REVIEW (mandatory — cannot skip)
  └─ Lead invokes @code-reviewer with DELEGATION PAYLOAD
  └─ Lead emits: subagent-invoked event
  └─ Lead reads review verdict
  └─ ✅ Gate condition: Code reviewer returned "APPROVE"
  └─ 🛑 If "REQUEST CHANGES": loop back to GATE 2/3 to fix

GATE 5: DOCUMENTATION (mandatory — cannot skip)
  └─ Lead invokes @docs-writer with DELEGATION PAYLOAD
  └─ Lead emits: subagent-invoked event
  └─ Lead verifies docs were updated
  └─ ✅ Gate condition: Docs-writer returned completion report

GATE 6: PRE-COMMIT CHECKLIST (mandatory — all must be TRUE)
  └─ [ ] All tasks completed via @developer
  └─ [ ] All tests pass via @tester
  └─ [ ] Code review approved via @code-reviewer
  └─ [ ] Documentation updated via @docs-writer
  └─ [ ] All subagent logs written to .agent-logs/<project|template>/
  └─ [ ] All dashboard events emitted
  └─ ✅ Gate condition: ALL checkboxes TRUE

GATE 7: COMMIT & REPORT
  └─ Lead commits with descriptive message
  └─ Lead writes own session log to .agent-logs/<project|template>/
  └─ Lead emits: session-complete event
  └─ Lead reports to human with full summary
```

### 2. Standardized Delegation Payload

Every time a lead invokes a subagent, it MUST pass this structured context:

```
## Delegation Payload
- **Plan Reference**: <path to .plans/ file>
- **Branch**: <current feature branch name>
- **Lead Agent**: <which lead is delegating>
- **Task**: <specific task description>
- **Acceptance Criteria**: <what "done" looks like>
- **Files to Create/Modify**: <list of file paths>
- **Context**: <any additional context or dependencies>
```

### 3. Standardized Subagent Completion Report

Every subagent MUST return a structured report when done:

**Developer report**:
```
## Developer Completion Report
- **Task**: <description>
- **Branch**: <branch name>
- **Files Changed**: <list>
- **Key Decisions**: <any non-obvious choices>
- **Suggested Tests**: <what the tester should verify>
- **Log Written**: yes/no (to .agent-logs/<project|template>/developer-log.md)
- **Status**: done | blocked
```

**Tester report**:
```
## Tester Completion Report
- **Task**: <what was tested>
- **Branch**: <branch name>
- **Test Files**: <list>
- **Tests**: <total> total, <pass> passing, <fail> failing
- **Coverage Areas**: <list>
- **Failing Tests**: <details if any>
- **Log Written**: yes/no (to .agent-logs/<project|template>/tester-log.md)
- **Verdict**: ALL PASS | FAILURES FOUND
```

**Code Reviewer report**:
```
## Code Review Report
- **Branch Reviewed**: <branch name>
- **Verdict**: APPROVE | REQUEST CHANGES | NEEDS DISCUSSION
- **Critical Issues**: <count and list>
- **Warnings**: <count and list>
- **Suggestions**: <count and list>
- **Log Written**: yes/no (to .agent-logs/<project|template>/code-reviewer-log.md)
```

**Docs-Writer report**:
```
## Documentation Report
- **Task**: <what was documented>
- **Branch**: <branch name>
- **Files Changed**: <list>
- **Summary**: <what was added/updated>
- **Log Written**: yes/no (to .agent-logs/<project|template>/docs-writer-log.md)
- **Status**: done
```

### 4. Code Reviewer Tool Fix

The code-reviewer needs `execute` tool added so it can:
- Run `git diff` to see changes
- Run `git rev-parse --short HEAD` for its log
- Emit dashboard events

Updated tools: `[read, search, execute]`

### 5. Lead Verification Protocol

After each subagent returns, the lead MUST:
1. Read the subagent's completion report
2. Verify the "Log Written" field is "yes"
3. If "no", instruct the subagent to write its log before continuing
4. Record which subagents were invoked in the lead's own session log

### 6. Architect → Lead Handshake

When the architect delegates to a lead (Phase 5), the lead MUST:
1. Acknowledge receipt of the workstream brief
2. Confirm it read the `.plans/` file
3. Present its execution plan to the human for approval
4. Reference the architecture plan in all logs and subagent delegations

### 7. Non-Coder Agent Tool Restrictions

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

### 8. Subagent Unavailable Fallback Protocol

The `runSubagent` tool may not be available in all VS Code Copilot Chat sessions. When a lead or the architect detects this limitation, the following tiered fallback applies:

**Detection**: At session start (before Gate 0), the agent checks whether `runSubagent` is available. If unavailable, it emits a `fallback-mode` dashboard event and presents the human with tier options.

**Tier 1 � Human-Relay**:
- Agent prepares full Delegation Payloads (same format as normal mode)
- Human pastes payloads into separate agent chat sessions and relays Completion Reports back
- Agent processes reports exactly as in normal mode
- All gates still apply; no gates may be skipped

**Tier 2 � Self-Execution** (requires human's explicit blanket approval):
- Agent performs all subagent work itself using the `edit` tool
- Agent follows the 7-gate sequence exactly, performing each role in order
- Agent writes separate logs for each role (developer-log, tester-log, code-reviewer-log, docs-writer-log)
- Each log includes: `Execution Mode: fallback-self-execution (subagent unavailable)`
- Agent's own session log notes: "Fallback self-execution mode � all roles performed by lead"

**Architect exception**: The architect only supports Tier 1. It must never self-execute implementation, testing, review, or documentation work.

**Edit tool access**: Lead agents have the `edit` tool in their tool list but are FORBIDDEN from using it in normal delegation mode. The `edit` tool may ONLY be used in Tier 2 fallback mode after human approval.

## Files to Modify

| File | Change |
|------|--------|
| `.github/agents/frontend-lead.agent.md` | Add GATE protocol, delegation payloads, pre-commit checklist |
| `.github/agents/backend-lead.agent.md` | Add GATE protocol, delegation payloads, pre-commit checklist |
| `.github/agents/infra-lead.agent.md` | Add GATE protocol, delegation payloads, pre-commit checklist |
| `.github/agents/developer.agent.md` | Add completion report format, delegation payload acknowledgment |
| `.github/agents/tester.agent.md` | Add completion report format, delegation payload acknowledgment |
| `.github/agents/code-reviewer.agent.md` | Fix tools, add completion report, delegation payload acknowledgment |
| `.github/agents/docs-writer.agent.md` | Add completion report format, delegation payload acknowledgment |
| `.github/agents/architect.agent.md` | Add lead handshake protocol |
| `.github/copilot-instructions.md` | Add delegation protocol summary |

## Approval

- Approved by: human user
- Approved at: 2026-04-09 18:02:37
