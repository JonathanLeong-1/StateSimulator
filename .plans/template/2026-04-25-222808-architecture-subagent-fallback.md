# Architecture: Subagent Unavailable Fallback Protocol

- **Date**: 2026-04-25 22:28:08
- **Architect**: architect
- **Status**: approved
- **Feature Fingerprint**: subagent-unavailable-fallback

## Feature Fingerprint

- **Canonical Name**: `subagent-unavailable-fallback`
- **Aliases**: runSubagent fallback, delegation fallback, subagent-unavailable, human-relay delegation, self-execution fallback
- **Category**: infrastructure / workflow-enforcement

## Project Summary

Add a formal tiered fallback protocol to all delegating agents (leads + architect) for when the `runSubagent` tool is unavailable in a VS Code Copilot Chat session. The protocol detects the limitation upfront, offers a human-relay mode (Tier 1) and a human-approved self-execution mode (Tier 2), and emits dashboard events for visibility.

## Architecture Style

Documentation/configuration change + minor dashboard code enhancement. Agent definition updates (Markdown) + small state.js/app.js/styles.css changes.

## Problem Statement

VS Code Copilot Chat's `runSubagent` tool is not always available depending on session type, model, and extension state. When lead agents (and the architect) cannot invoke subagents, they currently either:
1. **Silently self-execute** - violating the strict delegation protocol
2. **Report failure and halt** - blocking the entire workflow

Neither outcome is acceptable. The template needs a formal, tiered fallback protocol that preserves workflow integrity while adapting to platform limitations.

## Design: Tiered Subagent Unavailable Fallback Protocol

### Tier Structure

| Tier | Mode | Description | Human Action Required |
|------|------|-------------|----------------------|
| **Normal** | Delegation via runSubagent | Standard protocol - leads invoke subagents | None |
| **Tier 1** | Human-relay | Lead prepares full delegation payloads, asks human to paste into separate agent chats and relay results back | Human acts as message bus |
| **Tier 2** | Self-execution | Lead performs all subagent work itself (with human's blanket approval) | One-time explicit approval |

### Detection - Upfront Capability Check

At the very start of every lead session (before Gate 0), the lead performs a capability check:

```
## Step 0 (Pre-Gate): Capability Check

1. Check: Is the runSubagent tool available in this session?
   - If YES -> Normal delegation mode. Proceed to Gate 0.
   - If NO -> Emit fallback-mode event. Announce to human:
     "Warning: Subagent invocation is unavailable in this session.
      I cannot delegate to @developer, @tester, @code-reviewer, or @docs-writer."
     Then ask: "Would you prefer to relay delegation payloads yourself (Tier 1),
     or grant me blanket approval to self-execute all roles (Tier 2)?"
```

The architect follows the same pattern when attempting to invoke leads.

### Tier 1: Human-Relay Protocol

When the human chooses Tier 1:

1. Lead prepares the full Delegation Payload for the target subagent (same format as normal mode)
2. Lead presents the payload to the human with instructions: "Please paste this to @developer in a new chat and send me back the Completion Report"
3. Human pastes the payload into a new Copilot Chat session with the target agent
4. Human relays the subagent's Completion Report back to the lead
5. Lead processes the report exactly as in normal mode (checks "Log Written", verdict, etc.)
6. Repeat for each gate (testing -> review -> docs)
7. Dashboard: Lead emits subagent-invoked events as normal plus fallback-mode event at session start

### Tier 2: Self-Execution Protocol

When the human grants blanket approval for self-execution:

1. Lead gains permission to use the edit tool for file creation/modification
2. Lead performs each gate's work in the correct order, role by role:
   - Gate 2 (Implementation): Lead writes code as if it were @developer, writes to developer-log
   - Gate 3 (Testing): Lead writes and runs tests as if it were @tester, writes to tester-log
   - Gate 4 (Code Review): Lead self-reviews against project standards, writes to code-reviewer-log
   - Gate 5 (Documentation): Lead writes docs as if it were @docs-writer, writes to docs-writer-log
3. Lead writes its own lead-log at Gate 7 noting "Fallback self-execution mode - all roles performed by lead"
4. Each role's log MUST include: "Execution Mode: fallback-self-execution (subagent unavailable)"
5. Even in self-execution mode, the lead MUST follow the 7-gate sequence - cannot skip testing, review, or docs

### Edit Tool - Conditional Access

Add `edit` to all 3 lead agents' YAML tools list permanently, with conditional instruction:

```markdown
## Edit Tool - Conditional Access (MANDATORY READ)

The edit tool is available to you but RESTRICTED:

- **Normal mode** (subagents available): NEVER use edit. All file creation/modification
  MUST be delegated to subagents. Using edit in normal mode is a protocol violation.
- **Tier 2 fallback mode** (human-approved self-execution): You may use edit to create
  and modify files. This permission is ONLY granted after the human explicitly approves
  Tier 2 self-execution mode.

If you are uncertain which mode you're in, you are in Normal mode. Do NOT use edit.
```

### New Dashboard Event: fallback-mode

```json
{
  "ts": "2026-04-25T...",
  "agent": "backend-lead",
  "event": "fallback-mode",
  "detail": "tier-1 or tier-2",
  "workstream": "backend"
}
```

The dashboard's SessionState processes this event and sets a fallbackMode field on the agent.
The UI displays a warning badge on the agent node.

## Application Layers

### Frontend (Dashboard UI)
- Type: SPA (existing vanilla JS)
- Changes: Fallback-mode badge on agent nodes, warning color styling

### Backend (Dashboard Server)
- Type: REST + SSE (existing)
- Changes: None to server.js - state.js handles the new event type

### Data Layer
- Storage: Existing events.jsonl / events-workstream.jsonl
- New event type: fallback-mode (processed by SessionState)

## Infrastructure Components

No new infrastructure. Changes are to agent definitions (Markdown) and minor dashboard code.

## Cross-Cutting Concerns

### Testing Strategy
- Unit tests: SessionState fallback-mode event processing (state.test.js)
- Manual validation: Lead agent behavior in degraded sessions

### Error Handling
- If upfront detection fails (edge case): Lead should still detect at first runSubagent attempt and switch to fallback

## Repository Structure (Changes Only)

No new files created. Modified files only:

| File | Change |
|------|--------|
| .github/agents/backend-lead.agent.md | Add edit to YAML tools, Step 0 capability check, Tier 1/2 sections, conditional edit instructions |
| .github/agents/frontend-lead.agent.md | Same as backend-lead |
| .github/agents/infra-lead.agent.md | Same as infra-lead |
| .github/agents/architect.agent.md | Add capability check + fallback for lead invocation |
| .github/copilot-instructions.md | Add Subagent Unavailable Fallback section |
| .plans/template/2026-04-09-180237-strict-delegation-protocol.md | Add section 8: Subagent Unavailable Fallback |
| dashboard/lib/state.js | Add fallback-mode event handler |
| dashboard/public/app.js | Display fallback-mode badge |
| dashboard/public/styles.css | Fallback badge styling |
| dashboard/test/state.test.js | Tests for fallback-mode event |

## Naming Conventions

- Event type: `fallback-mode` (kebab-case, matches existing event naming)
- Detail values: `tier-1`, `tier-2` (kebab-case)
- Agent field: `fallbackMode` (camelCase, matches existing agent fields like `thinkingSummary`)
- CSS class: `.fallback-badge` (BEM-style)
- Branches: `feature/template/subagent-fallback`

## Interface Contracts

### New Event Schema Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| event | `"fallback-mode"` | yes | Event type |
| detail | `"tier-1"` or `"tier-2"` | yes | Which fallback tier was selected |
| workstream | string | no | Workstream name (if applicable) |

### SessionState Enhancement

```javascript
case 'fallback-mode':
  this._setAgentField(evt.agent, 'fallbackMode', evt.detail || 'unknown');
  this._setAgentField(evt.agent, 'status', 'active');
  break;
```

### Dashboard UI Badge

Agent nodes with `fallbackMode` set display a colored badge:
- tier-1: amber/yellow badge with "RELAY" text
- tier-2: orange badge with "SELF-EXEC" text

## Test Specifications

### Unit Tests (state.test.js)

1. **fallback-mode tier-1**: Emit fallback-mode with detail "tier-1", verify agent.fallbackMode === "tier-1"
2. **fallback-mode tier-2**: Emit fallback-mode with detail "tier-2", verify agent.fallbackMode === "tier-2"
3. **fallback-mode sets status active**: Verify agent status is "active" after fallback-mode event
4. **fallback-mode unknown detail**: Emit without detail, verify fallbackMode === "unknown"

### Manual Verification

1. Lead detects missing runSubagent and prompts human with tier choice
2. Tier 1: Lead produces correct delegation payloads for human relay
3. Tier 2: Lead writes separate logs per role in fallback mode
4. Dashboard shows fallback badge on agent node

## Expected Output Manifest

| Workstream | Files Modified | Tests |
|------------|---------------|-------|
| agent-definitions | 4 agent .md files + copilot-instructions.md + delegation-protocol.md | Manual verification |
| dashboard-ui | state.js, app.js, styles.css | state.test.js (4 new tests) |

## Reproducibility Notes

- The edit tool added to lead YAML is conditional - instructions restrict its use to Tier 2 only
- The fallback-mode event follows existing event schema patterns (agent, event, detail, workstream)
- All lead agents get identical fallback sections - only the workstream name and agent name differ
- The architect gets a similar but adapted section (delegates to leads, not subagents)

## Approval
- Approved by: human user
- Approved at: 2026-04-25 22:28:08
