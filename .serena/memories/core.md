# Core

Terminal "dungeon core" management game (TypeScript, Node). Player digs rooms, spawns monsters,
places traps; adventurers spawn periodically and path toward the core. Real-time tick loop (1s),
pause/resume.

Design spec (source of truth for every game rule): `docs/superpowers/specs/2026-09-03-dungeon-core-v1-design.md`.
Implementation plan: `docs/superpowers/plans/2026-09-03-dungeon-core-v1.md`.
Read the spec before changing simulation behavior — it documents *why* rules are shaped as they are
(e.g. snapshot-based combat pairing, post-combat movement resolution).

Codebase splits along an I/O line: everything below `combat.ts` in the dependency order is a pure,
synchronous function of `GameState` and is unit-tested; everything from `loop.ts` up is
untested-by-design integration glue (spec explicitly excludes end-to-end/rendering tests).

For module responsibilities and dependency order: `mem:architecture`.
For build/test/run commands: `mem:suggested_commands`.
For coding conventions and invariants: `mem:conventions`.
For task-completion checks: `mem:task_completion`.
