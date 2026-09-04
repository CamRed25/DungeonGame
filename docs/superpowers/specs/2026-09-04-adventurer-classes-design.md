# Adventurer Classes — Design

## Concept

v1 shipped one generic adventurer type. This introduces four adventurer
classes, each with a distinct combat/movement trait on top of the usual
hp/attack stats, spawning at random per the weight table below.

## v2 Roadmap Context

This is the first of several v2 sub-projects, each getting its own
spec → plan → implementation cycle rather than one combined effort. Planned
order and why:

1. **Adventurer classes** (this spec) — foundational; other items build on it.
2. **Difficulty scaling** — natural fit once classes exist (mix in tougher
   classes over time).
3. **Loot tables** — layers onto combat resolution, fairly isolated.
4. **Trap reset/reload** — small, isolated to placement/combat.
5. **Room specialization/synergies** — biggest lift, reshapes the grid/
   placement model.
6. **Save/load** — deferred until the state shape settles (after 1–5), so
   the serialization format isn't redesigned repeatedly.
7. **Graphical/TUI rendering** — purely presentational, easiest last since
   it needs to display everything above.

## Data Model

`AdventurerKindDef` (`economy.ts`), mirroring the existing `MonsterKindDef`
pattern:

```ts
interface AdventurerKindDef {
  name: string;
  hp: number;
  attack: number;
  moveSpeed: number;    // cells moved per tick
  attackRange: number;  // Chebyshev distance for combat pairing
  avoidsTraps: boolean; // pathfinds around known trap cells
}
```

```ts
ADVENTURER_KINDS: Record<string, AdventurerKindDef> = {
  warrior: { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false },
  scout:   { name: 'scout',   hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false },
  mage:    { name: 'mage',    hp: 8,  attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false },
  rogue:   { name: 'rogue',   hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true },
}

ADVENTURER_SPAWN_WEIGHTS: Record<string, number> = {
  warrior: 40, scout: 30, rogue: 20, mage: 10,
}
```

`Adventurer` (`state.ts`) gains a `kind: string` field, populated at spawn
time from the registry (same pattern `Monster.kind` already uses). `hp`,
`maxHp`, and `attack` continue to be copied onto the entity at spawn time,
not looked up from the registry on every tick.

## Spawning

`maybeSpawnAdventurer` (`spawning.ts`) picks a class via weighted-random
selection over `ADVENTURER_SPAWN_WEIGHTS` on each spawn tick, instead of
always creating the same stats. The spawn-timing rule (every
`SPAWN_INTERVAL_TICKS`, only if a path exists) is unchanged.

## Pathfinding (rogue trap avoidance)

`findPath` (`pathfinding.ts`) gains an optional `avoid?: Set<string>`
parameter (cell keys, `"x,y"`) — cells in this set are treated as blocked
during that BFS call, same as walls.

Each tick, a rogue's path is computed by calling `findPath` with the
current trap cells passed as `avoid`. If that returns no path, fall back to
a plain `findPath` call with no `avoid` set — a rogue always has *some*
route to the core; it just prefers one clear of traps when one exists. No
other adventurer class passes an `avoid` set, so `findPath`'s terrain-only
behavior (traps/monsters/adventurers never block a path) is unchanged for
everyone else, preserving the existing spec invariant.

## Combat

The pairing check in `runTick` (`combat.ts`) — currently
"adventurer occupies the monster's cell or is orthogonally adjacent to
it" — generalizes to "Chebyshev distance between adventurer and monster is
≤ `adventurer.attackRange`". Default classes use `attackRange: 1`
(equivalent to today's adjacency rule); mage uses `attackRange: 3`. No
line-of-sight check — walls don't block a mage's shot.

This is asymmetric by design: a monster only deals damage back to
adventurers *it* is paired with under the same range check, and monsters
have no ranged attack of their own (effectively range 1 for all monster
kinds) — so a monster can't hit a mage attacking it from 3 cells away
unless the monster closes the distance on a later tick.

## Movement

The existing per-tick "move one cell along the path, unless the next cell
holds a living monster; then check for a trap on the landing cell" logic
becomes a loop that repeats up to `adventurer.moveSpeed` times per tick,
stopping early if the adventurer dies (trap) or is blocked by a monster.
Every class but scout has `moveSpeed: 1`, so this loop runs exactly once for
them — behavior is unchanged from v1. Scout runs it twice: e.g. a scout can
move into a cell, survive a trap there, and then move again in the same
tick.

The combat-pairing snapshot (step 2 of tick resolution) still happens once
per tick, before any movement — a scout's second step this tick does not
create a new combat pairing until next tick.

## Rendering

Each class gets its own single-character glyph in `render.ts` (four new
glyphs; existing adventurer > monster > trap > terrain cell precedence is
unchanged). Adventurers still have no occupancy limit (v1 rule, unchanged),
so two different classes can now visibly share a cell — when they do,
render the first adventurer found at that cell in `state.adventurers`
array order (matches the existing lookup pattern; arbitrary but
deterministic, not worth tracking a stacking indicator for a two-character
terminal cell). `status`/event text (`commands.ts`, `combat.ts` event
strings) includes the class name, e.g. `Scout hit by Goblin for 3 damage.`

## Adventurer Kinds (v2 defaults)

Not final balance — tune after playtesting, same as the rest of the
economy table.

| Class | hp | attack | moveSpeed | attackRange | avoidsTraps | Spawn weight |
|---|---|---|---|---|---|---|
| `warrior` | 24 | 6 | 1 | 1 | no | 40% |
| `scout` | 10 | 3 | 2 | 1 | no | 30% |
| `rogue` | 10 | 4 | 1 | 1 | yes | 20% |
| `mage` | 8 | 5 | 1 | 3 | no | 10% |

## Error Handling

No new player-facing error paths — class selection happens inside
`maybeSpawnAdventurer`, which isn't a command a player invokes directly.

## Testing

- `combat.test.ts`: ranged pairing (mage hits a monster 2–3 cells away;
  monster doesn't hit back until adjacent), 2-cell movement (scout moves
  twice in one tick), scout dying to a trap mid-move (doesn't take its
  second step), combat pairing still computed once per tick regardless of
  `moveSpeed`.
- `pathfinding.test.ts`: `avoid` set causes `findPath` to route around
  blocked cells; falls back to the unrestricted path when `avoid` would
  make the destination unreachable.
- `spawning.test.ts`: weighted class distribution over many spawns
  (statistical, generous tolerance) lands close to
  `ADVENTURER_SPAWN_WEIGHTS`.

## Explicitly Out of Scope for This Spec

- Difficulty scaling / wave-based class unlocks (roadmap item #2 — classes
  ship with static weights from tick 0).
- Loot tables, adventurer-specific drops.
- Monster classes gaining ranged attacks or trap avoidance of their own.
- Per-class rendering beyond a single glyph (no color, no animation).
