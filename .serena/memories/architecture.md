# Architecture

Dependency order — each module imports only from ones before it:

```
grid.ts → economy.ts → pathfinding.ts → state.ts → placement.ts → spawning.ts → combat.ts
                                                                                      ↓
                                                          loop.ts → commands.ts → render.ts → main.ts
```

- `grid.ts` — `Grid` class: cell types (wall/floor/core), dig-adjacency rule, neighbor lookup. Terrain only.
- `economy.ts` — every tunable game number lives here (grid size, core/entrance position, starting mana,
  costs, damage, hp, tick duration, spawn interval) plus monster/trap kind registries (`goblin`, `spike`).
  This is the one file to edit for balance changes — nothing else hardcodes a game number.
- `pathfinding.ts` — BFS `findPath`/`pathExists`. Terrain-only: monsters/traps/adventurers never block
  a path, only walls do.
- `state.ts` — `GameState`, entity types (`Monster`, `Adventurer`, `Trap`), `createGameState()`,
  position-lookup helpers (`monsterAt`, `trapAt`, `adventurersAt`, `samePos`).
- `placement.ts` — validated player actions: `digCell`, `spawnMonster`, `placeTrap`. Each returns
  `ActionResult` (`{ok:true} | {ok:false, error}`) rather than throwing — invalid input is data, not
  an exception, all the way up to the command layer.
- `spawning.ts` — `maybeSpawnAdventurer`: periodic spawn rule (every `SPAWN_INTERVAL_TICKS`), only if a
  path currently exists from entrance to core.
- `combat.ts` — `runTick`, the core simulation function. Implements the spec's 8-step tick order in one
  place: snapshot combat pairs → simultaneous damage → remove the dead → move survivors (blocked only by
  a *living* monster on the next path cell — a monster that died this tick no longer blocks) → trap
  trigger → loss check → mana income. This ordering (snapshot-based pairing, post-combat movement) is
  deliberate and documented in the spec — don't reorder steps without reading why first.
- `loop.ts` — `TickLoop`: wraps a single `setInterval` handle. `pause`/`resume`/`start` are idempotent
  by construction (checking the handle before acting), not by caller-tracked state.
- `commands.ts` — `handleCommand`: parses a text line, dispatches to `placement.ts`/`loop.ts`, returns
  lines to print. Gameplay commands (`dig`/`spawn`/`trap`/`pause`/`resume`) are blocked once
  `runState === 'over'`; `status`/`help`/`quit` remain available.
- `render.ts` — `render(state, events)`: builds the full screen string. Cell-content precedence when
  multiple things occupy a cell: adventurer > monster > trap > terrain.
- `main.ts` — composition root wiring readline input, `TickLoop`, `runTick`, `handleCommand`, `render`.
  Nothing here is imported by anything else.
