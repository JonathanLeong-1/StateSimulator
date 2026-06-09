---
description: "Use when writing or editing TypeScript or JavaScript files. TypeScript coding standards, strict mode."
applyTo: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---

# TypeScript/JavaScript Standards

- Use TypeScript strict mode — no `any` types
- Use `const` by default, `let` when reassignment is needed, never `var`
- Use arrow functions for callbacks and lambdas
- Use async/await over raw Promises where possible
- Use named exports over default exports
- Prefer interfaces over type aliases for object shapes
- Handle errors with proper try/catch, never swallow errors silently
