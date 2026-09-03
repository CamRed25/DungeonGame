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

- **Coordinates**: `(0, 0)` is the top-left cell; `x` increases rightward,
  `y` increases downward.
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
- **Monsters**: at most one per cell. Placing a monster is rejected only if
  the target cell already has a monster — an existing trap on that cell
  does not block it.
- **Traps**: at most one per cell. Placing a trap is rejected only if the
  target cell already has a trap — an existing monster on that cell does
  not block it.
- A cell may therefore hold one monster *and* one trap at the same time.
- Monsters and traps may not be placed on the core cell or the entrance
  cell.

## Behavior

### Adventurer spawning

Every `spawnInterval` ticks (first spawn at tick `spawnInterval`, not tick
0): if a path exists from the entrance to the core (BFS check), spawn a
new adventurer at the entrance. If no path exists, skip spawning for that
interval and check again next interval. There is no cap on concurrent
adventurers and no queue — since adventurers don't block each other's cell
occupancy, a missing/blocked entrance never needs special handling beyond
"no path → don't spawn."

### Adventurer pathing

Each adventurer BFS-pathfinds from its current cell to the core each tick
(grid is small enough this is cheap; no path caching in v1). BFS considers
terrain only (`wall` blocks, `floor`/`core` are passable) — it ignores
monsters, traps, and other adventurers entirely, so entity placement can
never make the path-existence check (used for spawning) or a path itself
disappear. Concretely: a trap or a monster sitting anywhere on the
entrance→core route does not block the spawn check — it just means the
first adventurer to reach it fights or triggers it.

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
   not against positions updated mid-tick. An adventurer attacks every
   monster it's paired with, including a monster it's merely passing
   beside (adjacent, not occupying) rather than walking into.
4. **Remove the dead** (hp <= 0). Dead entities take no further action this
   tick — they don't move, attack, or trigger traps.
5. **Move surviving adventurers**: combat does not by itself stop movement.
   Each surviving adventurer moves one step along its BFS path *unless*
   the next cell on that path contains a living monster, in which case it
   stays in place. So an adventurer merely adjacent to a monster (but not
   walking into its cell) still advances each tick, taking chip damage as
   it passes; a monster actually standing in the corridor blocks progress
   and becomes a real chokepoint. This check uses post-combat entity
   state (after step 4): if the monster occupying the next cell died in
   this tick's combat, the adventurer is free to move into that cell in
   the same tick.
6. **Trap check**: for each adventurer that just moved onto a trap's cell
   (including a cell it entered because a monster there just died), apply
   the trap's damage once and delete the trap. Remove the adventurer if
   this kills it.
7. **Loss check**: if any adventurer occupies the core's cell, the run
   ends (see Pause/End behavior).
8. **Mana income**: for every adventurer that died this tick (combat or
   trap), add `manaPerKill` to the core's mana.

## Commands

Parsed as whitespace-split tokens, dispatched via a lookup by first token:

- `dig x y` — convert wall→floor at (x,y) if adjacent to an existing floor
  or core cell.
- `spawn <monsterKind> x y` — place a monster on a floor cell with no
  existing monster (a trap there is fine), deduct mana. `monsterKind` is
  one of the kinds listed in Monster & Trap Kinds below.
- `trap <trapKind> x y` — place a trap on a floor cell with no existing
  trap (a monster there is fine), deduct mana. `trapKind` is one of the
  kinds listed below.
- `pause` — stop the tick interval. No-op with a printed message
  (`Already paused.`) if already paused.
- `resume` — restart the tick interval. No-op with a printed message
  (`Already running.`) if already running. Never creates a second timer —
  the loop controller holds a single interval handle.
- `status` — print core position, entrance position, current mana, tick
  count, run state (running/paused/over), and a list of alive
  monsters/adventurers (kind, pos, hp) and active traps.
- `help` — print the command list.
- `quit` — clear the interval (if any), close readline, exit the process.

Invalid commands (bad coords, insufficient mana, occupied cell, unknown
kind, dig target invalid) print a one-line error to the terminal and are
otherwise ignored — no exceptions thrown across the command boundary.

Once a run has ended (loss), all gameplay commands print
`Run over — type quit to exit.` and are ignored; `quit` still works.

## Rendering & Feedback

After every tick, and after every command, clear the screen and print:

- The grid: one character per cell. Rendering precedence when a cell holds
  more than one thing: adventurer > monster > trap > terrain.
- A status line: current mana, tick count, adventurer count, and run state
  (running/paused/over).
- Event lines, per the timing rule below.

**Event timing**: simulation event lines (combat damage, trap triggers,
adventurer deaths, adventurer reaching the core) are only generated by tick
resolution and appear on the redraw that follows a tick — never output if
nothing happened that tick, to avoid empty-tick spam. Command errors are
different: they print immediately on the redraw that follows the command
that caused them, independent of the tick loop. Examples of tick events:
  - `Goblin hit Adventurer for 3 damage.`
  - `Trap triggered on Adventurer for 6 damage.`
  - `Adventurer defeated: +12 mana.`

## Monster & Trap Kinds

v1 ships one supported kind of each. `spawn`/`trap` reject any other kind
name with an "Unknown kind" error.

| Monster kind | Cost | hp | attack |
|---|---|---|---|
| `goblin` | 15 mana | 10 | 3 |

| Trap kind | Cost | Damage |
|---|---|---|
| `spike` | 8 mana | 6 |

Surviving monsters remain in place indefinitely; dead monsters are
removed. Traps are consumed (deleted) the first time they trigger.

## Economy Defaults

Starting numbers, deliberately generous so the loop is easy to play and
tune after trying it — not final balance:

| Value | Default |
|---|---|
| Starting mana | 50 |
| Dig cost | 2 mana/cell |
| Mana per adventurer defeated | 12 |
| Tick duration | 1000ms |
| Spawn interval | every 10 ticks (first spawn at tick 10) |

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
- An adventurer merely adjacent to a monster (not blocked) still moves that
  tick; an adventurer whose next path cell contains a living monster stays
  in place instead.
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
