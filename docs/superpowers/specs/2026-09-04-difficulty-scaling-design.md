# Difficulty Scaling — Design

## Concept

Adventurer classes are now established, but every run still uses the same
fixed pressure after the initial dungeon route is opened. This feature adds
hybrid difficulty scaling: elapsed time supplies a predictable baseline, while
player expansion and defenses influence the run's current challenge.

Difficulty scaling is the second sub-project in the v2 roadmap, after
adventurer classes. It does not add new monster kinds, trap kinds, or player
commands.

## Goals

- Make later waves more dangerous without an abrupt difficulty wall.
- Reward active play with more options while ensuring stronger defenses also
  attract stronger pressure.
- Keep the difficulty calculation pure and deterministic from `GameState`.
- Preserve the pure simulation/I/O boundary.
- Keep all balance values centralized in `economy.ts`.

## Non-goals

- No new adventurer classes or class traits.
- No difficulty selection menu or runtime difficulty command.
- No wave pause or preparation phase.
- No dynamic monster stats or monster movement.
- No persistence or save/load format.
- No loot, room specialization, or trap reload behavior.

## Difficulty model

Difficulty is derived from four components:

```text
timePoints       = floor(tick / 60)
expansionPoints  = sqrt(totalCellsDug)
defensePoints    = sqrt(totalMonstersPlaced + totalTrapsPlaced)
activePressure   = 0.5 * (livingMonsters + activeTraps)

difficultyScore = timePoints + expansionPoints + defensePoints + activePressure
```

The game runs at one tick per second, so one time point represents one minute.
The square-root terms provide diminishing returns for repeated digging and
defense placement. Cumulative progress never decreases during a run. Active
pressure is temporary: a killed monster or consumed trap no longer contributes
to it.

The score is a non-negative number. All difficulty functions accept the score
as a number and clamp it to the supported range where necessary.

## Difficulty tiers

The score maps to five tiers:

| Tier | Score range | Batch size |
| --- | ---: | ---: |
| 0 | 0–9.999... | 1 |
| 1 | 10–19.999... | 1 |
| 2 | 20–34.999... | 2 |
| 3 | 35–54.999... | 3 |
| 4 | 55+ | 4 |

Class weights change only when entering a new tier. Each adventurer in a
batch rolls independently using the current tier's weights:

| Tier | Warrior | Scout | Rogue | Mage |
| --- | ---: | ---: | ---: | ---: |
| 0 | 40% | 30% | 20% | 10% |
| 1 | 35% | 25% | 25% | 15% |
| 2 | 30% | 20% | 30% | 20% |
| 3 | 25% | 15% | 35% | 25% |
| 4 | 20% | 10% | 40% | 30% |

The existing class registry remains the source of base HP and attack. The
snapshot provides a scalar that rises linearly from 1.0× at score 0 to 1.25×
at score 55 and remains capped at 1.25×:

```text
statMultiplier = 1 + 0.25 * clamp(score / 55, 0, 1)
scaledHp       = ceil(baseHp * statMultiplier)
scaledAttack   = ceil(baseAttack * statMultiplier)
```

The effective spawn interval falls linearly from 10 ticks at score 0 to 6
ticks at score 55 and remains capped at 6 ticks. Because ticks are integral,
the effective interval is rounded to the nearest whole tick and clamped to
`[6, 10]`.

Batch size changes only at tier boundaries: `1, 1, 2, 3, 4` for tiers 0
through 4.

## State and accounting

`GameState` gains these fields:

```ts
totalCellsDug: number;
totalMonstersPlaced: number;
totalTrapsPlaced: number;
nextSpawnTick: number;
```

`createGameState()` initializes all cumulative counters to zero and
`nextSpawnTick` to `10`, preserving the v1 first-spawn timing.

Progress accounting:

- A successful `digCell` increments `totalCellsDug` by 1.
- A successful `digLine` increments `totalCellsDug` by its number of cells.
- A successful monster placement increments `totalMonstersPlaced` by 1.
- A successful trap placement increments `totalTrapsPlaced` by 1.
- Failed actions do not increment any counter.
- Adventurer spawns, monster deaths, and trap triggers do not change the
  cumulative counters.
- Current active pressure is derived from `state.monsters.length` and
  `state.traps.length` when the snapshot is calculated.

## Module design

Add `src/difficulty.ts` with pure functions:

- `difficultyScore(state): number`
- `difficultyTier(score): number`
- `interpolateDifficulty(score): { statMultiplier: number; spawnInterval: number }`
- `difficultySnapshot(state): DifficultySnapshot`

`DifficultySnapshot` contains the score, tier, current class weights, batch
size, stat multiplier, and effective spawn interval. Difficulty constants and
the tier weight table belong in `economy.ts`; the calculation and interpolation
logic belong in `difficulty.ts`.

`spawning.ts` requests one snapshot when a spawn decision is due. It creates a
batch of `batchSize` adventurers, independently selects each class using the
snapshot weights, and stamps scaled HP/max HP and attack onto each entity.
The existing injectable RNG is used once per batch member, preserving
deterministic tests.

The existing singular `maybeSpawnAdventurer` result becomes an array of
adventurers. It returns an empty array when the tick is not due or no terrain
path exists.

## Spawn scheduling

The modulo-only v1 check is replaced by explicit scheduling:

1. Increment the tick as today.
2. If `state.tick < state.nextSpawnTick`, do not spawn.
3. If the tick is due, calculate one difficulty snapshot.
4. If no entrance-to-core terrain path exists, spawn nothing.
5. Otherwise, create the complete batch using that one snapshot.
6. Set `state.nextSpawnTick = state.tick + snapshot.spawnInterval` whether or
   not a path existed.

This prevents interval changes from causing duplicate or skipped spawns. A
batch uses one snapshot, but each member gets an independent class roll.

## Rendering and status

The existing per-class glyphs and status class names remain unchanged. The
status display adds the current difficulty tier and score so players can see
why pressure is changing. No new rendering layer is introduced.

## Testing

Add `tests/difficulty.test.ts` covering:

- time, expansion, defense, and active-pressure score components;
- square-root diminishing returns;
- active pressure falling when monsters die or traps trigger;
- exact tier boundaries and tier-4 clamping;
- exact class weights and batch sizes for every tier;
- stat multiplier interpolation, ceiling behavior, and 1.25× cap;
- spawn interval interpolation, rounding, and `[6, 10]` clamping.

Update existing tests to cover:

- successful and failed placement counter accounting;
- `nextSpawnTick` initialization and scheduling;
- no-path scheduling without a spawn;
- independent RNG rolls for every member of a batch;
- batch size and scaled entity stats at representative scores;
- v1 first-spawn behavior at tick 10.

All tests remain deterministic and use direct tick calls with injected RNG
functions. No real timers or statistical distribution tests are required.

## Compatibility

This spec supersedes the v1 spawning timing implementation and the v1
adventurer spawn return shape. It leaves terrain, combat, movement, traps,
commands, and monster behavior unchanged except where adventurer stats and
spawn timing are affected by the difficulty snapshot.
