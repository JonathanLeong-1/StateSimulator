# Architecture: Dashboard v2 Bug Fixes

- **Date**: 2026-04-17 00:20:44
- **Architect**: architect
- **Status**: approved

## Project Summary

Fix three dashboard bugs: (1) session-start accepted from non-architect agents causing rogue nodes and data wipes, (2) planPath not updating after plan-saved events, (3) sub-agents disappearing due to rogue session-start wipes.

## Bugs

### Bug 1: Rogue session-start creates ghost nodes + wipes data
- **Root cause**: server.js and state.js accept session-start from any agent
- **Fix**: Guard session-start to only work when evt.agent === 'architect'
- **Files**: dashboard/server.js, dashboard/lib/state.js

### Bug 2: Plan link shows stale/invalid path
- **Root cause**: planPath only set on session-start, not updated on plan-saved events
- **Fix**: Update planPath in SessionState when plan-saved events carry a plan field
- **Files**: dashboard/lib/state.js

### Bug 3: Sub-agents not visible
- **Root cause**: Data loss from rogue session-start wipe (same root cause as Bug 1)
- **Fix**: Prevented by Bug 1 fix. No additional code change needed.

## Changes

| File | Change |
|------|--------|
| dashboard/server.js | Guard handleSessionStart: only trigger if evt.agent === 'architect'; otherwise treat as normal event |
| dashboard/lib/state.js | Guard session-start: only reset if evt.agent === 'architect'; update planPath on plan-saved |
| dashboard/test/state.test.js | Add tests: session-start from non-architect ignored as reset; planPath updated on plan-saved |
| dashboard/test/server.test.js | No change needed (server delegates to state.js for logic) |

## Approval
- Approved by: human user
- Approved at: 2026-04-17 00:20:44
