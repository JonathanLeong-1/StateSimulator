# Launch Plan: Non-Coder Agent Tool Enforcement

- **Date**: 2026-04-24 22:32:37
- **Architecture Reference**: .plans/template/2026-04-24-223237-architecture-non-coder-tool-enforcement.md
- **Feature Fingerprint**: non-coder-tool-enforcement
- **Execution Mode**: sequential
- **Available Slots**: 1
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

```
template-enforcement (no dependencies)
```

## Execution Schedule

### Wave 1 — Template Enforcement Updates
- **Parallel slots used**: 1
- **Workstreams**:
  - template-enforcement → @infra-lead [session #1]
- **Sync point**: Merge to main after completion

## Sequential Fallback Order
1. template-enforcement → @infra-lead

## Delegation Payloads

### Payload: Template Enforcement → @infra-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-04-24-223237-architecture-non-coder-tool-enforcement.md
- **Launch Plan**: .plans/template/2026-04-24-223237-launch-plan-non-coder-tool-enforcement.md
- **Execution Mode**: sequential
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Template Enforcement — @infra-lead
**Architecture Reference**: `.plans/template/2026-04-24-223237-architecture-non-coder-tool-enforcement.md`
**Launch Plan Reference**: `.plans/template/2026-04-24-223237-launch-plan-non-coder-tool-enforcement.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: none
- **Codespace/Session**: sequential — single session
- **Sync point**: Merge to main after all gates pass

### Context
The agentic-vibe-coding template enforces a strict delegation hierarchy where only coding agents (@developer, @tester, @docs-writer) should write code. Lead agents already have the `edit` tool removed and FORBIDDEN ACTIONS / HARD DELEGATION CONSTRAINT sections. However, the architect agent and code-reviewer agent lack these enforcement sections, causing the architect to bypass leads and edit files directly.

### Scope
Add FORBIDDEN ACTIONS and HARD DELEGATION CONSTRAINT sections to the architect and code-reviewer agents, expand the Tool Enforcement section in copilot-instructions.md, and update the strict delegation protocol.

### Tasks

1. **Edit `.github/agents/architect.agent.md`**
   - Add a "FORBIDDEN ACTIONS — Architect Must NEVER Do These" section immediately after the "Your Responsibilities" section (before "## Plan Directory Structure"). Use the EXACT content specified in the architecture document's "Changes Required → 1" section.
   - Add a "HARD DELEGATION CONSTRAINT — Execute Tool Restrictions" section immediately after the FORBIDDEN ACTIONS section. Use the EXACT content specified in the architecture document.
   - Update the "## Constraints" section at the bottom of the file to add these 3 new bullet points:
     - `- DO NOT use 'execute' to create, edit, or delete any files outside '.plans/' and your own session log`
     - `- DO NOT fix bugs, write code, write tests, or write documentation — delegate to leads`
     - `- ONLY '@developer', '@tester', and '@docs-writer' may create or modify files in the repository (excluding '.plans/')`
   - **Acceptance criteria**: architect.agent.md has FORBIDDEN ACTIONS section, HARD DELEGATION CONSTRAINT section, and 3 new constraint bullets. YAML frontmatter tools list remains `[read, search, web, todo, askQuestions, agent, execute]` (no edit).

2. **Edit `.github/agents/code-reviewer.agent.md`**
   - Add a "FORBIDDEN ACTIONS — Code Reviewer Must NEVER Do These" section immediately after "Your Responsibilities" (the numbered list 1-5). Use the EXACT content specified in the architecture document's "Changes Required → 2" section.
   - Add a "HARD DELEGATION CONSTRAINT — Execute Tool Restrictions" section immediately after the FORBIDDEN ACTIONS section. Use the EXACT content specified in the architecture document.
   - **Acceptance criteria**: code-reviewer.agent.md has FORBIDDEN ACTIONS section and HARD DELEGATION CONSTRAINT section. YAML frontmatter tools list remains `[read, search, execute]` (no edit).

3. **Edit `.github/copilot-instructions.md`**
   - Find the existing "Tool Enforcement" paragraph in the "Strict Delegation Protocol" section (starts with `**Tool Enforcement**: Lead agents do NOT have the 'edit' tool`).
   - Replace that single paragraph with the expanded multi-paragraph version specified in the architecture document's "Changes Required → 3" section, which includes the Agent Category table.
   - **Acceptance criteria**: copilot-instructions.md contains the expanded Tool Enforcement section with the 4-row Agent Category table.

4. **Edit `.plans/template/2026-04-09-180237-strict-delegation-protocol.md`**
   - Add a new section "### 6. Non-Coder Agent Tool Restrictions" at the end of the "## Design: Strict Delegation Protocol" section (after section 5, before any next top-level heading). Use the EXACT content specified in the architecture document's "Changes Required → 4" section.
   - **Acceptance criteria**: Delegation protocol has a section 6 covering architect, code-reviewer, and the general rule.

5. **Run existing tests** to verify no regressions: `cd dashboard; npm test`
   - **Acceptance criteria**: All existing tests pass.

### Technical Decisions (from architecture)
- No application code changes — documentation and agent configuration only
- Follow the exact same FORBIDDEN ACTIONS + HARD DELEGATION CONSTRAINT pattern from lead agents
- The architecture document contains the EXACT text to insert — use it verbatim

### Dependencies
- Depends on: None
- Depended on by: None

### Interfaces
N/A — documentation/configuration changes only.

### Out of Scope
- Do NOT modify YAML frontmatter tool lists (they are already correct)
- Do NOT modify developer.agent.md, tester.agent.md, or docs-writer.agent.md
- Do NOT modify lead agent files (they already have enforcement)
- Do NOT change any application code
```

## Reproducibility Checksum

- **Plan Version**: 1
- **Prior Instances**: none
