# Adventurer Classes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generic adventurer with four classes (warrior/scout/mage/rogue), each with distinct hp/attack, movement speed, attack range, and trap-avoidance behavior, spawning at random per a weight table.

**Architecture:** Adds one data-only module addition (`economy.ts`: a kind registry mirroring the existing `MONSTER_KINDS` pattern), then threads a new `kind: AdventurerKind` field through `state.ts`, `spawning.ts` (weighted random selection with an injectable RNG for deterministic tests), `pathfinding.ts` (an optional cell-avoidance set, used only by the trap-avoiding rogue), `combat.ts` (replacing symmetric adjacency-based combat pairing with two directional range checks, and single-step movement with a per-class multi-step movement loop), `render.ts` (per-class glyphs), and `commands.ts` (class name in status output). No new files, no new modules — every change lands in an existing file.

**Tech Stack:** TypeScript on Node.js, `ts-node`, Node's built-in `node:test` + `node:assert/strict`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-adventurer-classes-design.md`

## Global Constraints

- Node.js 20+, `npm test` / `npx tsc --noEmit` must both pass after every task (spec/CLAUDE.md task-completion checklist).
- **Distance metric is Manhattan (`|dx|+|dy|`), never Chebyshev** — the grid has no diagonal movement anywhere (`Grid.neighbors` returns only the 4 orthogonal cells), so a Chebyshev check would treat diagonal cells as in range when nothing else in the game does (spec: Data Model).
- **`AdventurerKind` and `AdventurerKindDef` live in `src/economy.ts`, not `src/state.ts`.** The spec's prose puts `AdventurerKind` under state.ts, but `AdventurerKindDef.name: AdventurerKind` and `Record<AdventurerKind, AdventurerKindDef>` both need the type in the same file as the registry, and this repo's module dependency order is `grid → economy → pathfinding → state → ...` (`economy.ts` imports nothing from `state.ts` — reversing that would break the documented architecture). `state.ts` already imports several constants from `economy.ts`, so it imports `AdventurerKind` from there too. This is a deliberate, load-bearing deviation from the spec's file placement, not the spec's data shapes or behavior.
- No line-of-sight check for the mage's ranged attack (spec: Combat) — pure Manhattan-distance range check, walls don't block it.
- `selectAdventurerKind` must be a pure function tested with fixed boundary `roll` values; `maybeSpawnAdventurer` takes an injectable `rng: () => number = Math.random`. No statistical/probabilistic test assertions anywhere in this plan (spec: Spawning).
- `adventurerCanAttackMonster` and `monsterCanAttackAdventurer` are exported from `combat.ts` so tests exercise them directly (spec: Combat, Testing).
- Adventurer glyphs are exactly `W`/`S`/`M`/`R` for warrior/scout/mage/rogue (spec: Rendering).
- Every tunable number still lives in `src/economy.ts` (CLAUDE.md convention, unchanged).
- No automated tests for `src/render.ts` or `src/main.ts` (v1 spec exclusion, unchanged) — `render.ts` changes are verified manually in Task 8.

---

## Task 1: Economy — Adventurer Kind Registry

**Files:**
- Modify: `src/economy.ts`
- Test: `tests/economy.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AdventurerKind` (`'warrior' | 'scout' | 'mage' | 'rogue'`), `AdventurerKindDef { name: AdventurerKind; hp: number; attack: number; moveSpeed: number; attackRange: number; avoidsTraps: boolean }`, `ADVENTURER_KINDS: Record<AdventurerKind, AdventurerKindDef>`, `ADVENTURER_SPAWN_WEIGHTS: Record<AdventurerKind, number>`.

- [ ] **Step 1: Write the failing tests**

Modify `tests/economy.test.ts` — change the import line at the top to also pull in the two new exports, and add two tests at the end of the file:

```typescript
import { getMonsterKind, getTrapKind, MONSTER_KINDS, TRAP_KINDS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS } from '../src/economy';
```

```typescript
test('ADVENTURER_KINDS defines all four v2 classes with their documented stats', () => {
  assert.deepEqual(ADVENTURER_KINDS.warrior, { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.scout, { name: 'scout', hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.mage, { name: 'mage', hp: 8, attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.rogue, { name: 'rogue', hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true });
});

test('ADVENTURER_SPAWN_WEIGHTS matches the documented spawn distribution', () => {
  assert.deepEqual(ADVENTURER_SPAWN_WEIGHTS, { warrior: 40, scout: 30, rogue: 20, mage: 10 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ADVENTURER_KINDS`/`ADVENTURER_SPAWN_WEIGHTS` don't exist yet (`tsc` compile error surfaced by `ts-node`, since these are named imports from a module that doesn't export them).

- [ ] **Step 3: Add the registry to `src/economy.ts`**

Append at the end of `src/economy.ts` (after the existing `getTrapKind` function):

```typescript
export type AdventurerKind = 'warrior' | 'scout' | 'mage' | 'rogue';

export interface AdventurerKindDef {
  name: AdventurerKind;
  hp: number;
  attack: number;
  moveSpeed: number;
  attackRange: number;
  avoidsTraps: boolean;
}

export const ADVENTURER_KINDS: Record<AdventurerKind, AdventurerKindDef> = {
  warrior: { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false },
  scout: { name: 'scout', hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false },
  mage: { name: 'mage', hp: 8, attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false },
  rogue: { name: 'rogue', hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true },
};

export const ADVENTURER_SPAWN_WEIGHTS: Record<AdventurerKind, number> = {
  warrior: 40,
  scout: 30,
  rogue: 20,
  mage: 10,
};
```

Do not add a `getAdventurerKind()` accessor like `getMonsterKind`/`getTrapKind` — those exist because monster/trap kinds are parsed from untrusted player-typed command text and need a safe `| undefined` lookup. An adventurer's `kind` is chosen internally (Task 4) and typed as `AdventurerKind`, so `ADVENTURER_KINDS[kind]` is always defined; a wrapper would just add an unused code path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/economy.test.ts` green, full suite still green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/economy.ts tests/economy.test.ts
git commit -m "Add adventurer kind registry: warrior/scout/mage/rogue stats and spawn weights

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 2: State — Adventurer.kind Field & Retire Flat Adventurer Stats

**Files:**
- Modify: `src/state.ts`
- Modify: `src/spawning.ts`
- Modify: `src/economy.ts`
- Modify: `tests/state.test.ts`
- Modify: `tests/combat.test.ts`
- Modify: `tests/spawning.test.ts`

**Interfaces:**
- Consumes: `AdventurerKind`, `ADVENTURER_KINDS` from `src/economy.ts` (Task 1).
- Produces: `Adventurer.kind: AdventurerKind` (required field on every adventurer, everywhere in the codebase). `maybeSpawnAdventurer` now sources stats from `ADVENTURER_KINDS.warrior` instead of the old flat constants — **hardcoded to `'warrior'` in this task only**; Task 4 replaces this with real weighted-random selection. `ADVENTURER_HP`/`ADVENTURER_ATTACK` no longer exist.

- [ ] **Step 1: Write the failing test**

Modify `tests/spawning.test.ts` — add `ADVENTURER_KINDS` to the existing import from `'../src/economy'`, and add these two assertions to the end of the existing `'spawns at the entrance on an interval tick when a path exists'` test:

```typescript
import { ENTRANCE_POS, CORE_POS, SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS } from '../src/economy';
```

```typescript
test('spawns at the entrance on an interval tick when a path exists', () => {
  const state = createGameState();
  digRoute(state);
  state.tick = SPAWN_INTERVAL_TICKS;

  const adventurer = maybeSpawnAdventurer(state);

  assert.ok(adventurer);
  assert.deepEqual(adventurer?.pos, ENTRANCE_POS);
  assert.equal(state.adventurers.length, 1);
  assert.equal(adventurer?.kind, 'warrior');
  assert.equal(adventurer?.hp, ADVENTURER_KINDS.warrior.hp);
  assert.equal(adventurer?.attack, ADVENTURER_KINDS.warrior.attack);
});
```

(This assertion set is intentionally provisional — Task 4 changes `maybeSpawnAdventurer` to pick a random class and updates this same test to inject a deterministic RNG instead of asserting a hardcoded `'warrior'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `adventurer?.kind` is `undefined` (the field doesn't exist on `Adventurer` yet), so `assert.equal(adventurer?.kind, 'warrior')` fails.

- [ ] **Step 3: Add the `kind` field to `Adventurer` in `src/state.ts`**

Change the top import line:

```typescript
import { Grid, Pos } from './grid';
import { GRID_WIDTH, GRID_HEIGHT, CORE_POS, ENTRANCE_POS, STARTING_MANA, AdventurerKind } from './economy';
```

Change the `Adventurer` interface:

```typescript
export interface Adventurer {
  id: number;
  kind: AdventurerKind;
  pos: Pos;
  hp: number;
  maxHp: number;
  attack: number;
}
```

- [ ] **Step 4: Wire `src/spawning.ts` to the registry (hardcoded to warrior)**

Replace the full contents of `src/spawning.ts`:

```typescript
import { GameState, Adventurer } from './state';
import { pathExists } from './pathfinding';
import { SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS } from './economy';

export function maybeSpawnAdventurer(state: GameState): Adventurer | null {
  if (state.tick % SPAWN_INTERVAL_TICKS !== 0) return null;
  if (!pathExists(state.grid, state.grid.entrancePos, state.grid.corePos)) return null;

  // Hardcoded to 'warrior' for now — Task 4 replaces this with weighted-random selection.
  const kindDef = ADVENTURER_KINDS.warrior;
  const adventurer: Adventurer = {
    id: state.nextEntityId++,
    kind: 'warrior',
    pos: { ...state.grid.entrancePos },
    hp: kindDef.hp,
    maxHp: kindDef.hp,
    attack: kindDef.attack,
  };
  state.adventurers.push(adventurer);
  return adventurer;
}
```

- [ ] **Step 5: Remove the now-unused flat constants from `src/economy.ts`**

Delete these two lines (nothing else references them after Step 4):

```typescript
export const ADVENTURER_HP = 12;
export const ADVENTURER_ATTACK = 4;
```

- [ ] **Step 6: Fix every other `Adventurer` object literal to compile**

TypeScript strict mode now requires `kind` on every `Adventurer` literal. Add `kind: 'warrior'` to each of the following (this is a mechanical fix, not a behavior change — `'warrior'` has `attackRange: 1`, `moveSpeed: 1`, `avoidsTraps: false`, matching every pre-existing generic-adventurer test's assumptions):

In `tests/state.test.ts`, the `'monsterAt/trapAt/adventurersAt find entities by position'` test:

```typescript
  state.adventurers.push({ id: 2, kind: 'warrior', pos: { x: 5, y: 5 }, hp: 12, maxHp: 12, attack: 4 });
  state.adventurers.push({ id: 3, kind: 'warrior', pos: { x: 5, y: 5 }, hp: 12, maxHp: 12, attack: 4 });
```

In `tests/combat.test.ts`, add `kind: 'warrior'` to the `Adventurer` literal in each of these seven spots (every `adventurers: [...]` array in the file):
- `'adventurer merely adjacent to a monster still moves and takes chip damage'`
- `'adventurer whose next path cell holds a living monster stays in place'`
- `'adventurer can move into a cell whose monster died this tick, and its trap fires the same tick'`
- `'a monster damages every adventurer paired with it in the same tick'` (both adventurers)
- `'adventurer defeated in combat grants mana'`
- `'adventurer reaching the core ends the run'`

For example, the first one becomes:

```typescript
    adventurers: [{ id: 2, kind: 'warrior', pos: { x: 3, y: 0 }, hp: 12, maxHp: 12, attack: 4 }],
```

Apply the same `kind: 'warrior'` insertion (right after `id: <n>,`) to the remaining six adventurer literals in that file.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green, including the new assertions from Step 1.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/state.ts src/spawning.ts src/economy.ts tests/state.test.ts tests/combat.test.ts tests/spawning.test.ts
git commit -m "Add Adventurer.kind field, retire flat adventurer stat constants

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 3: Pathfinding — Optional Avoid Set

**Files:**
- Modify: `src/pathfinding.ts`
- Test: `tests/pathfinding.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `findPath(grid, start, goal, avoid?: Set<string>): Pos[] | null` — a 4th, optional parameter. Cell keys in `avoid` are treated as blocked, same as walls. `pathExists` is unchanged (no `avoid` param — nothing in this plan needs it).

- [ ] **Step 1: Write the failing tests**

Add to the end of `tests/pathfinding.test.ts`:

```typescript
test('findPath routes around cells in the avoid set', () => {
  const grid = new Grid({ width: 3, height: 3, corePos: { x: 1, y: 0 }, entrancePos: { x: 1, y: 2 } });
  grid.dig({ x: 1, y: 1 }); // direct route
  grid.dig({ x: 0, y: 2 }); // detour route
  grid.dig({ x: 0, y: 1 });
  grid.dig({ x: 0, y: 0 });

  const path = findPath(grid, { x: 1, y: 2 }, { x: 1, y: 0 }, new Set(['1,1']));

  assert.deepEqual(path, [
    { x: 1, y: 2 },
    { x: 0, y: 2 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]);
});

test('findPath returns null when the avoid set blocks every route, even though a route exists without it', () => {
  const grid = new Grid({ width: 3, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 2, y: 0 } });
  grid.dig({ x: 1, y: 0 });

  const withoutAvoid = findPath(grid, { x: 2, y: 0 }, { x: 0, y: 0 });
  const withAvoid = findPath(grid, { x: 2, y: 0 }, { x: 0, y: 0 }, new Set(['1,0']));

  assert.ok(withoutAvoid);
  assert.equal(withAvoid, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `findPath` doesn't accept a 4th argument yet (TypeScript compile error via `ts-node`).

- [ ] **Step 3: Add the `avoid` parameter to `findPath`**

Replace `findPath` in `src/pathfinding.ts`:

```typescript
export function findPath(grid: Grid, start: Pos, goal: Pos, avoid?: Set<string>): Pos[] | null {
  if (start.x === goal.x && start.y === goal.y) return [start];

  const visited = new Set<string>([key(start)]);
  const cameFrom = new Map<string, Pos>();
  const queue: Pos[] = [start];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    for (const next of grid.neighbors(current)) {
      const k = key(next);
      if (visited.has(k)) continue;
      if (grid.get(next) === 'wall') continue;
      if (avoid?.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, current);
      if (next.x === goal.x && next.y === goal.y) {
        return reconstructPath(cameFrom, start, next);
      }
      queue.push(next);
    }
  }
  return null;
}
```

(Only the signature and the added `if (avoid?.has(k)) continue;` line change — `reconstructPath` and `pathExists` are untouched.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/pathfinding.ts tests/pathfinding.test.ts
git commit -m "Add optional avoid set to findPath for trap-avoiding pathing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 4: Spawning — Weighted Class Selection

**Files:**
- Modify: `src/spawning.ts`
- Modify: `tests/spawning.test.ts`

**Interfaces:**
- Consumes: `ADVENTURER_KINDS`, `ADVENTURER_SPAWN_WEIGHTS`, `AdventurerKind` from `src/economy.ts` (Task 1).
- Produces: `selectAdventurerKind(weights: Record<AdventurerKind, number>, roll: number): AdventurerKind` (pure). `maybeSpawnAdventurer(state: GameState, rng: () => number = Math.random): Adventurer | null` — gains the optional `rng` parameter; existing call sites (`combat.ts`) that call it with just `state` are unaffected.

- [ ] **Step 1: Write the failing tests**

Change the two import lines at the top of `tests/spawning.test.ts` (add `selectAdventurerKind` to the first, `ADVENTURER_SPAWN_WEIGHTS` to the second — the second line already has `ADVENTURER_KINDS` from Task 2):

```typescript
import { maybeSpawnAdventurer, selectAdventurerKind } from '../src/spawning';
import { ENTRANCE_POS, CORE_POS, SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS } from '../src/economy';
```

Add these two tests to the end of the file:

```typescript
test('selectAdventurerKind picks by cumulative weight boundaries', () => {
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0), 'warrior');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.39999), 'warrior');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.4), 'scout');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.69999), 'scout');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.7), 'rogue');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.89999), 'rogue');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.9), 'mage');
  assert.equal(selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, 0.99999), 'mage');
});

test('maybeSpawnAdventurer wires the injected rng into class selection', () => {
  const state = createGameState();
  digRoute(state);
  state.tick = SPAWN_INTERVAL_TICKS;

  const adventurer = maybeSpawnAdventurer(state, () => 0.95); // lands in the mage slot

  assert.equal(adventurer?.kind, 'mage');
  assert.equal(adventurer?.hp, ADVENTURER_KINDS.mage.hp);
  assert.equal(adventurer?.attack, ADVENTURER_KINDS.mage.attack);
});
```

Then update the Task 2 test (same file) to use an injected, deterministic roll instead of asserting an implicitly-always-warrior result:

```typescript
test('spawns at the entrance on an interval tick when a path exists', () => {
  const state = createGameState();
  digRoute(state);
  state.tick = SPAWN_INTERVAL_TICKS;

  const adventurer = maybeSpawnAdventurer(state, () => 0); // deterministic: lands in the warrior slot

  assert.ok(adventurer);
  assert.deepEqual(adventurer?.pos, ENTRANCE_POS);
  assert.equal(state.adventurers.length, 1);
  assert.equal(adventurer?.kind, 'warrior');
  assert.equal(adventurer?.hp, ADVENTURER_KINDS.warrior.hp);
  assert.equal(adventurer?.attack, ADVENTURER_KINDS.warrior.attack);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `selectAdventurerKind` doesn't exist yet; `maybeSpawnAdventurer` doesn't accept a 2nd argument yet.

- [ ] **Step 3: Implement weighted selection in `src/spawning.ts`**

Replace the full contents of `src/spawning.ts`:

```typescript
import { GameState, Adventurer } from './state';
import { pathExists } from './pathfinding';
import { SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS, AdventurerKind } from './economy';

export function selectAdventurerKind(
  weights: Record<AdventurerKind, number>,
  roll: number,
): AdventurerKind {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let cursor = roll * total;
  for (const [kind, weight] of Object.entries(weights) as [AdventurerKind, number][]) {
    if (cursor < weight) return kind;
    cursor -= weight;
  }
  return 'warrior'; // unreachable given roll < 1, keeps the return type total
}

export function maybeSpawnAdventurer(
  state: GameState,
  rng: () => number = Math.random,
): Adventurer | null {
  if (state.tick % SPAWN_INTERVAL_TICKS !== 0) return null;
  if (!pathExists(state.grid, state.grid.entrancePos, state.grid.corePos)) return null;

  const kind = selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, rng());
  const kindDef = ADVENTURER_KINDS[kind];
  const adventurer: Adventurer = {
    id: state.nextEntityId++,
    kind,
    pos: { ...state.grid.entrancePos },
    hp: kindDef.hp,
    maxHp: kindDef.hp,
    attack: kindDef.attack,
  };
  state.adventurers.push(adventurer);
  return adventurer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green. (`combat.ts` still calls `maybeSpawnAdventurer(state)` with one argument — the default `rng: () => Math.random` covers it, so no other file needs changes yet.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/spawning.ts tests/spawning.test.ts
git commit -m "Spawn adventurer classes by weighted random selection, deterministic-testable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 5: Combat — Directional Attack Checks & Substep Movement

**Files:**
- Modify: `src/combat.ts`
- Modify: `tests/combat.test.ts`

**Interfaces:**
- Consumes: `ADVENTURER_KINDS` (Task 1), `Adventurer.kind` (Task 2), `findPath(..., avoid?)` (Task 3).
- Produces: `adventurerCanAttackMonster(adventurer, monster): boolean`, `monsterCanAttackAdventurer(monster, adventurer): boolean` — both exported. `runTick` behavior changes: combat pairing is now directional (asymmetric ranges), movement is a per-class multi-step loop with trap resolution folded in, and a rogue paths around known traps with a fallback when no trap-free route exists.

- [ ] **Step 1: Write the failing tests**

Add `MANA_PER_KILL` to the existing economy import at the top of `tests/combat.test.ts`:

```typescript
import { MANA_PER_KILL, PASSIVE_MANA_PER_TICK } from '../src/economy';
```

Add these six tests to the end of `tests/combat.test.ts`:

```typescript
test('a mage attacks a monster from range 3 without taking a retaliatory hit', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 1, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
    adventurers: [{ id: 2, kind: 'mage', pos: { x: 4, y: 0 }, hp: 8, maxHp: 8, attack: 5 }],
  });

  runTick(state);

  assert.equal(state.monsters[0].hp, 5); // 10 - 5 (mage attack, distance 3 <= attackRange 3)
  assert.equal(state.adventurers[0].hp, 8); // monster's range is 1; distance 3 means no retaliation
});

test('a scout moves two cells in one tick', () => {
  const grid = new Grid({ width: 6, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 5, y: 0 } });
  grid.dig({ x: 4, y: 0 });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    adventurers: [{ id: 2, kind: 'scout', pos: { x: 5, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 3, y: 0 });
});

test('a scout that dies to a trap on its first landing does not take a second step', () => {
  const grid = new Grid({ width: 6, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 5, y: 0 } });
  grid.dig({ x: 4, y: 0 });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    mana: 0,
    adventurers: [{ id: 2, kind: 'scout', pos: { x: 5, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
    traps: [{ pos: { x: 4, y: 0 }, kind: 'spike', damage: 15 }],
  });

  const events = runTick(state);

  assert.equal(state.adventurers.length, 0);
  assert.equal(state.mana, MANA_PER_KILL + PASSIVE_MANA_PER_TICK);
  assert.equal(state.traps.length, 0);
  assert.ok(events.some((e) => e.includes('Trap triggered')));
});

test('combat pairing is computed once per tick, before movement — a scout blocked mid-move by a monster takes no damage from it that tick', () => {
  const grid = new Grid({ width: 6, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 5, y: 0 } });
  grid.dig({ x: 4, y: 0 });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 3, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
    adventurers: [{ id: 2, kind: 'scout', pos: { x: 5, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 4, y: 0 }); // 1st step ok, 2nd step onto the monster's cell is blocked
  assert.equal(state.adventurers[0].hp, 10); // start-of-tick distance was 2, out of range — no damage
  assert.equal(state.monsters[0].hp, 10); // same — scout's attackRange is 1
});

test('a rogue routes around a known trap when a clear alternate path exists', () => {
  const grid = new Grid({ width: 3, height: 3, corePos: { x: 1, y: 0 }, entrancePos: { x: 1, y: 2 } });
  grid.dig({ x: 1, y: 1 }); // direct route, through the trap
  grid.dig({ x: 0, y: 2 }); // detour route, clear of the trap
  grid.dig({ x: 0, y: 1 });
  grid.dig({ x: 0, y: 0 });

  const state = makeState(grid, {
    adventurers: [{ id: 2, kind: 'rogue', pos: { x: 1, y: 2 }, hp: 10, maxHp: 10, attack: 4 }],
    traps: [{ pos: { x: 1, y: 1 }, kind: 'spike', damage: 6 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 0, y: 2 }); // detoured, did not step onto (1,1)
  assert.equal(state.adventurers[0].hp, 10);
  assert.equal(state.traps.length, 1); // trap untouched
});

test('a rogue still uses a trapped route when no alternate path exists, falling back from avoidance', () => {
  const grid = new Grid({ width: 3, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 2, y: 0 } });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    adventurers: [{ id: 2, kind: 'rogue', pos: { x: 2, y: 0 }, hp: 10, maxHp: 10, attack: 4 }],
    traps: [{ pos: { x: 1, y: 0 }, kind: 'spike', damage: 6 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 1, y: 0 }); // only route available
  assert.equal(state.adventurers[0].hp, 4); // 10 - 6 trap damage
  assert.equal(state.traps.length, 0); // trap consumed
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `runTick` still uses symmetric adjacency pairing and single-step movement, so the mage/scout/rogue-specific tests fail (wrong hp/position values).

- [ ] **Step 3: Rewrite `src/combat.ts`**

Replace the full contents of `src/combat.ts`:

```typescript
import { GameState, Monster, Adventurer, samePos } from './state';
import { Pos } from './grid';
import { findPath } from './pathfinding';
import { maybeSpawnAdventurer } from './spawning';
import { MANA_PER_KILL, PASSIVE_MANA_PER_TICK, ADVENTURER_KINDS } from './economy';

function manhattanDistance(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function adventurerCanAttackMonster(adventurer: Adventurer, monster: Monster): boolean {
  return manhattanDistance(adventurer.pos, monster.pos) <= ADVENTURER_KINDS[adventurer.kind].attackRange;
}

export function monsterCanAttackAdventurer(monster: Monster, adventurer: Adventurer): boolean {
  // No monster kind has a ranged attack in v2 — always melee range.
  return manhattanDistance(monster.pos, adventurer.pos) <= 1;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cellKey(pos: Pos): string {
  return `${pos.x},${pos.y}`;
}

export function runTick(state: GameState): string[] {
  const events: string[] = [];
  state.tick += 1;

  maybeSpawnAdventurer(state);

  // Steps 2-3: directional attack relations from the start-of-tick snapshot,
  // damage applied simultaneously off start-of-tick hp.
  const monsterDamage = new Map<number, number>();
  const adventurerDamage = new Map<number, number>();
  for (const adventurer of state.adventurers) {
    for (const monster of state.monsters) {
      if (adventurerCanAttackMonster(adventurer, monster)) {
        monsterDamage.set(monster.id, (monsterDamage.get(monster.id) ?? 0) + adventurer.attack);
        events.push(`${capitalize(adventurer.kind)} hit ${capitalize(monster.kind)} for ${adventurer.attack} damage.`);
      }
      if (monsterCanAttackAdventurer(monster, adventurer)) {
        adventurerDamage.set(adventurer.id, (adventurerDamage.get(adventurer.id) ?? 0) + monster.attack);
        events.push(`${capitalize(monster.kind)} hit ${capitalize(adventurer.kind)} for ${monster.attack} damage.`);
      }
    }
  }
  for (const monster of state.monsters) {
    monster.hp -= monsterDamage.get(monster.id) ?? 0;
  }
  for (const adventurer of state.adventurers) {
    adventurer.hp -= adventurerDamage.get(adventurer.id) ?? 0;
  }

  // Step 4: remove the dead. Dead entities take no further action this tick.
  state.monsters = state.monsters.filter((m) => {
    if (m.hp <= 0) {
      events.push(`${capitalize(m.kind)} defeated.`);
      return false;
    }
    return true;
  });
  let killedThisTick = 0;
  state.adventurers = state.adventurers.filter((a) => {
    if (a.hp <= 0) {
      killedThisTick += 1;
      return false;
    }
    return true;
  });

  // Steps 5-6 (merged): move each survivor up to its class's moveSpeed cells this
  // tick, resolving a trap immediately after each landing rather than once at the
  // end — a multi-step mover (scout) can die mid-move and never take its later step.
  // A rogue's path is computed avoiding known trap cells (snapshotted here, before
  // any adventurer moves this tick), falling back to the unrestricted path if no
  // trap-free route exists.
  const trapKeysAtMovementStart = new Set(state.traps.map((t) => cellKey(t.pos)));
  for (const adventurer of state.adventurers) {
    const kindDef = ADVENTURER_KINDS[adventurer.kind];
    let path = findPath(
      state.grid,
      adventurer.pos,
      state.grid.corePos,
      kindDef.avoidsTraps ? trapKeysAtMovementStart : undefined,
    );
    if (kindDef.avoidsTraps && !path) {
      path = findPath(state.grid, adventurer.pos, state.grid.corePos);
    }
    if (!path || path.length < 2) continue;

    let cellIndex = 1;
    for (let step = 0; step < kindDef.moveSpeed; step++) {
      const nextCell = path[cellIndex];
      if (!nextCell) break;
      const blockingMonster = state.monsters.find((m) => samePos(m.pos, nextCell));
      if (blockingMonster) break;

      adventurer.pos = nextCell;
      cellIndex += 1;

      const trapIndex = state.traps.findIndex((t) => samePos(t.pos, adventurer.pos));
      if (trapIndex !== -1) {
        const trap = state.traps[trapIndex];
        state.traps.splice(trapIndex, 1);
        adventurer.hp -= trap.damage;
        events.push(`Trap triggered on ${capitalize(adventurer.kind)} for ${trap.damage} damage.`);
        if (adventurer.hp <= 0) {
          killedThisTick += 1;
          break;
        }
      }
      if (samePos(adventurer.pos, state.grid.corePos)) break;
    }
  }
  state.adventurers = state.adventurers.filter((a) => a.hp > 0);

  // Step 7: loss check.
  const coreReached = state.adventurers.some((a) => samePos(a.pos, state.grid.corePos));
  if (coreReached) {
    state.runState = 'over';
    events.push('An adventurer has reached the core. The dungeon has fallen.');
  }

  // Step 8: mana income.
  if (killedThisTick > 0) {
    const gained = killedThisTick * MANA_PER_KILL;
    state.mana += gained;
    events.push(`Adventurer defeated: +${gained} mana.`);
  }

  state.mana += PASSIVE_MANA_PER_TICK;

  return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green, including all six new tests and every pre-existing `combat.test.ts` test (all pre-existing adventurer fixtures are `kind: 'warrior'`, which has `attackRange: 1`/`moveSpeed: 1`/`avoidsTraps: false` — identical to v1's hardcoded behavior, so none of their assertions change).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/combat.ts tests/combat.test.ts
git commit -m "Add directional attack ranges and per-class multi-step movement to combat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 6: Render — Per-Class Glyphs

**Files:**
- Modify: `src/render.ts`

**Interfaces:**
- Consumes: `AdventurerKind` from `src/economy.ts` (Task 1), `Adventurer.kind` (Task 2).
- Produces: `render()`'s output signature is unchanged (still `(state, events) => string`); the grid now prints `W`/`S`/`M`/`R` for adventurers instead of a single `A`.

No automated test for this module — the spec explicitly excludes rendering tests (Global Constraints); it's a thin, mechanically-checkable print layer over already-tested state. Verified manually in Task 8.

- [ ] **Step 1: Replace the full contents of `src/render.ts`**

```typescript
import { GameState } from './state';
import { Pos } from './grid';
import { AdventurerKind } from './economy';

const GLYPHS: Record<string, string> = {
  wall: '#',
  floor: '.',
  core: 'C',
  monster: 'm',
  trap: 't',
};

const ADVENTURER_GLYPHS: Record<AdventurerKind, string> = {
  warrior: 'W',
  scout: 'S',
  mage: 'M',
  rogue: 'R',
};

export function render(state: GameState, events: string[]): string {
  const rows: string[] = [coordinateHeader(state.grid.width)];
  for (let y = 0; y < state.grid.height; y++) {
    let row = '';
    for (let x = 0; x < state.grid.width; x++) {
      row += glyphAt(state, { x, y });
    }
    rows.push(`${String(y).padStart(2, '0')}  ${row}`);
  }

  const status = `Tick: ${state.tick}  Mana: ${state.mana.toFixed(2)}  Adventurers: ${state.adventurers.length}  State: ${state.runState}`;

  return [...rows, '', status, ...(events.length ? ['', ...events] : [])].join('\n');
}

function coordinateHeader(width: number): string {
  const tens = Array.from({ length: width }, (_, x) => Math.floor(x / 10)).join('');
  const ones = Array.from({ length: width }, (_, x) => x % 10).join('');
  return `    ${tens}\n    ${ones}`;
}

function glyphAt(state: GameState, pos: Pos): string {
  if (state.runState === 'over' && pos.x === state.grid.corePos.x && pos.y === state.grid.corePos.y) return 'X';
  const adventurer = state.adventurers.find((a) => a.pos.x === pos.x && a.pos.y === pos.y);
  if (adventurer) return ADVENTURER_GLYPHS[adventurer.kind];
  if (state.monsters.some((m) => m.pos.x === pos.x && m.pos.y === pos.y)) return GLYPHS.monster;
  if (state.traps.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return GLYPHS.trap;
  return GLYPHS[state.grid.get(pos)];
}
```

The only behavior change from the old `glyphAt` is the adventurer branch: it now finds the specific adventurer occupying the cell (first match in `state.adventurers` array order, per the spec's stacking rule) and looks up its class glyph, instead of returning a constant `'A'`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — `render.ts` has no tests, but this confirms nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/render.ts
git commit -m "Render each adventurer class with its own glyph (W/S/M/R)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 7: Commands — Status Text Includes Class

**Files:**
- Modify: `src/commands.ts`
- Modify: `tests/commands.test.ts`

**Interfaces:**
- Consumes: `Adventurer.kind` (Task 2).
- Produces: `formatStatus`'s `Adventurers:` line now includes each adventurer's class name, matching the existing `Monsters:` line's `${kind}#${id}` style.

- [ ] **Step 1: Write the failing test**

Add to the end of `tests/commands.test.ts`:

```typescript
test("status includes each adventurer's class", () => {
  const ctx = makeCtx();
  ctx.state.adventurers.push({ id: 9, kind: 'mage', pos: { x: 5, y: 5 }, hp: 8, maxHp: 8, attack: 5 });

  const { lines } = handleCommand(ctx, 'status');

  assert.ok(lines[0].includes('mage#9'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the current `Adventurers:` line format is `#${a.id} (...)`, with no class name, so `lines[0]` doesn't contain `'mage#9'`.

- [ ] **Step 3: Update `formatStatus` in `src/commands.ts`**

Change this line inside `formatStatus`:

```typescript
    `Adventurers: ${state.adventurers.map((a) => `#${a.id} (${a.pos.x},${a.pos.y}) hp ${a.hp}/${a.maxHp}`).join(', ') || 'none'}`,
```

to:

```typescript
    `Adventurers: ${state.adventurers.map((a) => `${a.kind}#${a.id} (${a.pos.x},${a.pos.y}) hp ${a.hp}/${a.maxHp}`).join(', ') || 'none'}`,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/commands.ts tests/commands.test.ts
git commit -m "Include adventurer class in status output

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AZwzfUqbrmdvha17KNG416"
```

---

## Task 8: Manual Playtest

**Files:** none — verification only.

**Interfaces:** none — this task consumes the finished feature end-to-end and produces no code.

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: PASS — every test from Tasks 1-7 still green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Manual playtest**

Run: `npm run dev`

Verify by typing commands at the prompt:
1. `status` — confirm the format still reads correctly with zero adventurers (`Adventurers: none`).
2. Dig a route from the entrance to the core (e.g. `dig line 16 6 3 6`).
3. Wait through several spawn intervals (tick 10, 20, 30, ...) — confirm adventurers appear at the entrance with visibly different glyphs (`W`, `S`, `M`, `R`) over enough spawns, and that `status` lists each with its class name (e.g. `scout#3 (16,6) hp 10/10`).
4. Confirm a scout visibly covers 2 cells per tick redraw where a warrior/mage/rogue covers 1.
5. `spawn goblin 10 6` and let a mage-class adventurer approach — confirm a `Mage hit Goblin for 5 damage.` event appears before the mage is adjacent to the goblin (i.e., while there's a gap between them on screen).
6. `trap spike 8 6` on the route and watch for a rogue-class adventurer — confirm it visibly steps around that cell rather than through it (when an alternate route exists), or triggers it if forced to (single-corridor case is hard to arrange manually with the default map's width; the automated fallback test in Task 5 covers this precisely — a visual "it did detour" check is sufficient here).
7. Confirm `Trap triggered on <Class> for N damage.` and `<Class> hit <Monster> for N damage.` event lines show specific class names, not the word "Adventurer".
8. Let a run end (adventurer reaches the core) — confirm the loss message and glyphs still render correctly (no crash from the new per-class glyph lookup once `runState` is `'over'`).
9. `quit` — confirm clean exit.

- [ ] **Step 4: No commit for this task**

This task makes no file changes — nothing to commit. If manual playtest surfaces a bug, fix it as a new commit referencing which task's code it corrects, then re-run this task's verification from Step 1.

---

## Post-Plan: What's Deliberately Not Here

Per the design spec's "Explicitly Out of Scope for This Spec": difficulty scaling / wave-based class unlocks (v2 roadmap item #2, next up), loot tables, monsters gaining ranged attacks or trap avoidance of their own, and any per-class rendering beyond a single glyph (color, animation). The only open question after this plan is **economy balance** for the four new classes — tune `ADVENTURER_KINDS`/`ADVENTURER_SPAWN_WEIGHTS` in `src/economy.ts` after playtesting; no architecture change is needed to do that.
