# Launch Plan: Subagent Unavailable Fallback Protocol

- **Date**: 2026-04-25 22:28:08
- **Architecture Reference**: .plans/template/2026-04-25-222808-architecture-subagent-fallback.md
- **Feature Fingerprint**: subagent-unavailable-fallback
- **Execution Mode**: sequential
- **Available Slots**: 1
- **Total Workstreams**: 2
- **Total Waves**: 1

## Dependency Graph

```
agent-definitions (no deps)
dashboard-ui      (no deps)

Both independent — can run in any order.
```

## Execution Schedule

### Wave 1 — Agent Definitions + Dashboard UI
- **Parallel slots used**: 1 (sequential)
- **Workstreams**:
  - agent-definitions -> @infra-lead [session #1]
  - dashboard-ui -> @frontend-lead [session #2]
- **Sync point**: Both merge to main after completion

## Sequential Fallback Order
1. agent-definitions -> @infra-lead
2. dashboard-ui -> @frontend-lead

## Delegation Payloads

### Payload: Agent Definitions -> @infra-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-25-222808-architecture-subagent-fallback.md
- **Launch Plan**: .plans/template/2026-04-25-222808-launch-plan-subagent-fallback.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Agent Definitions — @infra-lead
**Architecture Reference**: .plans/template/2026-04-25-222808-architecture-subagent-fallback.md
**Launch Plan Reference**: .plans/template/2026-04-25-222808-launch-plan-subagent-fallback.md

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: dashboard-ui (but running sequentially)
- **Prerequisites**: none
- **Codespace/Session**: sequential — run first
- **Sync point**: Merge to main before or after dashboard-ui (independent)

### Context
The agentic-vibe-coding template enforces a strict delegation protocol where leads invoke subagents via runSubagent. However, this tool is not always available in VS Code sessions. This workstream adds a formal tiered fallback protocol to all delegating agents so they handle the limitation gracefully instead of silently violating the protocol.

### Scope
Modify all 3 lead agent definitions, the architect agent definition, copilot-instructions.md, and the strict delegation protocol to include the subagent-unavailable fallback.

### Tasks

1. **Edit .github/agents/backend-lead.agent.md**
   - Add `edit` to the YAML frontmatter tools list: `tools: [read, search, execute, agent, web, todo, askQuestions, edit]`
   - Add a new section "## Step 0 (Pre-Gate): Capability Check" BEFORE the existing "### Phase 1: Planning" section. Content:
     ```
     ## Step 0 (Pre-Gate): Capability Check

     Before starting any work, determine your delegation capability:

     1. **Check**: Is the `runSubagent` tool available in this session?
        - If **YES** -> **Normal delegation mode**. Proceed to Phase 1.
        - If **NO** -> Emit fallback-mode event and announce to the human:
          "Warning: Subagent invocation is unavailable in this session. I cannot delegate to @developer, @tester, @code-reviewer, or @docs-writer."
          Then ask via askQuestions: "Would you prefer to (a) relay delegation payloads yourself — I'll prepare them for you to paste into separate agent chats, or (b) grant me blanket approval to self-execute all roles?"

     2. **If Tier 1 (Human-Relay)**:
        - For each gate requiring a subagent, prepare the full Delegation Payload as normal
        - Present it to the human with: "Please paste this to @<agent> in a new chat and send me back the Completion Report"
        - Wait for the human to relay the subagent's Completion Report
        - Process the report exactly as in normal mode (check "Log Written", verdict, etc.)
        - Emit `subagent-invoked` events as normal for dashboard tracking
        - Emit at session start: `node dashboard/lib/emit-event.js backend-lead fallback-mode --detail "tier-1" --workstream backend`

     3. **If Tier 2 (Self-Execution)**:
        - You have the human's blanket approval to perform all subagent work yourself
        - You may use the `edit` tool to create and modify files
        - Follow the 7-gate sequence exactly, performing each role in order:
          - Gate 2: Write code (as @developer), write to `.agent-logs/<context>/developer-log.md`
          - Gate 3: Write and run tests (as @tester), write to `.agent-logs/<context>/tester-log.md`
          - Gate 4: Self-review against standards (as @code-reviewer), write to `.agent-logs/<context>/code-reviewer-log.md`
          - Gate 5: Write docs (as @docs-writer), write to `.agent-logs/<context>/docs-writer-log.md`
        - Each role's log MUST include: `- **Execution Mode**: fallback-self-execution (subagent unavailable)`
        - At Gate 7, your lead session log MUST note: "Fallback self-execution mode — all roles performed by lead"
        - Emit at session start: `node dashboard/lib/emit-event.js backend-lead fallback-mode --detail "tier-2" --workstream backend`
     ```
   - Add a new section "## Edit Tool — Conditional Access (MANDATORY READ)" AFTER the existing "## HARD DELEGATION CONSTRAINT" section. Content:
     ```
     ## Edit Tool — Conditional Access (MANDATORY READ)

     The `edit` tool is available to you but RESTRICTED:

     - **Normal mode** (subagents available): NEVER use `edit`. All file creation/modification MUST be delegated to subagents. Using `edit` in normal mode is a protocol violation.
     - **Tier 2 fallback mode** (human-approved self-execution): You may use `edit` to create and modify files. This permission is ONLY granted after the human explicitly approves Tier 2 self-execution mode.

     If you are uncertain which mode you're in, you are in Normal mode. Do NOT use `edit`.
     ```
   - **Acceptance criteria**: backend-lead.agent.md has edit in tools, Step 0 capability check, Tier 1/2 instructions, and conditional edit section.

2. **Edit .github/agents/frontend-lead.agent.md**
   - Apply the EXACT same changes as task 1, but replace all instances of "backend-lead" with "frontend-lead", "backend" with "frontend", and "feature/backend/" with "feature/frontend/".
   - **Acceptance criteria**: frontend-lead.agent.md has identical fallback sections adapted for frontend.

3. **Edit .github/agents/infra-lead.agent.md**
   - Apply the EXACT same changes as task 1, but replace all instances of "backend-lead" with "infra-lead", "backend" with "infra", and "feature/backend/" with "feature/infra/".
   - **Acceptance criteria**: infra-lead.agent.md has identical fallback sections adapted for infra.

4. **Edit .github/agents/architect.agent.md**
   - Add a new section "## Step 0 (Pre-Session): Lead Delegation Capability Check" in the "## Workflow" section, BEFORE "### Phase 0: Plan Memory Refresh". Content:
     ```
     ### Pre-Session: Lead Delegation Capability Check

     Before starting Phase 0, determine your delegation capability:

     1. **Check**: Is the `runSubagent` tool available in this session?
        - If **YES** -> Normal mode. You can invoke leads directly in Phase 6 if instructed.
        - If **NO** -> You are in **manual delegation mode** only.
          Inform the human: "Subagent invocation is unavailable. I will prepare complete delegation payloads for each lead. You will need to paste them into separate agent chat sessions."
          Emit: `node dashboard/lib/emit-event.js architect fallback-mode --detail "tier-1"`

     Note: The architect does NOT support Tier 2 self-execution. The architect's role is design and planning — it must NEVER write application code, tests, or documentation regardless of tool availability. If leads also cannot invoke subagents, each lead will independently detect this and offer their own Tier 1/Tier 2 choice to the human.
     ```
   - **Acceptance criteria**: architect.agent.md has the pre-session capability check section. No edit tool added (architect remains plan-only).

5. **Edit .github/copilot-instructions.md**
   - Add a new section "## Subagent Unavailable Fallback" immediately after the "## Strict Delegation Protocol" section's table. Content:
     ```
     ## Subagent Unavailable Fallback

     The `runSubagent` tool may not be available in all VS Code Copilot Chat sessions. When this occurs, delegating agents (leads and architect) follow a tiered fallback:

     | Tier | Mode | Description |
     |------|------|-------------|
     | Normal | runSubagent delegation | Standard protocol — leads invoke subagents |
     | Tier 1 | Human-relay | Lead prepares delegation payloads for human to paste into separate agent chats |
     | Tier 2 | Self-execution | Lead performs all subagent work itself (requires human's explicit blanket approval) |

     **Detection**: Leads check for runSubagent availability at session start (Step 0, before Gate 0).

     **Tier 2 constraints**: Even in self-execution mode, leads MUST follow the 7-gate sequence, write separate logs per role (developer-log, tester-log, code-reviewer-log, docs-writer-log), and note `Execution Mode: fallback-self-execution` in each log.

     **Dashboard**: Leads emit a `fallback-mode` event with detail `tier-1` or `tier-2` so the dashboard shows when fallback is active.

     **Architect**: Only supports Tier 1 (manual delegation payloads). The architect must never self-execute implementation work.
     ```
   - **Acceptance criteria**: copilot-instructions.md has the Subagent Unavailable Fallback section with the tier table.

6. **Edit .plans/template/2026-04-09-180237-strict-delegation-protocol.md**
   - Add a new section "### 8. Subagent Unavailable Fallback Protocol" at the end of the "## Design: Strict Delegation Protocol" section (after section 7). Content:
     ```
     ### 8. Subagent Unavailable Fallback Protocol

     The `runSubagent` tool may not be available in all VS Code Copilot Chat sessions. When a lead or the architect detects this limitation, the following tiered fallback applies:

     **Detection**: At session start (before Gate 0), the agent checks whether `runSubagent` is available. If unavailable, it emits a `fallback-mode` dashboard event and presents the human with tier options.

     **Tier 1 — Human-Relay**:
     - Agent prepares full Delegation Payloads (same format as normal mode)
     - Human pastes payloads into separate agent chat sessions and relays Completion Reports back
     - Agent processes reports exactly as in normal mode
     - All gates still apply; no gates may be skipped

     **Tier 2 — Self-Execution** (requires human's explicit blanket approval):
     - Agent performs all subagent work itself using the `edit` tool
     - Agent follows the 7-gate sequence exactly, performing each role in order
     - Agent writes separate logs for each role (developer-log, tester-log, code-reviewer-log, docs-writer-log)
     - Each log includes: `Execution Mode: fallback-self-execution (subagent unavailable)`
     - Agent's own session log notes: "Fallback self-execution mode — all roles performed by lead"

     **Architect exception**: The architect only supports Tier 1. It must never self-execute implementation, testing, review, or documentation work.

     **Edit tool access**: Lead agents have the `edit` tool in their tool list but are FORBIDDEN from using it in normal delegation mode. The `edit` tool may ONLY be used in Tier 2 fallback mode after human approval.
     ```
   - **Acceptance criteria**: Delegation protocol has section 8 covering the full fallback protocol.

7. **Run existing tests** to verify no regressions: `cd dashboard; npm test`
   - **Acceptance criteria**: All existing tests pass.

### Technical Decisions (from architecture)
- Add edit to lead YAML permanently with conditional instructions (not dynamic)
- Architect does NOT get Tier 2 — remains plan-only
- fallback-mode event uses existing event schema (agent, event, detail, workstream)
- Follow exact patterns from existing FORBIDDEN ACTIONS / HARD DELEGATION CONSTRAINT sections

### Dependencies
- Depends on: None
- Depended on by: dashboard-ui (for fallback-mode event — but dashboard-ui can proceed independently since the event schema is defined in the architecture)

### Interfaces
New event type: `fallback-mode` with detail `tier-1` or `tier-2`

### Out of Scope
- Do NOT modify developer.agent.md, tester.agent.md, docs-writer.agent.md, or code-reviewer.agent.md
- Do NOT modify dashboard code (that's the dashboard-ui workstream)
- Do NOT change the 7-gate sequence itself — only add fallback handling around it
```

### Payload: Dashboard UI -> @frontend-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-25-222808-architecture-subagent-fallback.md
- **Launch Plan**: .plans/template/2026-04-25-222808-launch-plan-subagent-fallback.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Dashboard UI — @frontend-lead
**Architecture Reference**: .plans/template/2026-04-25-222808-architecture-subagent-fallback.md
**Launch Plan Reference**: .plans/template/2026-04-25-222808-launch-plan-subagent-fallback.md

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: agent-definitions (but running sequentially)
- **Prerequisites**: none (agent-definitions workstream is independent)
- **Codespace/Session**: sequential — run second (after agent-definitions)
- **Sync point**: Merge to main after completion

### Context
The agentic-vibe-coding template now has a subagent-unavailable fallback protocol. Leads emit a `fallback-mode` event when operating in degraded mode. The dashboard needs to process this event and display a visual indicator.

### Scope
Add fallback-mode event handling to the dashboard: state processing, UI badge display, and styling.

### Tasks

1. **Edit dashboard/lib/state.js**
   - In the `processEvent` method's switch statement, add a new case for `fallback-mode`:
     ```javascript
     case 'fallback-mode':
       this._setAgentField(evt.agent, 'fallbackMode', evt.detail || 'unknown');
       this._setAgentField(evt.agent, 'status', 'active');
       break;
     ```
   - **Acceptance criteria**: SessionState processes fallback-mode events and sets fallbackMode field on agent.

2. **Edit dashboard/public/app.js**
   - In the agent card/node rendering code, check for `agent.fallbackMode`. If present, append a badge element:
     - tier-1: amber badge with text "RELAY"
     - tier-2: orange badge with text "SELF-EXEC"
   - The badge should appear next to the agent name or status indicator
   - **Acceptance criteria**: Agent nodes/cards show a colored badge when fallbackMode is set.

3. **Edit dashboard/public/styles.css**
   - Add styles for the fallback badge:
     ```css
     .fallback-badge {
       display: inline-block;
       padding: 2px 6px;
       border-radius: 3px;
       font-size: 0.7rem;
       font-weight: 600;
       text-transform: uppercase;
       margin-left: 6px;
     }
     .fallback-badge.tier-1 {
       background: #f59e0b;
       color: #000;
     }
     .fallback-badge.tier-2 {
       background: #ea580c;
       color: #fff;
     }
     ```
   - **Acceptance criteria**: Fallback badges have distinct amber (tier-1) and orange (tier-2) styling.

4. **Edit dashboard/test/state.test.js**
   - Add 4 new tests:
     a. `fallback-mode tier-1 sets agent fallbackMode`: Emit fallback-mode with detail "tier-1", verify agent.fallbackMode === "tier-1"
     b. `fallback-mode tier-2 sets agent fallbackMode`: Emit with detail "tier-2", verify agent.fallbackMode === "tier-2"
     c. `fallback-mode sets agent status to active`: Verify status is "active" after event
     d. `fallback-mode with no detail defaults to unknown`: Emit without detail, verify fallbackMode === "unknown"
   - **Acceptance criteria**: All 4 new tests pass alongside existing tests.

5. **Run all tests**: `cd dashboard; npm test`
   - **Acceptance criteria**: All tests pass (existing + 4 new).

### Technical Decisions (from architecture)
- Use existing event processing pattern in state.js (switch case + _setAgentField)
- Badge uses inline-block styling consistent with existing dashboard dark theme
- Colors: amber (#f59e0b) for tier-1, orange (#ea580c) for tier-2

### Dependencies
- Depends on: None (event schema defined in architecture doc)
- Depended on by: None

### Interfaces
Consumes: `fallback-mode` event with `detail` field ("tier-1" or "tier-2")
Produces: `fallbackMode` field on agent objects in getState() response

### Out of Scope
- Do NOT modify agent definition files (that's the agent-definitions workstream)
- Do NOT modify server.js (no new endpoints needed)
- Do NOT modify graph.js (badges go on cards in app.js, not SVG graph nodes)
```

## Reproducibility Checksum

- **Plan Version**: 1
- **Prior Instances**: none
