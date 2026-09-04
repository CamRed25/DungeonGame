# Conventions

- Coordinates: (0,0) is top-left; x increases right, y increases down.
- Occupancy is per-type, not per-cell: a monster and a trap may share a cell; two monsters (or two
  traps) may not. Neither may occupy the core or entrance cell. Adventurers have no occupancy limit.
- `GameState` is mutated in place by simulation functions (`digCell`, `spawnMonster`, `runTick`, etc.)
  rather than returning a new state — deliberate for a single-process real-time loop, not an oversight.
  Don't refactor these toward immutable/returning-new-state style.
- Player-facing action validation returns `ActionResult` (`{ok:true}|{ok:false, error}`), never throws.
- Tests live in `tests/*.test.ts`, one file per `src/*.ts` module, using `node:test` + `node:assert`
  directly (no framework/mocking library).
- Balance/tuning numbers belong exclusively in `economy.ts` — never hardcode a game number elsewhere.
