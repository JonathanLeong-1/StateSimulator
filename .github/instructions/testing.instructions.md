---
description: "Use when writing tests, test files, spec files. Testing conventions, test patterns, test structure."
applyTo: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/__tests__/**"]
---

# Testing Standards

- Use descriptive test names: `should <expected behavior> when <condition>`
- Follow Arrange-Act-Assert pattern
- One assertion per test when practical
- Use test fixtures and factories over inline object creation
- Mock external dependencies, not internal implementation
- Tests must be independent — no shared mutable state between tests
- Include edge cases: empty inputs, null/undefined, boundary values, error paths
