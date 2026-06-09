# Launch Plan: Template Workflow Enhancements — Modular Bias, Test Lead, Docs Update

- **Date**: 2026-05-05 14:43:07
- **Architecture Reference**: .plans/template/2026-05-05-144307-architecture-modular-test-lead.md
- **Feature Fingerprint**: template-workflow-modular-test-lead
- **Execution Mode**: sequential
- **Available Slots**: 1 (local VS Code)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

All changes are to agent definition files, copilot-instructions, and TEMPLATE-GUIDE — they form one cohesive workstream since they all modify interconnected template infrastructure files.

```
[single workstream: template-infra] — no external dependencies
```

## Execution Schedule

### Wave 1 — Template Infrastructure Updates

- **Parallel slots used**: 1
- **Workstreams**:
  - template-infra → @infra-lead [session #1]
- **Sync point**: All changes committed on feature branch, PR ready

## Sequential Fallback Order

1. template-infra → @infra-lead

## Delegation Payloads

### Payload: Template Infrastructure → @infra-lead

```
## Architect Handshake
- **Architecture Plan**: .plans/template/2026-05-05-144307-architecture-modular-test-lead.md
- **Launch Plan**: .plans/template/2026-05-05-144307-launch-plan-modular-test-lead.md
- **Execution Mode**: sequential
- **Workstream Brief**: See below
- **Delegation Protocol**: .plans/template/2026-04-09-180237-strict-delegation-protocol.md
- **Required Acknowledgment**: Lead MUST confirm:
  1. It has read the architecture plan
  2. It has read the delegation protocol
  3. It will follow the 7-Gate mandatory sequence
  4. It will present its execution plan to the human before starting
  5. It acknowledges its execution mode and wave assignment

---
## Workstream: Template Infrastructure — @infra-lead
**Architecture Reference**: `.plans/template/2026-05-05-144307-architecture-modular-test-lead.md`
**Launch Plan Reference**: `.plans/template/2026-05-05-144307-launch-plan-modular-test-lead.md`

### Execution Context
- **Mode**: sequential
- **Wave**: 1 of 1
- **Parallel peers**: none
- **Prerequisites**: none
- **Codespace/Session**: sequential — single local VS Code session
- **Sync point**: All changes committed on feature branch

### Context
The template multi-agent workflow needs three fundamental enhancements:
1. Architect agent must prefer modular/microservice architecture by default
2. A new @test-lead agent must be created that generates test specifications from plans (not code)
3. @docs-writer must also document test cases from the test-lead

### Scope
All changes to agent definitions (.github/agents/), copilot-instructions.md, TEMPLATE-GUIDE.md, .test-specs/ directory, and .gitattributes.

### Tasks

#### Task 1: Create .test-specs/ directory structure
- Create `.test-specs/README.md` with explanation of the directory purpose
- Create `.test-specs/project/` and `.test-specs/template/` directories (with .gitkeep)
- Update `.gitattributes` to add `merge=ours` for `.test-specs/project/**`
- **Acceptance Criteria**: Directory exists, .gitattributes updated

#### Task 2: Create @test-lead agent definition
- Create `.github/agents/test-lead.agent.md` with:
  - YAML frontmatter: description, tools [read, search, execute, web, todo, askQuestions], user-invocable: true
  - Full agent instructions covering: reading plans, producing test specs, writing to .test-specs/
  - Dashboard event emission instructions (workstream: testing)
  - Session log format (to .agent-logs/<project|template>/test-lead-log.md)
  - Completion report format
  - Forbidden actions (must NOT look at implementation code)
  - Test specification output format (matching architecture doc)
- **Acceptance Criteria**: Agent file exists, is well-structured, follows patterns from other agent files

#### Task 3: Modify architect.agent.md — Add Modular Architecture Bias
- Add a new section "Modular Architecture Bias (MANDATORY)" to Phase 2
- Include the modular architecture rules: stateless components, API-first interfaces, independent deployability, failure isolation
- Include exception criteria (trivial projects, human explicitly requests monolith)
- Include the modular architecture checklist
- **Acceptance Criteria**: Section exists in architect.agent.md, rules are clear and enforceable

#### Task 4: Modify team lead agents — Add Gate 2.5 and update Gate 3
- In `backend-lead.agent.md`, `frontend-lead.agent.md`, `infra-lead.agent.md`:
  - Add GATE 2.5 (Test Spec Readiness) between Gate 2 and Gate 3
  - Update Gate 3 delegation payload to include test-lead specs as PRIMARY input
  - Update the Pre-Commit Checklist (Gate 6) to include test spec verification
  - Add test-lead specs reference to the @docs-writer delegation payload at Gate 5
- **Acceptance Criteria**: All three lead files updated consistently, gate flow is clear

#### Task 5: Modify tester.agent.md — Acknowledge test-lead specs
- Update the Delegation Payload Acknowledgment section to include "Test Specs Reference"
- Update the Approach section: tester reads test-lead specs FIRST, then implementation code
- Clarify that test-lead specs are PRIMARY guidance, developer suggested tests are SECONDARY
- **Acceptance Criteria**: Tester agent acknowledges test-lead specs in its workflow

#### Task 6: Modify docs-writer.agent.md — Add test documentation
- Add responsibility: "Document test cases and test strategy from test-lead specifications"
- Update Delegation Payload section to include "Test Specs Reference" field
- Add instruction: when Test Specs Reference is provided, include a "Test Plan" section in docs
- Specify what the test plan section should contain (strategy summary, key scenarios, how to run tests)
- **Acceptance Criteria**: Docs-writer acknowledges test spec documentation responsibility

#### Task 7: Update copilot-instructions.md
- Add "Modular Architecture Preference" to Project Standards section
- Add @test-lead to the Strict Delegation Protocol agent table
- Update the tool permissions table to include test-lead
- Update the gate sequence description to include Gate 2.5
- Update the Pre-Commit Checklist to include test spec items
- Add .test-specs/ to the file permission rules
- **Acceptance Criteria**: copilot-instructions.md reflects all 3 changes consistently

#### Task 8: Update TEMPLATE-GUIDE.md
- Update the architecture diagram to show @test-lead
- Update the Agent Team table to include @test-lead
- Update the Planning Workflow section to describe test-lead invocation
- Update the Repository Structure section to include .test-specs/
- Add a brief "Test Planning Workflow" subsection
- **Acceptance Criteria**: TEMPLATE-GUIDE.md accurately reflects the new workflow

### Technical Decisions (from architecture)
- Test-lead writes specs via terminal commands (not edit tool) — same as architect writing plans
- Test specs live in .test-specs/project/ (protected) and .test-specs/template/
- Test-lead uses --workstream testing for all dashboard events
- Gate 2.5 is a soft gate — if test specs aren't ready, leads can fall back to developer's suggested tests
- Test-lead is user-invocable (not a subagent of another lead)

### Dependencies
- Depends on: None (first and only wave)
- Depended on by: None

### Interfaces
- Test spec format is defined in the architecture document
- Delegation payload format for @tester updated with "Test Specs Reference" field
- Delegation payload format for @docs-writer updated with "Test Specs Reference" field

### Out of Scope
- Dashboard UI changes (events are already supported, no new UI needed)
- Changes to @developer or @code-reviewer agents
- New workflows/prompts (.github/prompts/)
- CI/CD changes
```

## Reproducibility Checksum

- **Architecture Hash**: (first 8 chars of content hash)
- **Plan Version**: 1
- **Prior Instances**: none
