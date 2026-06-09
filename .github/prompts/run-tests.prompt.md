---
description: "Run tests on a specific branch and report results."
agent: "agent"
argument-hint: "Branch name or area to test"
---

You are a test orchestration prompt. The user will specify a branch or area to test.

Your job:
1. Check out the specified branch (or identify what changed)
2. Invoke the @tester subagent to:
   - Identify what code needs testing
   - Write missing tests
   - Run the full test suite
   - Report results
3. Summarize the test results to the user

If tests fail, provide:
- Which tests failed and why
- Suggested fixes
- Whether the failures are in new or existing code
