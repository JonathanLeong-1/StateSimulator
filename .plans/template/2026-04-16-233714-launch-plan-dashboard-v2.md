# Launch Plan: Agent Monitor Dashboard v2

- **Date**: 2026-04-16 23:37:14
- **Architecture Reference**: .plans/2026-04-16-233714-architecture-dashboard-v2.md
- **Execution Mode**: sequential
- **Available Slots**: 1 (single VS Code window)
- **Total Workstreams**: 1
- **Total Waves**: 1

## Dependency Graph

```
[dashboard-v2] (no dependencies — standalone)
```

Single workstream with no external dependencies. The dashboard is self-contained within the `dashboard/` directory.

## Execution Schedule

### Wave 1 — Dashboard v2 Full Rebuild

- **Parallel slots used**: 1
- **Workstreams**:
  - dashboard-v2 → @frontend-lead [session #1]
- **Sync point**: Workstream completes, tests pass, branch merged to main

## Sequential Fallback Order

1. dashboard-v2 → @frontend-lead

## Notes

- This is a single-workstream project. No parallel execution needed.
- The workstream covers all layers: event system (lib/), server (server.js), and frontend (public/).
- Assigned to @frontend-lead because the primary complexity is UI (SVG graph, real-time rendering, dark theme).
- The backend layer (server.js) is a thin HTTP/SSE server and will be built as part of the same workstream.
- Old code in `dashboard/lib/collectors/` and old tests should be deleted as part of the task.
