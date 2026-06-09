---
description: "Use when writing or editing Python files. Python coding standards, type hints, PEP 8."
applyTo: "**/*.py"
---

# Python Standards

- Use type hints for all function signatures
- Follow PEP 8 naming: `snake_case` for functions/variables, `PascalCase` for classes
- Use docstrings for public functions and classes
- Prefer f-strings over `.format()` or `%`
- Use `pathlib.Path` over `os.path`
- Handle exceptions specifically, never bare `except:`
