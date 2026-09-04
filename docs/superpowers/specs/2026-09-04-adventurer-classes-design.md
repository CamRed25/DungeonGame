# Adventurer Classes — Design

## Concept

v1 shipped one generic adventurer type. This introduces four adventurer
classes, each with a distinct combat/movement trait on top of the usual
hp/attack stats, spawning at random per the weight table below.

**Supersedes v1.** `docs/superpowers/specs/2026-09-03-dungeon-core-v1-design.md`
described a single generic adventurer. This spec replaces its **Data
Model** (`Adventurer` shape), **Adventurer spawning**, **Adventurer
pathing**, **Tick resolution order** steps 2, 3, 5, and 6 (combat pairing/
damage, movement, trap check), and **Rendering & Feedback** (adventurer
glyph) sections, and removes "Multiple adventurer classes/behaviors" from
v1's "Explicitly Out of Scope" list. Everything else in the v1 spec (grid
rules, monster/trap kinds, commands, economy defaults not listed below,
tick steps 1, 4, 7, and 8) is unchanged.

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

`AdventurerKind` (`state.ts`) — a closed union, not an arbitrary string.
Unlike `Monster.kind` (plain `string`, unchanged — v2 still ships one
monster kind), an adventurer's kind selects real movement/combat logic
below, so a typo should be a compile error, not a silent no-op at runtime:

```ts
export type AdventurerKind = 'warrior' | 'scout' | 'mage' | 'rogue';
```

`Adventurer` gains a `kind: AdventurerKind` field. `hp`, `maxHp`, and
`attack` continue to be copied onto the entity at spawn time from the
registry below, not looked up on every tick.

`AdventurerKindDef` (`economy.ts`), mirroring the existing `MonsterKindDef`
pattern:

```ts
export interface AdventurerKindDef {
  name: string;
  hp: number;
  attack: number;
  moveSpeed: number;    // cells moved per tick
  attackRange: number;  // Manhattan distance at which this class can attack a monster
  avoidsTraps: boolean; // pathfinds around known trap cells
}

export const ADVENTURER_KINDS: Record<AdventurerKind, AdventurerKindDef> = {
  warrior: { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false },
  scout:   { name: 'scout',   hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false },
  mage:    { name: 'mage',    hp: 8,  attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false },
  rogue:   { name: 'rogue',   hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true },
};

export const ADVENTURER_SPAWN_WEIGHTS: Record<AdventurerKind, number> = {
  warrior: 40, scout: 30, rogue: 20, mage: 10,
};
```

**Distance metric**: the grid only supports orthogonal movement (`Grid.neighbors`
returns the 4 orthogonal cells; there is no diagonal movement anywhere in
this game). Range checks therefore use **Manhattan distance**
(`|dx| + |dy|`), not Chebyshev — Chebyshev distance ≤ 1 would incorrectly
include diagonal neighbors, which nothing else in the game treats as
adjacent. Manhattan distance ≤ 1 is exactly equivalent to v1's "occupies
the cell or is orthogonally adjacent" rule, so default-range classes are
unchanged from v1 behavior.

## Spawning

`maybeSpawnAdventurer` (`spawning.ts`) picks a class via weighted-random
selection over `ADVENTURER_SPAWN_WEIGHTS` on each spawn tick. To keep this
testable without flaky statistical assertions, the selection logic is
split into a pure function and an injectable random source:

```ts
// Pure, deterministic — test directly with fixed roll values.
export function selectAdventurerKind(
  weights: Record<AdventurerKind, number>,
  roll: number, // caller-supplied value in [0, 1)
): AdventurerKind {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let cursor = roll * total;
  for (const [kind, weight] of Object.entries(weights) as [AdventurerKind, number][]) {
    if (cursor < weight) return kind;
    cursor -= weight;
  }
  // unreachable given roll < 1, but keeps the return type total
  return 'warrior';
}

export function maybeSpawnAdventurer(
  state: GameState,
  rng: () => number = Math.random,
): Adventurer | null {
  // ...existing spawn-timing/path-exists checks, unchanged...
  const kind = selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, rng());
  // ...build Adventurer from ADVENTURER_KINDS[kind]...
}
```

Tests call `selectAdventurerKind` directly with boundary roll values (e.g.
`0`, `0.39999`, `0.4`, `0.99999`) to assert exact kind selection — no
randomness involved. A test for `maybeSpawnAdventurer` itself passes a
fake `rng` (e.g. `() => 0.5`) to assert it wires the roll through
correctly and stamps the right stats onto the spawned entity. The
`spawnInterval`/path-exists timing tests from v1 are unaffected (they
don't need to inspect `kind`, so they can omit `rng` and rely on the
`Math.random` default).

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
everyone else, preserving the existing spec invariant. The path used for a
tick's movement (see Movement below) is computed once at the start of that
tick, same as v1 — a scout's second sub-step this tick consumes the next
cell of that same path, it does not trigger a fresh BFS call.

## Combat

v1 defined a single symmetric "paired" relationship (adventurer within
range of monster ⇒ both deal damage to each other). That collapses under
asymmetric ranges: a mage attacking from 3 cells away must not
automatically grant the monster a retaliatory hit it has no way to land.
This replaces "combat pairs" (v1 tick-resolution step 2) with two
directional checks, both evaluated from the same start-of-tick snapshot
used elsewhere in tick resolution:

```ts
function adventurerCanAttackMonster(a: Adventurer, m: Monster): boolean {
  return manhattanDistance(a.pos, m.pos) <= ADVENTURER_KINDS[a.kind].attackRange;
}

function monsterCanAttackAdventurer(m: Monster, a: Adventurer): boolean {
  // No monster kind has a ranged attack in v2 — always adjacency (range 1).
  // Revisit if a future monster kind needs its own attackRange field.
  return manhattanDistance(m.pos, a.pos) <= 1;
}
```

Revised tick-resolution steps 2–3 (replacing v1's):

2. **Determine attack relations** from the snapshot: for every
   (adventurer, monster) pair, evaluate both
   `adventurerCanAttackMonster` and `monsterCanAttackAdventurer`
   independently. A given pair may have neither, either, or both true (a
   warrior standing next to a monster has both true, same as v1; a mage 3
   cells out has only the first true).
3. **Apply damage simultaneously**, using start-of-tick hp for everyone:
   every monster with `adventurerCanAttackMonster` true takes that
   adventurer's `attack`; every adventurer with `monsterCanAttackAdventurer`
   true takes that monster's `attack`. A pair with only one relation true
   deals damage in one direction only that tick.

Steps 1, 4, 7, and 8 of the v1 tick order (snapshot, remove the dead, loss
check, mana income) are unchanged in structure. Step 6 ("trap check") is no
longer a separate pass — it's folded into the per-substep movement loop
below, since a multi-step mover (scout) can land on a trap mid-tick and
must resolve it before its next substep, not after all movement finishes.

## Movement

v1's rule: "each surviving adventurer moves one step along its path unless
the next cell holds a living monster, using post-combat monster state."
This generalizes to a per-adventurer loop bounded by `moveSpeed`, making
trap resolution an explicit per-substep event rather than something that
only happens after all movement:

```
remainingSteps = ADVENTURER_KINDS[adventurer.kind].moveSpeed
while remainingSteps > 0:
  nextCell = next cell on this tick's precomputed path (none if already at core)
  if nextCell is undefined: break                      // already at destination
  if a living monster occupies nextCell: break          // blocked; stop for this tick
  adventurer.pos = nextCell
  remainingSteps -= 1
  if a trap occupies nextCell:
    apply trap damage to adventurer; delete the trap
    if adventurer.hp <= 0:
      remove adventurer from state; stop (no further substeps — it's dead)
  if adventurer.pos == core.pos:
    break                                                // loss check (step 7) handles this
```

Concretely for scout (`moveSpeed: 2`): it can move into a cell, survive a
trap there, and immediately move into a second cell (and possibly trigger
a second trap) in the same tick. If the first landing's trap kills it, the
second step never happens — the trap resolves immediately after that
landing, not once at the end of all movement. Every other class has
`moveSpeed: 1`, so this loop runs its body at most once for them —
byte-for-byte the same outcome as v1.

The combat-pairing/damage step (step 2–3 above) still happens once per
tick, entirely before this movement loop runs — a scout's second substep
this tick does not create or resolve any new attack relation until next
tick's snapshot.

## Rendering

Each class gets its own single-character glyph in `render.ts`, replacing
the single `adventurer: 'A'` entry in `GLYPHS`:

| Class | Glyph |
|---|---|
| `warrior` | `W` |
| `scout` | `S` |
| `mage` | `M` |
| `rogue` | `R` |

None of these collide with existing glyphs (`#` wall, `.` floor, `C` core,
`m` monster, `t` trap). `M` (mage) and `m` (monster) are visually close but
distinguishable by case — this follows the existing convention already in
`GLYPHS` (adventurer-side entities uppercase: `A`, `C`; dungeon-side
entities lowercase: `m`, `t`), which this change preserves rather than
introduces.

Adventurers still have no occupancy limit (v1 rule, unchanged), so two
different classes can now visibly share a cell — when they do, render the
glyph of the first adventurer found at that cell in `state.adventurers`
array order (matches the existing lookup pattern; arbitrary but
deterministic — not worth a stacking indicator for a single terminal
cell). Existing adventurer > monster > trap > terrain cell precedence is
unchanged. `status`/event text (`commands.ts`, `combat.ts` event strings)
includes the class name, e.g. `Scout hit by Goblin for 3 damage.`

## Adventurer Kinds (v2 defaults)

Not final balance — tune after playtesting, same as the rest of the
economy table.

| Class | Glyph | hp | attack | moveSpeed | attackRange | avoidsTraps | Spawn weight |
|---|---|---|---|---|---|---|---|
| `warrior` | `W` | 24 | 6 | 1 | 1 | no | 40% |
| `scout` | `S` | 10 | 3 | 2 | 1 | no | 30% |
| `rogue` | `R` | 10 | 4 | 1 | 1 | yes | 20% |
| `mage` | `M` | 8 | 5 | 1 | 3 | no | 10% |

## Error Handling

No new player-facing error paths — class selection happens inside
`maybeSpawnAdventurer`, which isn't a command a player invokes directly.

## Testing

- `combat.test.ts`:
  - `adventurerCanAttackMonster`/`monsterCanAttackAdventurer` as pure
    Manhattan-distance checks (unit tests, no tick involved).
  - Ranged asymmetry: mage at distance 3 damages a monster; that monster
    does not damage the mage back that tick (monster only retaliates once
    adjacent on a later tick).
  - Scout 2-cell movement: moves twice in one tick along its path.
  - Scout dies to a trap on its first landing: does not take a second
    step, is removed from state, mana is credited once.
  - Combat pairing/damage is still computed exactly once per tick
    regardless of `moveSpeed` (scout's second substep doesn't create a
    same-tick attack relation).
- `pathfinding.test.ts`: `avoid` set causes `findPath` to route around
  blocked cells; falls back to the unrestricted path when `avoid` would
  make the destination unreachable.
- `spawning.test.ts`:
  - `selectAdventurerKind` with fixed boundary `roll` values asserts exact
    kind selection deterministically (no statistical/flaky tests).
  - `maybeSpawnAdventurer` with an injected fake `rng` asserts the roll is
    wired through and the spawned entity's stats match
    `ADVENTURER_KINDS[kind]`.
  - Existing spawn-timing/path-exists tests from v1 need no changes (they
    can omit the `rng` argument).

## Explicitly Out of Scope for This Spec

- Difficulty scaling / wave-based class unlocks (roadmap item #2 — classes
  ship with static weights from tick 0).
- Loot tables, adventurer-specific drops.
- Monster classes gaining ranged attacks or trap avoidance of their own
  (`monsterCanAttackAdventurer` is hardcoded to range 1 for this reason).
- Per-class rendering beyond a single glyph (no color, no animation).
