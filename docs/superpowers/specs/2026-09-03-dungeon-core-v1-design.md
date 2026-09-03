# Dungeon Core v1 — Design

## Concept

A "dungeon core" management game, terminal-based. The player is the dungeon
itself: dig rooms, spawn monsters, place traps. Adventurers periodically
spawn and path toward the core to kill it; defeating them yields mana, the
currency spent on digging/spawning/trapping. Reaching the core with a living
adventurer ends the run.

## Platform & Stack

- **Language**: TypeScript on Node.js.
- **Rendering**: plain terminal output — clear screen, print an ASCII grid
  and a status line. No TUI framework.
- **Input**: Node's built-in `readline`, parsing simple text commands.
- **Dependencies**: TypeScript + `ts-node` (or a build step) only. No game
  engine, no UI framework, no pathfinding library (BFS is trivial to write
  and the grid is small).

## Core Loop

Real-time with pause:

- A single `setInterval`-driven tick advances the simulation (entity
  movement, combat resolution, mana income).
- `pause` / `resume` commands stop/restart that interval. This is the only
  place real-time concerns (timers) live — everything else is a plain
  function call per tick.
- Commands are read continuously via `readline` regardless of pause state,
  so the player can dig/spawn/trap while paused or running.

## Data Model

- **Grid**: 2D array of cells. Each cell: `wall | floor | core`. Digging
  converts a `wall` cell to `floor` if it is orthogonally adjacent to an
  existing `floor` or `core` cell (prevents disconnected rooms).
- **Core**: single fixed cell, start of the dungeon, holds the mana pool.
- **Entities** (monsters and adventurers): plain objects — `{ id, kind, pos,
  hp, maxHp, attack }`. Both share a shape; behavior differs by controller
  (see below), not by class hierarchy.
- **Traps**: placed on a `floor` cell, object `{ pos, kind, damage,
  consumed }`. Triggers once when an adventurer enters its cell, then is
  removed (or marked consumed) — no reset/reload mechanic in v1.
- **Mana**: single number on the core. Spending is validated at command time
  (reject if insufficient); income comes from adventurer defeats.

## Behavior

- **Adventurer spawn**: on a fixed interval (every N ticks), a new
  adventurer appears at a designated entrance cell if one isn't already en
  route.
- **Adventurer AI**: BFS pathfind from current position to the core's cell
  each tick (grid is small enough this is cheap; no caching needed for v1).
  Move one step along the path per tick. If a monster occupies the next
  cell, fight instead of moving.
- **Monster AI**: static — stays on its placed cell, attacks any adventurer
  that enters or is adjacent, each tick, until one side dies.
- **Combat**: simple — each tick both sides deal `attack` damage to the
  other until one hp <= 0. No turn order/initiative system for v1.
- **Trap trigger**: when an adventurer's move lands it on a trap cell, apply
  damage once, mark the trap consumed (removed from the grid).
- **Win/loss (per run)**: adventurer reaching the core's cell = loss, ends
  the tick loop. No win condition in v1 — it's an endless survive-and-grow
  loop; "win" is just staying alive / growing mana over time.

## Commands

Parsed as whitespace-split tokens, dispatched via a lookup by first token:

- `dig x y` — convert wall→floor at (x,y) if adjacent to existing floor.
- `spawn <monsterKind> x y` — place a monster on a floor cell, deduct mana.
- `trap <trapKind> x y` — place a trap on a floor cell, deduct mana.
- `pause` / `resume` — stop/start the tick interval.
- `quit` — exit the process.

Invalid commands (bad coords, insufficient mana, occupied cell, unknown
kind) print a one-line error to the terminal and are otherwise ignored —
no exceptions thrown across the command boundary.

## Rendering

Each tick (and after each command), clear the screen and print:

- The grid: one character per cell (wall/floor/core/monster/adventurer/trap
  — entities drawn over their cell's terrain).
- A status line: current mana, tick count, adventurer count, paused/running.

## Error Handling

- Command parsing/validation errors are caught at the command-dispatch
  boundary and reported as a printed message — they never crash the tick
  loop.
- Simulation code (movement, combat, pathfinding) assumes valid internal
  state (it's the only writer to that state) — no defensive checks inside
  the tick loop itself.

## Testing

- Unit tests (Node's built-in `node:test` + `assert` — no test framework
  dependency) for: dig adjacency rule, BFS pathfinding on a known grid,
  combat resolution, trap trigger/consumption, mana spend/refund
  validation.
- No end-to-end/terminal-rendering tests in v1 — rendering is a thin
  print layer over tested state.

## Explicitly Out of Scope for v1

- Loot tables, item drops.
- Multiple adventurer classes/behaviors (only one generic adventurer type).
- Room types/specialization, synergy bonuses.
- Save/load, persistence between runs.
- Difficulty scaling / wave design.
- Trap reset/reload.
- Any graphical or TUI-framework rendering.
