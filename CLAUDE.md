# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A terminal-based "dungeon core" management game. The player is the dungeon itself: dig rooms, spawn monsters, place traps. Adventurers periodically spawn and path toward the core; defeating them yields mana, spent on digging/spawning/trapping. An adventurer reaching the core ends the run. Real-time simulation (a tick every second) with `pause`/`resume`.

Design spec: `docs/superpowers/specs/2026-09-03-dungeon-core-v1-design.md` — the source of truth for every game rule (grid/occupancy rules, tick resolution order, economy defaults, command behavior). Implementation plan: `docs/superpowers/plans/2026-09-03-dungeon-core-v1.md`. Read the spec before changing simulation behavior — it documents *why* rules are shaped the way they are (e.g. why combat pairing is snapshot-based, why movement checks post-combat monster state).

## Commands

```bash
npm install          # install deps (Node 20+ required — node --test glob support)
npm test              # run the full test suite (node:test, no framework)
npm run dev            # play the game interactively
npx tsc --noEmit        # type-check
```

Run a single test file: `node -r ts-node/register --test tests/combat.test.ts`
Filter to one test by name: `node -r ts-node/register --test --test-name-pattern="<substring>" tests/combat.test.ts`

There is no build step for development — `ts-node` runs `.ts` sources directly (CommonJS, registered via `-r ts-node/register`).

## Architecture

The codebase is split along an I/O line: everything below it is a pure, synchronous function of `GameState` and is unit-tested; everything above it is untested-by-design integration glue (the spec explicitly excludes end-to-end/rendering tests).

**Dependency order** (each module only imports from ones before it):

```
grid.ts → economy.ts → pathfinding.ts → state.ts → placement.ts → spawning.ts → combat.ts
                                                                                      ↓
                                                          loop.ts → commands.ts → render.ts → main.ts
```

- **`grid.ts`** — the `Grid` class: cell types (`wall`/`floor`/`core`), the dig-adjacency rule, neighbor lookup. No game concepts beyond terrain.
- **`economy.ts`** — every tunable number in the game (grid size, core/entrance position, starting mana, costs, damage, hp, tick duration, spawn interval) plus the monster/trap kind registries (`goblin`, `spike`). This is the one file to edit for balance changes — nothing else hardcodes a game number.
- **`pathfinding.ts`** — BFS `findPath`/`pathExists`. Terrain-only: it has no concept of entities, so monsters/traps/adventurers never block a path — only walls do.
- **`state.ts`** — `GameState` and the entity types (`Monster`, `Adventurer`, `Trap`), `createGameState()`, and position-lookup helpers (`monsterAt`, `trapAt`, `adventurersAt`, `samePos`).
- **`placement.ts`** — validated player actions: `digCell`, `spawnMonster`, `placeTrap`. Each returns `ActionResult` (`{ok: true} | {ok: false, error}`) rather than throwing — invalid input is data, not an exception, all the way up to the command layer.
- **`spawning.ts`** — `maybeSpawnAdventurer`: the periodic-spawn rule (every `SPAWN_INTERVAL_TICKS`, only if a path currently exists from entrance to core).
- **`combat.ts`** — `runTick`, the core simulation function. Implements the spec's 8-step tick order in one place: snapshot combat pairs → simultaneous damage → remove the dead → move survivors (blocked only by a *living* monster on the next path cell — a monster that died this tick no longer blocks) → trap trigger → loss check → mana income. This ordering (snapshot-based pairing, post-combat movement) is deliberate and documented in the spec; don't reorder steps without reading why first.
- **`loop.ts`** — `TickLoop`: wraps a single `setInterval` handle. `pause`/`resume`/`start` are idempotent by construction (checking the handle before acting) rather than by the caller tracking state.
- **`commands.ts`** — `handleCommand`: parses a text line, dispatches to `placement.ts`/`loop.ts`, returns lines to print. Gameplay commands (`dig`/`spawn`/`trap`/`pause`/`resume`) are blocked once `runState === 'over'`; `status`/`help`/`quit` remain available.
- **`render.ts`** — `render(state, events)`: builds the full screen string. Rendering precedence when a cell holds multiple things: adventurer > monster > trap > terrain.
- **`main.ts`** — composition root: wires `readline` input, the `TickLoop`, `runTick`, `handleCommand`, and `render` together. Nothing here is imported by anything else.

## Conventions worth knowing before editing

- Coordinates: `(0, 0)` is top-left; `x` increases right, `y` increases down.
- Occupancy is per-type, not per-cell: a monster and a trap may share a cell; two monsters (or two traps) may not. Neither may occupy the core or entrance cell. Adventurers have no occupancy limit.
- `GameState` is mutated in place by the simulation functions (`digCell`, `spawnMonster`, `runTick`, etc.) rather than returning a new state — this is deliberate for a single-process real-time loop, not an oversight.
