# Repository Guidelines

## Project Structure and Architecture

Dungeon Core is a TypeScript/Node.js terminal game. Keep pure, synchronous
simulation code in `src/` (grid, pathfinding, state, placement, economy, and
tick logic). Keep I/O at the boundary in `src/main.ts`, `src/commands.ts`,
and `src/render.ts`; simulation modules must not depend on readline, timers,
or terminal output. Put unit tests in `tests/`, mirroring source modules (for
example, `src/grid.ts` → `tests/grid.test.ts`). Design specifications and
implementation plans live in `docs/superpowers/`.

## Build, Test, and Development

Install dependencies and use the repository scripts:

```bash
npm install                         # Install development dependencies
npm run dev                         # Start the interactive game
npm test                            # Run all Node built-in tests
npx tsc --noEmit                    # Type-check without emitting files
```

The project uses Node’s built-in test runner. There is no separate formatter
or linter configured; type-checking and tests are the required local checks.

## Coding Style and Naming

Use strict TypeScript, two-space indentation, semicolons, and single quotes.
Prefer small pure functions and plain objects over class hierarchies or
speculative abstractions. Use `camelCase` for variables/functions,
`PascalCase` for types/classes, and descriptive names such as `findPath` and
`spawnInterval`. Keep tunable gameplay values in `src/economy.ts`. Use Node
stdlib APIs before adding dependencies.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`, with files named `*.test.ts`.
Cover each simulation rule—especially BFS, tick ordering, combat, traps,
occupancy, spawning, and mana validation. Keep tests deterministic: call tick
functions directly and avoid real timers. Rendering and readline wiring are
thin and may be verified manually.

## Commits and Pull Requests

Use short, imperative commit subjects consistent with history, such as
`Add grid module` or `Resolve combat ordering`. Keep commits focused. Pull
requests should summarize behavior changes, link the relevant design or
issue, list commands and results, and mention manual terminal checks or
balance changes. Include screenshots only when terminal rendering changes.

## Agent Workflow

Read the applicable design in `docs/superpowers/specs/` before changing game
rules. Preserve the pure-simulation/I/O boundary, update tests with behavior
changes, run `npm test` and `npx tsc --noEmit`, and inspect the final diff for
unrelated edits.
