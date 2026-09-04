# Task Completion Checklist

Run before considering a coding task done:

```bash
npm test           # node:test suite must pass
npx tsc --noEmit     # must type-check clean (strict mode)
```

No linter/formatter is configured — these two commands are the full verification gate.
If simulation behavior (`combat.ts`, `placement.ts`, `spawning.ts`, `pathfinding.ts`) changed, cross-check
against `docs/superpowers/specs/2026-09-03-dungeon-core-v1-design.md` (see `mem:core`).
