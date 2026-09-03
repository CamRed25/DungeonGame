# Dungeon Core v1 — Design

## Concept

A "dungeon core" management game, terminal-based. The player is the dungeon
itself: dig rooms, spawn monsters, place traps. Adventurers periodically
spawn and path toward the core to kill it; defeating them yields mana, the
currency spent on digging/spawning/trapping. Reaching the core with a living
adventurer ends the run (a survival run with a loss condition — there is no
win state in v1).

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

## Initial State

- **Grid**: 20 cells wide × 12 tall.
- **Core**: fixed at `(2, 6)`.
- **Entrance**: fixed at `(17, 6)`, starts as a `floor` cell, but is
  otherwise disconnected from the core (surrounded by `wall`) — the player
  must dig a connected route before adventurers can path in.
- **Starting mana**: 50.

## Data Model

- **Grid**: 2D array of cells. Each cell: `wall | floor | core`. Digging
  converts a `wall` cell to `floor` if it is orthogonally adjacent to an
  existing `floor` or `core` cell (prevents disconnected rooms). Digging
  the core cell, the entrance cell, or an already-`floor` cell is invalid.
- **Core**: single fixed cell, holds the mana pool.
- **Entities** (monsters and adventurers): plain objects — `{ id, kind, pos,
  hp, maxHp, attack }`. Both share a shape; behavior differs by controller
  (see below), not by class hierarchy.
- **Traps**: placed on a `floor` cell, object `{ pos, kind, damage }`.
  Triggers once when an adventurer's move lands it on the trap's cell, then
  is deleted from state — no `consumed` flag, no reset/reload in v1.
- **Mana**: single number on the core. Spending is validated at command time
  (reject if insufficient); income comes from adventurer defeats.

## Occupancy Rules

- **Adventurers**: no occupancy limit — any number may share a cell.
- **Monsters**: exactly one per cell.
- **Traps**: exactly one per cell; a trap and a monster may coexist on the
  same cell.
- Monsters and traps may not be placed on the core cell or the entrance
  cell.

## Behavior

### Adventurer spawning

Every `spawnInterval` ticks: if a path exists from the entrance to the core
(BFS check), spawn a new adventurer at the entrance. If no path exists,
skip spawning for that interval and check again next interval. There is no
cap on concurrent adventurers and no queue — since adventurers don't block
each other's cell occupancy, a missing/blocked entrance never needs special
handling beyond "no path → don't spawn."

### Adventurer pathing

Each adventurer BFS-pathfinds from its current cell to the core each tick
(grid is small enough this is cheap; no path caching in v1).

### Tick resolution order

1. **Snapshot** all entity positions at the start of the tick.
2. **Determine combat pairs** from the snapshot: a monster and an
   adventurer are paired if the adventurer occupies the monster's cell or
   an orthogonally adjacent cell. A monster may be paired with multiple
   adventurers at once; each paired adventurer also fights every monster
   it's paired with.
3. **Apply damage simultaneously**: every paired monster deals `attack` to
   every adventurer it's paired with, and vice versa, all using
   start-of-tick hp. This is why the pairing happens against the snapshot,
   not against positions updated mid-tick.
4. **Remove the dead** (hp <= 0). Dead entities take no further action this
   tick — they don't move, attack, or trigger traps.
5. **Move surviving adventurers**: any adventurer that was *not* paired in
   a combat this tick advances one step along its BFS path. (An adventurer
   paired in combat is, by the adjacency rule above, already standing next
   to or on a monster's cell, so it naturally stays put and fights instead
   of walking through — no separate "blocked by monster" case needed.)
6. **Trap check**: for each adventurer that just moved onto a trap's cell,
   apply the trap's damage once and delete the trap. Remove the adventurer
   if this kills it.
7. **Loss check**: if any adventurer occupies the core's cell, the run
   ends (see Pause/End behavior).
8. **Mana income**: for every adventurer that died this tick (combat or
   trap), add `manaPerKill` to the core's mana.

## Commands

Parsed as whitespace-split tokens, dispatched via a lookup by first token:

- `dig x y` — convert wall→floor at (x,y) if adjacent to existing floor.
- `spawn <monsterKind> x y` — place a monster on an empty floor cell,
  deduct mana.
- `trap <trapKind> x y` — place a trap on a floor cell without an existing
  trap, deduct mana.
- `pause` — stop the tick interval. No-op with a printed message
  (`Already paused.`) if already paused.
- `resume` — restart the tick interval. No-op with a printed message
  (`Already running.`) if already running. Never creates a second timer —
  the loop controller holds a single interval handle.
- `status` — print core position, entrance position, current mana, tick
  count, and a list of alive monsters/adventurers (kind, pos, hp) and
  active traps.
- `help` — print the command list.
- `quit` — clear the interval (if any), close readline, exit the process.

Invalid commands (bad coords, insufficient mana, occupied cell, unknown
kind, dig target invalid) print a one-line error to the terminal and are
otherwise ignored — no exceptions thrown across the command boundary.

Once a run has ended (loss), all gameplay commands print
`Run over — type quit to exit.` and are ignored; `quit` still works.

## Rendering & Feedback

Each tick (and after each command), clear the screen and print:

- The grid: one character per cell (wall/floor/core/monster/adventurer/trap
  — entities drawn over their cell's terrain).
- A status line: current mana, tick count, adventurer count, paused/running.
- One line per notable event that occurred that tick (combat damage,
  trap trigger, adventurer defeated + mana gained, adventurer reaching the
  core). No output if nothing happened that tick — avoid empty-tick spam.
  Examples:
  - `Goblin hit Adventurer for 3 damage.`
  - `Trap triggered on Adventurer for 6 damage.`
  - `Adventurer defeated: +12 mana.`

## Economy Defaults

Starting numbers, deliberately generous so the loop is easy to play and
tune after trying it — not final balance:

| Value | Default |
|---|---|
| Starting mana | 50 |
| Dig cost | 2 mana/cell |
| Monster cost | 15 mana |
| Monster hp / attack | 10 / 3 |
| Trap cost | 8 mana |
| Trap damage | 6 |
| Mana per adventurer defeated | 12 |
| Tick duration | 1000ms |
| Spawn interval | every 10 ticks |

Monsters persist after combat (reusable); traps are consumed on trigger
(single-use), matching their relative cost.

## Error Handling

- Command parsing/validation errors are caught at the command-dispatch
  boundary and reported as a printed message — they never crash the tick
  loop.
- Simulation code (movement, combat, pathfinding) assumes valid internal
  state (it's the only writer to that state) — no defensive checks inside
  the tick loop itself.

## Testing

Unit tests via Node's built-in `node:test` + `assert` — no test framework
dependency:

- Dig adjacency rule (valid/invalid targets, including core/entrance).
- BFS pathfinding returns the shortest path on a known grid.
- Adventurer moves exactly one step per tick along that path.
- Spawn only occurs when an entrance→core path exists; skipped otherwise.
- Spawn interval timing (spawns only every `spawnInterval` ticks).
- Simultaneous combat: pairing computed from start-of-tick snapshot,
  damage applied to both sides using pre-tick hp, correct deaths.
- A monster damages every adventurer paired with it in one tick (occupying
  or adjacent), not just one.
- Trap trigger applies damage once and removes the trap from state.
- Mana spend validation (rejects insufficient funds) and mana refund on
  kill.
- Occupancy validation: rejects a second monster/trap on an occupied cell,
  rejects monster/trap placement on core or entrance.
- Pause/resume idempotency: repeated `pause` or `resume` doesn't create a
  duplicate interval or throw.
- Reaching the core ends the run and blocks further gameplay commands
  (except `quit`).

No end-to-end/terminal-rendering tests in v1 — rendering is a thin print
layer over tested state.

## Explicitly Out of Scope for v1

- Loot tables, item drops.
- Multiple adventurer classes/behaviors (only one generic adventurer type).
- Room types/specialization, synergy bonuses.
- Save/load, persistence between runs.
- Difficulty scaling / wave design.
- Trap reset/reload.
- Any graphical or TUI-framework rendering.
