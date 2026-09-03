# Dungeon Core v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable terminal dungeon-core game: dig rooms, spawn monsters, place traps, survive real-time adventurer incursions for mana.

**Architecture:** Pure, synchronously-testable simulation modules (grid, pathfinding, state, placement rules, tick resolution) with zero I/O, wrapped by three thin, untested-by-design integration layers (a `setInterval`-based tick loop, a text command parser, and a terminal renderer) wired together in `main.ts`. Every module with a branch, loop, or rule lives below the I/O line and gets `node:test` coverage; only the I/O wiring itself is untested, matching the spec's explicit exclusion of end-to-end/rendering tests.

**Tech Stack:** TypeScript on Node.js, `ts-node` for execution, Node's built-in `node:test` + `node:assert/strict` for tests. No other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-dungeon-core-v1-design.md`

## Global Constraints

- Node.js 20+ (required for `node --test` glob patterns).
- No dependencies beyond `typescript`, `ts-node`, `@types/node` (all `devDependencies` — nothing shipped at runtime beyond Node itself).
- No TUI framework, no game engine, no pathfinding library — BFS is hand-written.
- Coordinates: `(0, 0)` top-left, `x` right, `y` down (spec: Initial State).
- Grid: 20×12, core at `(2, 6)`, entrance at `(17, 6)`, starting mana 50 (spec: Initial State).
- Every tunable number (costs, stats, timings) lives in `src/economy.ts` — the one file to edit when balancing.
- No exceptions cross the command-dispatch boundary — invalid commands return an error string, never throw (spec: Error Handling).
- No automated tests for `src/render.ts` or `src/main.ts` — spec explicitly excludes end-to-end/rendering tests; verify these manually by running the game.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `npm run dev` (runs `src/main.ts`), `npm test` (runs all `tests/**/*.test.ts` via Node's built-in test runner).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dungeon-core",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "node -r ts-node/register src/main.ts",
    "test": "node -r ts-node/register --test \"tests/**/*.test.ts\""
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 5: Verify the toolchain runs**

Run: `node -r ts-node/register -e "console.log('ts-node ok')"`
Expected: prints `ts-node ok` — confirms `ts-node`/`typescript` are wired correctly. (Skip `tsc --noEmit` here: `tsconfig.json`'s `include` globs match zero files until Task 2 adds source, which makes `tsc` error with "no inputs found" — that check starts being meaningful from Task 2 onward.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "Scaffold TypeScript/Node project for dungeon core v1

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 2: Grid Module

**Files:**
- Create: `src/grid.ts`
- Test: `tests/grid.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `CellKind` (`'wall' | 'floor' | 'core'`), `Pos { x: number; y: number }`, `GridConfig { width, height, corePos, entrancePos }`, class `Grid` with `width`, `height`, `corePos`, `entrancePos`, `inBounds(pos): boolean`, `get(pos): CellKind`, `neighbors(pos): Pos[]`, `canDig(pos): boolean`, `dig(pos): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/grid.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';

function testGrid(): Grid {
  return new Grid({ width: 5, height: 5, corePos: { x: 1, y: 1 }, entrancePos: { x: 3, y: 3 } });
}

test('initial grid places core, entrance, and walls everywhere else', () => {
  const grid = testGrid();
  assert.equal(grid.get({ x: 1, y: 1 }), 'core');
  assert.equal(grid.get({ x: 3, y: 3 }), 'floor');
  assert.equal(grid.get({ x: 0, y: 0 }), 'wall');
  assert.equal(grid.get({ x: 4, y: 4 }), 'wall');
});

test('canDig is true for a wall adjacent to the entrance', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 2, y: 3 }), true);
  assert.equal(grid.canDig({ x: 4, y: 3 }), true);
});

test('canDig is false for a wall not adjacent to any floor or core', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 0, y: 4 }), false);
});

test('canDig is false for the core cell and the entrance cell', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 1, y: 1 }), false);
  assert.equal(grid.canDig({ x: 3, y: 3 }), false);
});

test('dig converts a diggable wall to floor and returns true', () => {
  const grid = testGrid();
  const result = grid.dig({ x: 2, y: 3 });
  assert.equal(result, true);
  assert.equal(grid.get({ x: 2, y: 3 }), 'floor');
});

test('dig on a non-diggable cell is a no-op and returns false', () => {
  const grid = testGrid();
  const result = grid.dig({ x: 0, y: 4 });
  assert.equal(result, false);
  assert.equal(grid.get({ x: 0, y: 4 }), 'wall');
});

test('digging extends the frontier: a cell adjacent to newly dug floor becomes diggable', () => {
  const grid = testGrid();
  grid.dig({ x: 2, y: 3 });
  assert.equal(grid.canDig({ x: 1, y: 3 }), true);
});

test('inBounds is false outside the grid', () => {
  const grid = testGrid();
  assert.equal(grid.inBounds({ x: -1, y: 0 }), false);
  assert.equal(grid.inBounds({ x: 5, y: 0 }), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/grid.ts` does not exist yet (module not found).

- [ ] **Step 3: Write `src/grid.ts`**

```typescript
export type CellKind = 'wall' | 'floor' | 'core';

export interface Pos {
  x: number;
  y: number;
}

export interface GridConfig {
  width: number;
  height: number;
  corePos: Pos;
  entrancePos: Pos;
}

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly corePos: Pos;
  readonly entrancePos: Pos;
  private cells: CellKind[][];

  constructor(config: GridConfig) {
    this.width = config.width;
    this.height = config.height;
    this.corePos = config.corePos;
    this.entrancePos = config.entrancePos;
    this.cells = [];
    for (let y = 0; y < this.height; y++) {
      const row: CellKind[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push('wall');
      }
      this.cells.push(row);
    }
    this.cells[this.corePos.y][this.corePos.x] = 'core';
    this.cells[this.entrancePos.y][this.entrancePos.x] = 'floor';
  }

  inBounds(pos: Pos): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  get(pos: Pos): CellKind {
    if (!this.inBounds(pos)) {
      throw new Error(`out of bounds: (${pos.x}, ${pos.y})`);
    }
    return this.cells[pos.y][pos.x];
  }

  neighbors(pos: Pos): Pos[] {
    const candidates: Pos[] = [
      { x: pos.x, y: pos.y - 1 },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x + 1, y: pos.y },
    ];
    return candidates.filter((p) => this.inBounds(p));
  }

  canDig(pos: Pos): boolean {
    if (!this.inBounds(pos)) return false;
    if (this.get(pos) !== 'wall') return false;
    return this.neighbors(pos).some((n) => {
      const kind = this.get(n);
      return kind === 'floor' || kind === 'core';
    });
  }

  dig(pos: Pos): boolean {
    if (!this.canDig(pos)) return false;
    this.cells[pos.y][pos.x] = 'floor';
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 8 tests in `tests/grid.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/grid.ts tests/grid.test.ts
git commit -m "Add grid module: cells, dig-adjacency rule, neighbors

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 3: Economy Module

**Files:**
- Create: `src/economy.ts`
- Test: `tests/economy.test.ts`

**Interfaces:**
- Consumes: `Pos` from `src/grid.ts`.
- Produces: constants `GRID_WIDTH`, `GRID_HEIGHT`, `CORE_POS`, `ENTRANCE_POS`, `STARTING_MANA`, `DIG_COST`, `MANA_PER_KILL`, `TICK_MS`, `SPAWN_INTERVAL_TICKS`, `ADVENTURER_HP`, `ADVENTURER_ATTACK`; `MonsterKindDef { name, cost, hp, attack }`, `TrapKindDef { name, cost, damage }`; `MONSTER_KINDS`, `TRAP_KINDS` registries; `getMonsterKind(name): MonsterKindDef | undefined`, `getTrapKind(name): TrapKindDef | undefined`.

- [ ] **Step 1: Write the failing tests**

Create `tests/economy.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonsterKind, getTrapKind, MONSTER_KINDS, TRAP_KINDS } from '../src/economy';

test('getMonsterKind returns defined stats for a known kind', () => {
  const goblin = getMonsterKind('goblin');
  assert.ok(goblin);
  assert.equal(goblin?.cost, 15);
  assert.equal(goblin?.hp, 10);
  assert.equal(goblin?.attack, 3);
});

test('getMonsterKind returns undefined for an unknown kind', () => {
  assert.equal(getMonsterKind('dragon'), undefined);
});

test('getTrapKind returns defined stats for a known kind', () => {
  const spike = getTrapKind('spike');
  assert.ok(spike);
  assert.equal(spike?.cost, 8);
  assert.equal(spike?.damage, 6);
});

test('getTrapKind returns undefined for an unknown kind', () => {
  assert.equal(getTrapKind('pit'), undefined);
});

test('kind registries expose exactly the v1 supported kinds', () => {
  assert.deepEqual(Object.keys(MONSTER_KINDS), ['goblin']);
  assert.deepEqual(Object.keys(TRAP_KINDS), ['spike']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/economy.ts` does not exist yet.

- [ ] **Step 3: Write `src/economy.ts`**

```typescript
import { Pos } from './grid';

export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 12;
export const CORE_POS: Pos = { x: 2, y: 6 };
export const ENTRANCE_POS: Pos = { x: 17, y: 6 };

export const STARTING_MANA = 50;
export const DIG_COST = 2;
export const MANA_PER_KILL = 12;
export const TICK_MS = 1000;
export const SPAWN_INTERVAL_TICKS = 10;

export const ADVENTURER_HP = 12;
export const ADVENTURER_ATTACK = 4;

export interface MonsterKindDef {
  name: string;
  cost: number;
  hp: number;
  attack: number;
}

export interface TrapKindDef {
  name: string;
  cost: number;
  damage: number;
}

export const MONSTER_KINDS: Record<string, MonsterKindDef> = {
  goblin: { name: 'goblin', cost: 15, hp: 10, attack: 3 },
};

export const TRAP_KINDS: Record<string, TrapKindDef> = {
  spike: { name: 'spike', cost: 8, damage: 6 },
};

export function getMonsterKind(name: string): MonsterKindDef | undefined {
  return MONSTER_KINDS[name];
}

export function getTrapKind(name: string): TrapKindDef | undefined {
  return TRAP_KINDS[name];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/economy.test.ts` green (plus `tests/grid.test.ts` still green).

- [ ] **Step 5: Commit**

```bash
git add src/economy.ts tests/economy.test.ts
git commit -m "Add economy module: all tunable constants and kind registries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 4: Pathfinding Module

**Files:**
- Create: `src/pathfinding.ts`
- Test: `tests/pathfinding.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Pos` from `src/grid.ts`.
- Produces: `findPath(grid, start, goal): Pos[] | null` (inclusive shortest path, terrain-only — treats `wall` as blocked, `floor`/`core` as passable, ignores all entities since `Grid` has no entity concept), `pathExists(grid, start, goal): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/pathfinding.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';
import { findPath, pathExists } from '../src/pathfinding';

test('findPath returns the shortest path across open floor', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const path = findPath(grid, { x: 4, y: 0 }, { x: 0, y: 0 });

  assert.ok(path);
  assert.deepEqual(path, [
    { x: 4, y: 0 },
    { x: 3, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ]);
});

test('findPath returns null when no route exists', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  const path = findPath(grid, { x: 4, y: 0 }, { x: 0, y: 0 });
  assert.equal(path, null);
});

test('findPath picks the shorter of two available routes', () => {
  const grid = new Grid({ width: 3, height: 3, corePos: { x: 1, y: 0 }, entrancePos: { x: 1, y: 2 } });
  grid.dig({ x: 1, y: 1 }); // direct 1-cell route through the middle
  grid.dig({ x: 0, y: 1 });
  grid.dig({ x: 0, y: 0 });
  grid.dig({ x: 0, y: 2 }); // a longer detour also exists

  const path = findPath(grid, { x: 1, y: 2 }, { x: 1, y: 0 });

  assert.equal(path?.length, 3);
});

test('pathExists mirrors findPath reachability', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  assert.equal(pathExists(grid, { x: 4, y: 0 }, { x: 0, y: 0 }), false);
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });
  assert.equal(pathExists(grid, { x: 4, y: 0 }, { x: 0, y: 0 }), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/pathfinding.ts` does not exist yet.

- [ ] **Step 3: Write `src/pathfinding.ts`**

```typescript
import { Grid, Pos } from './grid';

function key(pos: Pos): string {
  return `${pos.x},${pos.y}`;
}

export function findPath(grid: Grid, start: Pos, goal: Pos): Pos[] | null {
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

function reconstructPath(cameFrom: Map<string, Pos>, start: Pos, goal: Pos): Pos[] {
  const path: Pos[] = [goal];
  let current = goal;
  while (!(current.x === start.x && current.y === start.y)) {
    const prev = cameFrom.get(key(current));
    if (!prev) throw new Error('broken path reconstruction');
    path.push(prev);
    current = prev;
  }
  return path.reverse();
}

export function pathExists(grid: Grid, start: Pos, goal: Pos): boolean {
  return findPath(grid, start, goal) !== null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/pathfinding.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/pathfinding.ts tests/pathfinding.test.ts
git commit -m "Add BFS pathfinding module, terrain-only (ignores entities)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 5: Game State Module

**Files:**
- Create: `src/state.ts`
- Test: `tests/state.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Pos` from `src/grid.ts`; `GRID_WIDTH`, `GRID_HEIGHT`, `CORE_POS`, `ENTRANCE_POS`, `STARTING_MANA` from `src/economy.ts`.
- Produces: `RunState = 'running' | 'paused' | 'over'`; `Monster { id, kind, pos, hp, maxHp, attack }`; `Adventurer { id, pos, hp, maxHp, attack }`; `Trap { pos, kind, damage }`; `GameState { grid, mana, tick, monsters, adventurers, traps, runState, nextEntityId }`; `createGameState(): GameState`; `monsterAt(state, pos): Monster | undefined`; `trapAt(state, pos): Trap | undefined`; `adventurersAt(state, pos): Adventurer[]`; `samePos(a, b): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/state.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, monsterAt, trapAt, adventurersAt } from '../src/state';
import { GRID_WIDTH, GRID_HEIGHT, CORE_POS, ENTRANCE_POS, STARTING_MANA } from '../src/economy';

test('createGameState builds the documented initial state', () => {
  const state = createGameState();
  assert.equal(state.grid.width, GRID_WIDTH);
  assert.equal(state.grid.height, GRID_HEIGHT);
  assert.equal(state.grid.get(CORE_POS), 'core');
  assert.equal(state.grid.get(ENTRANCE_POS), 'floor');
  assert.equal(state.mana, STARTING_MANA);
  assert.equal(state.tick, 0);
  assert.equal(state.runState, 'running');
  assert.deepEqual(state.monsters, []);
  assert.deepEqual(state.adventurers, []);
  assert.deepEqual(state.traps, []);
});

test('createGameState leaves the entrance disconnected from the rest of the grid', () => {
  const state = createGameState();
  const openNeighbors = state.grid.neighbors(ENTRANCE_POS).filter((p) => state.grid.get(p) !== 'wall');
  assert.equal(openNeighbors.length, 0);
});

test('monsterAt/trapAt/adventurersAt find entities by position', () => {
  const state = createGameState();
  state.monsters.push({ id: 1, kind: 'goblin', pos: { x: 5, y: 5 }, hp: 10, maxHp: 10, attack: 3 });
  state.traps.push({ pos: { x: 6, y: 6 }, kind: 'spike', damage: 6 });
  state.adventurers.push({ id: 2, pos: { x: 5, y: 5 }, hp: 12, maxHp: 12, attack: 4 });
  state.adventurers.push({ id: 3, pos: { x: 5, y: 5 }, hp: 12, maxHp: 12, attack: 4 });

  assert.equal(monsterAt(state, { x: 5, y: 5 })?.id, 1);
  assert.equal(monsterAt(state, { x: 0, y: 0 }), undefined);
  assert.equal(trapAt(state, { x: 6, y: 6 })?.kind, 'spike');
  assert.equal(adventurersAt(state, { x: 5, y: 5 }).length, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/state.ts` does not exist yet.

- [ ] **Step 3: Write `src/state.ts`**

```typescript
import { Grid, Pos } from './grid';
import { GRID_WIDTH, GRID_HEIGHT, CORE_POS, ENTRANCE_POS, STARTING_MANA } from './economy';

export type RunState = 'running' | 'paused' | 'over';

export interface Monster {
  id: number;
  kind: string;
  pos: Pos;
  hp: number;
  maxHp: number;
  attack: number;
}

export interface Adventurer {
  id: number;
  pos: Pos;
  hp: number;
  maxHp: number;
  attack: number;
}

export interface Trap {
  pos: Pos;
  kind: string;
  damage: number;
}

export interface GameState {
  grid: Grid;
  mana: number;
  tick: number;
  monsters: Monster[];
  adventurers: Adventurer[];
  traps: Trap[];
  runState: RunState;
  nextEntityId: number;
}

export function createGameState(): GameState {
  return {
    grid: new Grid({ width: GRID_WIDTH, height: GRID_HEIGHT, corePos: CORE_POS, entrancePos: ENTRANCE_POS }),
    mana: STARTING_MANA,
    tick: 0,
    monsters: [],
    adventurers: [],
    traps: [],
    runState: 'running',
    nextEntityId: 1,
  };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function monsterAt(state: GameState, pos: Pos): Monster | undefined {
  return state.monsters.find((m) => samePos(m.pos, pos));
}

export function trapAt(state: GameState, pos: Pos): Trap | undefined {
  return state.traps.find((t) => samePos(t.pos, pos));
}

export function adventurersAt(state: GameState, pos: Pos): Adventurer[] {
  return state.adventurers.filter((a) => samePos(a.pos, pos));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/state.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/state.ts tests/state.test.ts
git commit -m "Add game state module: entity types, createGameState, occupancy queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 6: Placement Module (dig / spawn / trap validation)

**Files:**
- Create: `src/placement.ts`
- Test: `tests/placement.test.ts`

**Interfaces:**
- Consumes: `GameState`, `monsterAt`, `trapAt` from `src/state.ts`; `Pos` from `src/grid.ts`; `getMonsterKind`, `getTrapKind`, `DIG_COST` from `src/economy.ts`.
- Produces: `ActionResult = { ok: true } | { ok: false; error: string }`; `digCell(state, pos): ActionResult`; `spawnMonster(state, kindName, pos): ActionResult`; `placeTrap(state, kindName, pos): ActionResult`.

- [ ] **Step 1: Write the failing tests**

Create `tests/placement.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/state';
import { digCell, spawnMonster, placeTrap } from '../src/placement';
import { ENTRANCE_POS } from '../src/economy';

test('digCell succeeds adjacent to the entrance and deducts mana', () => {
  const state = createGameState();
  const target = { x: ENTRANCE_POS.x - 1, y: ENTRANCE_POS.y };
  const before = state.mana;

  const result = digCell(state, target);

  assert.deepEqual(result, { ok: true });
  assert.equal(state.grid.get(target), 'floor');
  assert.equal(state.mana, before - 2);
});

test('digCell fails on a wall with no adjacent floor', () => {
  const state = createGameState();
  const result = digCell(state, { x: 0, y: 0 });
  assert.equal(result.ok, false);
});

test('digCell fails when mana is insufficient', () => {
  const state = createGameState();
  state.mana = 1;
  const target = { x: ENTRANCE_POS.x - 1, y: ENTRANCE_POS.y };
  const result = digCell(state, target);
  assert.equal(result.ok, false);
});

test('spawnMonster rejects an unknown kind', () => {
  const state = createGameState();
  const result = spawnMonster(state, 'dragon', ENTRANCE_POS);
  assert.equal(result.ok, false);
});

test('spawnMonster rejects insufficient mana', () => {
  const state = createGameState();
  state.mana = 0;
  const result = spawnMonster(state, 'goblin', ENTRANCE_POS);
  assert.equal(result.ok, false);
});

test('spawnMonster rejects a non-floor cell', () => {
  const state = createGameState();
  const result = spawnMonster(state, 'goblin', { x: 0, y: 0 });
  assert.equal(result.ok, false);
});

test('spawnMonster rejects placement on the core or the entrance', () => {
  const state = createGameState();
  assert.equal(spawnMonster(state, 'goblin', state.grid.corePos).ok, false);
  assert.equal(spawnMonster(state, 'goblin', ENTRANCE_POS).ok, false);
});

test('spawnMonster succeeds on open floor and deducts mana', () => {
  const state = createGameState();
  const target = { x: ENTRANCE_POS.x - 1, y: ENTRANCE_POS.y };
  digCell(state, target);
  const before = state.mana;

  const result = spawnMonster(state, 'goblin', target);

  assert.deepEqual(result, { ok: true });
  assert.equal(state.monsters.length, 1);
  assert.equal(state.mana, before - 15);
});

test('spawnMonster rejects a second monster on an occupied cell, but a trap may still be added there', () => {
  const state = createGameState();
  const target = { x: ENTRANCE_POS.x - 1, y: ENTRANCE_POS.y };
  digCell(state, target);
  spawnMonster(state, 'goblin', target);

  assert.equal(spawnMonster(state, 'goblin', target).ok, false);
  assert.deepEqual(placeTrap(state, 'spike', target), { ok: true });
});

test('placeTrap rejects a second trap on an occupied cell, but a monster may still be added there', () => {
  const state = createGameState();
  const target = { x: ENTRANCE_POS.x - 1, y: ENTRANCE_POS.y };
  digCell(state, target);
  placeTrap(state, 'spike', target);

  assert.equal(placeTrap(state, 'spike', target).ok, false);
  assert.deepEqual(spawnMonster(state, 'goblin', target), { ok: true });
});

test('spawnMonster and placeTrap reject out-of-bounds coordinates without throwing', () => {
  const state = createGameState();
  assert.equal(spawnMonster(state, 'goblin', { x: 999, y: 999 }).ok, false);
  assert.equal(placeTrap(state, 'spike', { x: 999, y: 999 }).ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/placement.ts` does not exist yet.

- [ ] **Step 3: Write `src/placement.ts`**

```typescript
import { GameState, monsterAt, trapAt } from './state';
import { Pos } from './grid';
import { getMonsterKind, getTrapKind, DIG_COST } from './economy';

export type ActionResult = { ok: true } | { ok: false; error: string };

export function digCell(state: GameState, pos: Pos): ActionResult {
  if (state.mana < DIG_COST) {
    return { ok: false, error: `Not enough mana: dig costs ${DIG_COST}, have ${state.mana}.` };
  }
  if (!state.grid.canDig(pos)) {
    return { ok: false, error: `Cannot dig (${pos.x}, ${pos.y}): not a diggable wall.` };
  }
  state.grid.dig(pos);
  state.mana -= DIG_COST;
  return { ok: true };
}

function isCoreOrEntrance(state: GameState, pos: Pos): boolean {
  const g = state.grid;
  return (
    (pos.x === g.corePos.x && pos.y === g.corePos.y) ||
    (pos.x === g.entrancePos.x && pos.y === g.entrancePos.y)
  );
}

export function spawnMonster(state: GameState, kindName: string, pos: Pos): ActionResult {
  if (!state.grid.inBounds(pos)) {
    return { ok: false, error: `(${pos.x}, ${pos.y}) is out of bounds.` };
  }
  const kind = getMonsterKind(kindName);
  if (!kind) {
    return { ok: false, error: `Unknown monster kind: ${kindName}.` };
  }
  if (state.mana < kind.cost) {
    return { ok: false, error: `Not enough mana: ${kindName} costs ${kind.cost}, have ${state.mana}.` };
  }
  if (state.grid.get(pos) !== 'floor') {
    return { ok: false, error: `Cannot place monster at (${pos.x}, ${pos.y}): not a floor cell.` };
  }
  if (isCoreOrEntrance(state, pos)) {
    return { ok: false, error: 'Cannot place a monster on the core or entrance.' };
  }
  if (monsterAt(state, pos)) {
    return { ok: false, error: `Cannot place monster at (${pos.x}, ${pos.y}): already occupied by a monster.` };
  }
  state.monsters.push({
    id: state.nextEntityId++,
    kind: kindName,
    pos,
    hp: kind.hp,
    maxHp: kind.hp,
    attack: kind.attack,
  });
  state.mana -= kind.cost;
  return { ok: true };
}

export function placeTrap(state: GameState, kindName: string, pos: Pos): ActionResult {
  if (!state.grid.inBounds(pos)) {
    return { ok: false, error: `(${pos.x}, ${pos.y}) is out of bounds.` };
  }
  const kind = getTrapKind(kindName);
  if (!kind) {
    return { ok: false, error: `Unknown trap kind: ${kindName}.` };
  }
  if (state.mana < kind.cost) {
    return { ok: false, error: `Not enough mana: ${kindName} costs ${kind.cost}, have ${state.mana}.` };
  }
  if (state.grid.get(pos) !== 'floor') {
    return { ok: false, error: `Cannot place trap at (${pos.x}, ${pos.y}): not a floor cell.` };
  }
  if (isCoreOrEntrance(state, pos)) {
    return { ok: false, error: 'Cannot place a trap on the core or entrance.' };
  }
  if (trapAt(state, pos)) {
    return { ok: false, error: `Cannot place trap at (${pos.x}, ${pos.y}): already occupied by a trap.` };
  }
  state.traps.push({ pos, kind: kindName, damage: kind.damage });
  state.mana -= kind.cost;
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/placement.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/placement.ts tests/placement.test.ts
git commit -m "Add placement module: validated dig/spawn/trap actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 7: Adventurer Spawning Module

**Files:**
- Create: `src/spawning.ts`
- Test: `tests/spawning.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Adventurer` from `src/state.ts`; `pathExists` from `src/pathfinding.ts`; `SPAWN_INTERVAL_TICKS`, `ADVENTURER_HP`, `ADVENTURER_ATTACK` from `src/economy.ts`.
- Produces: `maybeSpawnAdventurer(state): Adventurer | null` — call once per tick, after the tick counter has been incremented.

- [ ] **Step 1: Write the failing tests**

Create `tests/spawning.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, GameState } from '../src/state';
import { maybeSpawnAdventurer } from '../src/spawning';
import { digCell } from '../src/placement';
import { ENTRANCE_POS, CORE_POS, SPAWN_INTERVAL_TICKS } from '../src/economy';

function digRoute(state: GameState): void {
  const y = CORE_POS.y;
  for (let x = CORE_POS.x + 1; x < ENTRANCE_POS.x; x++) {
    digCell(state, { x, y });
  }
}

test('does not spawn on a tick that is not a multiple of the spawn interval', () => {
  const state = createGameState();
  digRoute(state);
  state.tick = SPAWN_INTERVAL_TICKS - 1;
  assert.equal(maybeSpawnAdventurer(state), null);
  assert.equal(state.adventurers.length, 0);
});

test('does not spawn on an interval tick when no path exists', () => {
  const state = createGameState();
  state.tick = SPAWN_INTERVAL_TICKS;
  assert.equal(maybeSpawnAdventurer(state), null);
  assert.equal(state.adventurers.length, 0);
});

test('spawns at the entrance on an interval tick when a path exists', () => {
  const state = createGameState();
  digRoute(state);
  state.tick = SPAWN_INTERVAL_TICKS;

  const adventurer = maybeSpawnAdventurer(state);

  assert.ok(adventurer);
  assert.deepEqual(adventurer?.pos, ENTRANCE_POS);
  assert.equal(state.adventurers.length, 1);
});

test('a monster or trap sitting on the route does not block spawning', () => {
  const state = createGameState();
  digRoute(state);
  state.monsters.push({ id: 1, kind: 'goblin', pos: { x: CORE_POS.x + 1, y: CORE_POS.y }, hp: 10, maxHp: 10, attack: 3 });
  state.traps.push({ pos: { x: CORE_POS.x + 2, y: CORE_POS.y }, kind: 'spike', damage: 6 });
  state.tick = SPAWN_INTERVAL_TICKS;

  assert.ok(maybeSpawnAdventurer(state));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/spawning.ts` does not exist yet.

- [ ] **Step 3: Write `src/spawning.ts`**

```typescript
import { GameState, Adventurer } from './state';
import { pathExists } from './pathfinding';
import { SPAWN_INTERVAL_TICKS, ADVENTURER_HP, ADVENTURER_ATTACK } from './economy';

export function maybeSpawnAdventurer(state: GameState): Adventurer | null {
  if (state.tick % SPAWN_INTERVAL_TICKS !== 0) return null;
  if (!pathExists(state.grid, state.grid.entrancePos, state.grid.corePos)) return null;

  const adventurer: Adventurer = {
    id: state.nextEntityId++,
    pos: { ...state.grid.entrancePos },
    hp: ADVENTURER_HP,
    maxHp: ADVENTURER_HP,
    attack: ADVENTURER_ATTACK,
  };
  state.adventurers.push(adventurer);
  return adventurer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/spawning.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/spawning.ts tests/spawning.test.ts
git commit -m "Add adventurer spawning: interval + path-exists check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 8: Tick Resolution (Combat) Module

**Files:**
- Create: `src/combat.ts`
- Test: `tests/combat.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Monster`, `Adventurer`, `samePos` from `src/state.ts`; `Pos`, `Grid` from `src/grid.ts`; `findPath` from `src/pathfinding.ts`; `maybeSpawnAdventurer` from `src/spawning.ts`; `MANA_PER_KILL` from `src/economy.ts`.
- Produces: `runTick(state): string[]` — mutates `state` in place per the spec's 8-step tick resolution order, returns the tick's event lines.

This is the core simulation function. It implements, in order: increment tick, maybe spawn, snapshot-based combat pairing (monster paired with every adventurer on its cell or orthogonally adjacent), simultaneous damage from a pre-tick tally, remove the dead, move survivors (blocked only if the next path cell holds a living monster — post-combat state, so a monster that died this tick no longer blocks), trap trigger on the newly-occupied cell, loss check, mana income.

- [ ] **Step 1: Write the failing tests**

Create `tests/combat.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';
import { GameState } from '../src/state';
import { runTick } from '../src/combat';

function makeState(grid: Grid, overrides: Partial<GameState> = {}): GameState {
  return {
    grid,
    mana: 50,
    tick: 0,
    monsters: [],
    adventurers: [],
    traps: [],
    runState: 'running',
    nextEntityId: 100,
    ...overrides,
  };
}

test('adventurer merely adjacent to a monster still moves and takes chip damage', () => {
  const grid = new Grid({ width: 5, height: 2, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });
  grid.dig({ x: 3, y: 1 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 3, y: 1 }, hp: 10, maxHp: 10, attack: 3 }],
    adventurers: [{ id: 2, pos: { x: 3, y: 0 }, hp: 12, maxHp: 12, attack: 4 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 2, y: 0 });
  assert.equal(state.adventurers[0].hp, 9);
  assert.equal(state.monsters[0].hp, 6);
});

test('adventurer whose next path cell holds a living monster stays in place', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 2, y: 0 }, hp: 10, maxHp: 10, attack: 3 }],
    adventurers: [{ id: 2, pos: { x: 3, y: 0 }, hp: 12, maxHp: 12, attack: 4 }],
  });

  runTick(state);

  assert.deepEqual(state.adventurers[0].pos, { x: 3, y: 0 });
});

test('adventurer can move into a cell whose monster died this tick, and its trap fires the same tick', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 2, y: 0 }, hp: 1, maxHp: 10, attack: 3 }],
    adventurers: [{ id: 2, pos: { x: 3, y: 0 }, hp: 12, maxHp: 12, attack: 4 }],
    traps: [{ pos: { x: 2, y: 0 }, kind: 'spike', damage: 6 }],
  });

  const events = runTick(state);

  assert.equal(state.monsters.length, 0);
  assert.deepEqual(state.adventurers[0].pos, { x: 2, y: 0 });
  assert.equal(state.adventurers[0].hp, 3); // 12 - 3 (combat) - 6 (trap)
  assert.equal(state.traps.length, 0);
  assert.ok(events.some((e) => e.includes('Trap triggered')));
});

test('a monster damages every adventurer paired with it in the same tick', () => {
  const grid = new Grid({ width: 3, height: 3, corePos: { x: 1, y: 0 }, entrancePos: { x: 1, y: 2 } });
  grid.dig({ x: 1, y: 1 });
  grid.dig({ x: 0, y: 1 });
  grid.dig({ x: 2, y: 1 });

  const state = makeState(grid, {
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 1, y: 1 }, hp: 10, maxHp: 10, attack: 3 }],
    adventurers: [
      { id: 2, pos: { x: 0, y: 1 }, hp: 12, maxHp: 12, attack: 4 },
      { id: 3, pos: { x: 2, y: 1 }, hp: 12, maxHp: 12, attack: 4 },
    ],
  });

  runTick(state);

  assert.equal(state.adventurers.find((a) => a.id === 2)?.hp, 9);
  assert.equal(state.adventurers.find((a) => a.id === 3)?.hp, 9);
  assert.equal(state.monsters[0].hp, 2); // 10 - 4 - 4
});

test('adventurer defeated in combat grants mana', () => {
  const grid = new Grid({ width: 3, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 2, y: 0 } });
  grid.dig({ x: 1, y: 0 });

  const state = makeState(grid, {
    mana: 0,
    monsters: [{ id: 1, kind: 'goblin', pos: { x: 1, y: 0 }, hp: 10, maxHp: 10, attack: 30 }],
    adventurers: [{ id: 2, pos: { x: 1, y: 0 }, hp: 1, maxHp: 12, attack: 4 }],
  });

  const events = runTick(state);

  assert.equal(state.adventurers.length, 0);
  assert.equal(state.mana, 12);
  assert.ok(events.some((e) => e.includes('defeated')));
});

test('adventurer reaching the core ends the run', () => {
  const grid = new Grid({ width: 2, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 1, y: 0 } });
  const state = makeState(grid, {
    adventurers: [{ id: 2, pos: { x: 1, y: 0 }, hp: 12, maxHp: 12, attack: 4 }],
  });

  const events = runTick(state);

  assert.equal(state.runState, 'over');
  assert.deepEqual(state.adventurers[0].pos, { x: 0, y: 0 });
  assert.ok(events.some((e) => e.includes('core')));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/combat.ts` does not exist yet.

- [ ] **Step 3: Write `src/combat.ts`**

```typescript
import { GameState, Monster, Adventurer, samePos } from './state';
import { Pos } from './grid';
import { findPath } from './pathfinding';
import { maybeSpawnAdventurer } from './spawning';
import { MANA_PER_KILL } from './economy';

function isAdjacentOrSame(a: Pos, b: Pos): boolean {
  if (samePos(a, b)) return true;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function runTick(state: GameState): string[] {
  const events: string[] = [];
  state.tick += 1;

  maybeSpawnAdventurer(state);

  // Steps 1-2: snapshot combat pairs (monster paired with every adventurer on/adjacent to its cell).
  const pairs: Array<{ monster: Monster; adventurer: Adventurer }> = [];
  for (const monster of state.monsters) {
    for (const adventurer of state.adventurers) {
      if (isAdjacentOrSame(monster.pos, adventurer.pos)) {
        pairs.push({ monster, adventurer });
      }
    }
  }

  // Step 3: tally and apply damage simultaneously, off start-of-tick hp.
  const monsterDamage = new Map<number, number>();
  const adventurerDamage = new Map<number, number>();
  for (const { monster, adventurer } of pairs) {
    adventurerDamage.set(adventurer.id, (adventurerDamage.get(adventurer.id) ?? 0) + monster.attack);
    monsterDamage.set(monster.id, (monsterDamage.get(monster.id) ?? 0) + adventurer.attack);
    events.push(`${capitalize(monster.kind)} hit Adventurer for ${monster.attack} damage.`);
    events.push(`Adventurer hit ${capitalize(monster.kind)} for ${adventurer.attack} damage.`);
  }
  for (const monster of state.monsters) {
    monster.hp -= monsterDamage.get(monster.id) ?? 0;
  }
  for (const adventurer of state.adventurers) {
    adventurer.hp -= adventurerDamage.get(adventurer.id) ?? 0;
  }

  // Step 4: remove the dead. Dead entities take no further action this tick.
  state.monsters = state.monsters.filter((m) => m.hp > 0);
  let killedThisTick = 0;
  state.adventurers = state.adventurers.filter((a) => {
    if (a.hp <= 0) {
      killedThisTick += 1;
      return false;
    }
    return true;
  });

  // Step 5: move survivors, using post-combat monster positions to decide blocking.
  for (const adventurer of state.adventurers) {
    const path = findPath(state.grid, adventurer.pos, state.grid.corePos);
    if (!path || path.length < 2) continue;
    const nextCell = path[1];
    const blockingMonster = state.monsters.find((m) => samePos(m.pos, nextCell));
    if (blockingMonster) continue;
    adventurer.pos = nextCell;
  }

  // Step 6: trap check on the cell each adventurer just moved into.
  for (const adventurer of [...state.adventurers]) {
    const trapIndex = state.traps.findIndex((t) => samePos(t.pos, adventurer.pos));
    if (trapIndex === -1) continue;
    const trap = state.traps[trapIndex];
    state.traps.splice(trapIndex, 1);
    adventurer.hp -= trap.damage;
    events.push(`Trap triggered on Adventurer for ${trap.damage} damage.`);
    if (adventurer.hp <= 0) {
      state.adventurers = state.adventurers.filter((a) => a.id !== adventurer.id);
      killedThisTick += 1;
    }
  }

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

  return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/combat.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/combat.ts tests/combat.test.ts
git commit -m "Add tick resolution: simultaneous combat, movement, traps, loss, mana

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 9: Tick Loop Controller

**Files:**
- Create: `src/loop.ts`
- Test: `tests/loop.test.ts`

**Interfaces:**
- Consumes: nothing beyond the global `setInterval`/`clearInterval`.
- Produces: `LoopCommandResult = 'ok' | 'already-paused' | 'already-running'`; class `TickLoop` with constructor `(tick: () => void, intervalMs: number)`, `start(): void`, `pause(): LoopCommandResult`, `resume(): LoopCommandResult`, `end(): void`, `isRunning(): boolean`. Holds exactly one interval handle at a time — `resume()` never creates a second one.

- [ ] **Step 1: Write the failing tests**

Create `tests/loop.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { TickLoop } from '../src/loop';

test('start begins running; pause and resume are idempotent and never throw', () => {
  const loop = new TickLoop(() => {}, 1_000_000); // long interval: won't fire during the test

  assert.equal(loop.isRunning(), false);

  loop.start();
  assert.equal(loop.isRunning(), true);

  assert.equal(loop.pause(), 'ok');
  assert.equal(loop.isRunning(), false);
  assert.equal(loop.pause(), 'already-paused');
  assert.equal(loop.isRunning(), false);

  assert.equal(loop.resume(), 'ok');
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.resume(), 'already-running');
  assert.equal(loop.isRunning(), true);

  loop.end();
  assert.equal(loop.isRunning(), false);
});

test('start called twice does not create a second interval', () => {
  let ticks = 0;
  const loop = new TickLoop(() => {
    ticks++;
  }, 1_000_000);

  loop.start();
  loop.start();
  assert.equal(loop.isRunning(), true);

  loop.end();
});

test('end stops the loop and resume after end does not restart it', () => {
  const loop = new TickLoop(() => {}, 1_000_000);
  loop.start();
  loop.end();

  assert.equal(loop.isRunning(), false);
  loop.resume();
  assert.equal(loop.isRunning(), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/loop.ts` does not exist yet.

- [ ] **Step 3: Write `src/loop.ts`**

```typescript
export type LoopCommandResult = 'ok' | 'already-paused' | 'already-running';

export class TickLoop {
  private handle: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private readonly tick: () => void, private readonly intervalMs: number) {}

  start(): void {
    if (this.stopped || this.handle !== null) return;
    this.handle = setInterval(this.tick, this.intervalMs);
  }

  pause(): LoopCommandResult {
    if (this.handle === null) return 'already-paused';
    clearInterval(this.handle);
    this.handle = null;
    return 'ok';
  }

  resume(): LoopCommandResult {
    if (this.stopped) return 'already-paused';
    if (this.handle !== null) return 'already-running';
    this.handle = setInterval(this.tick, this.intervalMs);
    return 'ok';
  }

  end(): void {
    if (this.handle !== null) clearInterval(this.handle);
    this.handle = null;
    this.stopped = true;
  }

  isRunning(): boolean {
    return this.handle !== null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/loop.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/loop.ts tests/loop.test.ts
git commit -m "Add TickLoop: single-handle setInterval controller, idempotent pause/resume

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 10: Command Parser & Dispatcher

**Files:**
- Create: `src/commands.ts`
- Test: `tests/commands.test.ts`

**Interfaces:**
- Consumes: `GameState` from `src/state.ts`; `digCell`, `spawnMonster`, `placeTrap` from `src/placement.ts`; `TickLoop` from `src/loop.ts`.
- Produces: `CommandContext { state: GameState; loop: TickLoop }`; `handleCommand(ctx, line): { lines: string[]; quit: boolean }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/commands.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/state';
import { TickLoop } from '../src/loop';
import { handleCommand, CommandContext } from '../src/commands';

function makeCtx(): CommandContext {
  return { state: createGameState(), loop: new TickLoop(() => {}, 1_000_000) };
}

test('help lists commands', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'help');
  assert.ok(lines[0].includes('Commands'));
});

test('status reports tick, mana, and run state', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'status');
  assert.ok(lines[0].includes('Tick: 0'));
  assert.ok(lines[0].includes('running'));
});

test('unknown command prints an error', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'frobnicate');
  assert.ok(lines[0].includes('Unknown command'));
});

test('dig delegates to placement and reports success', () => {
  const ctx = makeCtx();
  const target = { x: ctx.state.grid.entrancePos.x - 1, y: ctx.state.grid.entrancePos.y };
  const { lines } = handleCommand(ctx, `dig ${target.x} ${target.y}`);
  assert.ok(lines[0].startsWith('Dug'));
  assert.equal(ctx.state.grid.get(target), 'floor');
});

test('dig with bad arguments reports usage instead of throwing', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'dig not numbers');
  assert.ok(lines[0].startsWith('Usage'));
});

test('pause and resume are idempotent through the command layer', () => {
  const ctx = makeCtx();
  ctx.loop.start();
  assert.equal(handleCommand(ctx, 'pause').lines[0], 'Paused.');
  assert.equal(handleCommand(ctx, 'pause').lines[0], 'Already paused.');
  assert.equal(handleCommand(ctx, 'resume').lines[0], 'Resumed.');
  assert.equal(handleCommand(ctx, 'resume').lines[0], 'Already running.');
  ctx.loop.end();
});

test('gameplay commands are blocked after the run ends, but status and help still work', () => {
  const ctx = makeCtx();
  ctx.state.runState = 'over';

  assert.ok(handleCommand(ctx, 'dig 1 1').lines[0].startsWith('Run over'));
  assert.ok(handleCommand(ctx, 'pause').lines[0].startsWith('Run over'));
  assert.ok(!handleCommand(ctx, 'status').lines[0].startsWith('Run over'));
  assert.ok(!handleCommand(ctx, 'help').lines[0].startsWith('Run over'));
});

test('quit ends the loop and signals the caller to exit', () => {
  const ctx = makeCtx();
  ctx.loop.start();
  const { lines, quit } = handleCommand(ctx, 'quit');
  assert.equal(quit, true);
  assert.equal(ctx.loop.isRunning(), false);
  assert.ok(lines[0].includes('Goodbye'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/commands.ts` does not exist yet.

- [ ] **Step 3: Write `src/commands.ts`**

```typescript
import { GameState } from './state';
import { digCell, spawnMonster, placeTrap } from './placement';
import { TickLoop } from './loop';

export interface CommandContext {
  state: GameState;
  loop: TickLoop;
}

const GAMEPLAY_COMMANDS = new Set(['dig', 'spawn', 'trap', 'pause', 'resume']);

const HELP_TEXT = [
  'Commands:',
  '  dig x y',
  '  spawn <monsterKind> x y',
  '  trap <trapKind> x y',
  '  pause',
  '  resume',
  '  status',
  '  help',
  '  quit',
].join('\n');

export function handleCommand(ctx: CommandContext, line: string): { lines: string[]; quit: boolean } {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { lines: [], quit: false };
  const [cmd, ...args] = tokens;

  if (cmd === 'quit') {
    ctx.loop.end();
    return { lines: ['Goodbye.'], quit: true };
  }

  if (ctx.state.runState === 'over' && GAMEPLAY_COMMANDS.has(cmd)) {
    return { lines: ['Run over — type quit to exit.'], quit: false };
  }

  switch (cmd) {
    case 'help':
      return { lines: [HELP_TEXT], quit: false };
    case 'status':
      return { lines: [formatStatus(ctx.state)], quit: false };
    case 'pause': {
      const result = ctx.loop.pause();
      ctx.state.runState = 'paused';
      return { lines: [result === 'ok' ? 'Paused.' : 'Already paused.'], quit: false };
    }
    case 'resume': {
      const result = ctx.loop.resume();
      ctx.state.runState = 'running';
      return { lines: [result === 'ok' ? 'Resumed.' : 'Already running.'], quit: false };
    }
    case 'dig': {
      const pos = parsePos(args);
      if (!pos) return { lines: ['Usage: dig x y'], quit: false };
      const result = digCell(ctx.state, pos);
      return { lines: [result.ok ? `Dug (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    case 'spawn': {
      if (args.length !== 3) return { lines: ['Usage: spawn <monsterKind> x y'], quit: false };
      const [kind, ...rest] = args;
      const pos = parsePos(rest);
      if (!pos) return { lines: ['Usage: spawn <monsterKind> x y'], quit: false };
      const result = spawnMonster(ctx.state, kind, pos);
      return { lines: [result.ok ? `Spawned ${kind} at (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    case 'trap': {
      if (args.length !== 3) return { lines: ['Usage: trap <trapKind> x y'], quit: false };
      const [kind, ...rest] = args;
      const pos = parsePos(rest);
      if (!pos) return { lines: ['Usage: trap <trapKind> x y'], quit: false };
      const result = placeTrap(ctx.state, kind, pos);
      return { lines: [result.ok ? `Placed ${kind} trap at (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    default:
      return { lines: [`Unknown command: ${cmd}. Type 'help' for a list.`], quit: false };
  }
}

function parsePos(args: string[]): { x: number; y: number } | null {
  if (args.length !== 2) return null;
  const x = Number(args[0]);
  const y = Number(args[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function formatStatus(state: GameState): string {
  const lines = [
    `Tick: ${state.tick}`,
    `Mana: ${state.mana}`,
    `Run state: ${state.runState}`,
    `Core: (${state.grid.corePos.x}, ${state.grid.corePos.y})`,
    `Entrance: (${state.grid.entrancePos.x}, ${state.grid.entrancePos.y})`,
    `Adventurers: ${state.adventurers.map((a) => `#${a.id} (${a.pos.x},${a.pos.y}) hp ${a.hp}/${a.maxHp}`).join(', ') || 'none'}`,
    `Monsters: ${state.monsters.map((m) => `${m.kind}#${m.id} (${m.pos.x},${m.pos.y}) hp ${m.hp}/${m.maxHp}`).join(', ') || 'none'}`,
    `Traps: ${state.traps.map((t) => `${t.kind} (${t.pos.x},${t.pos.y})`).join(', ') || 'none'}`,
  ];
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/commands.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts tests/commands.test.ts
git commit -m "Add command parser/dispatcher: dig/spawn/trap/pause/resume/status/help/quit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 11: Renderer

**Files:**
- Create: `src/render.ts`

**Interfaces:**
- Consumes: `GameState` from `src/state.ts`.
- Produces: `render(state, events): string` — full screen text: grid (rendering precedence adventurer > monster > trap > terrain), status line (tick, mana, adventurer count, run state), then event lines if any.

No automated test for this module — the spec explicitly excludes end-to-end/rendering tests; it is a thin, mechanically-checkable print layer over already-tested state (Global Constraints). Verified manually in Task 12.

- [ ] **Step 1: Write `src/render.ts`**

```typescript
import { GameState } from './state';
import { Pos } from './grid';

const GLYPHS: Record<string, string> = {
  wall: '#',
  floor: '.',
  core: 'C',
  monster: 'm',
  adventurer: 'A',
  trap: 't',
};

export function render(state: GameState, events: string[]): string {
  const rows: string[] = [];
  for (let y = 0; y < state.grid.height; y++) {
    let row = '';
    for (let x = 0; x < state.grid.width; x++) {
      row += glyphAt(state, { x, y });
    }
    rows.push(row);
  }

  const status = `Tick: ${state.tick}  Mana: ${state.mana}  Adventurers: ${state.adventurers.length}  State: ${state.runState}`;

  return [...rows, '', status, ...(events.length ? ['', ...events] : [])].join('\n');
}

function glyphAt(state: GameState, pos: Pos): string {
  if (state.adventurers.some((a) => a.pos.x === pos.x && a.pos.y === pos.y)) return GLYPHS.adventurer;
  if (state.monsters.some((m) => m.pos.x === pos.x && m.pos.y === pos.y)) return GLYPHS.monster;
  if (state.traps.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return GLYPHS.trap;
  return GLYPHS[state.grid.get(pos)];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/render.ts
git commit -m "Add renderer: grid + status + event lines to a screen string

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Task 12: Main Entry Point & Manual Playtest

**Files:**
- Create: `src/main.ts`

**Interfaces:**
- Consumes: `createGameState` from `src/state.ts`; `runTick` from `src/combat.ts`; `TickLoop` from `src/loop.ts`; `handleCommand` from `src/commands.ts`; `render` from `src/render.ts`; `TICK_MS` from `src/economy.ts`.
- Produces: the runnable game (`npm run dev`). No further tasks depend on this — it is the composition root.

No automated test — this is I/O wiring (readline, console, timers) excluded from testing per the spec and Global Constraints. Verified by manual playtest below.

- [ ] **Step 1: Write `src/main.ts`**

```typescript
import * as readline from 'node:readline';
import { createGameState } from './state';
import { runTick } from './combat';
import { TickLoop } from './loop';
import { handleCommand } from './commands';
import { render } from './render';
import { TICK_MS } from './economy';

const state = createGameState();
let lastEvents: string[] = [];

function draw(): void {
  console.clear();
  console.log(render(state, lastEvents));
}

const loop = new TickLoop(() => {
  lastEvents = runTick(state);
  draw();
  if (state.runState === 'over') {
    loop.end();
  }
}, TICK_MS);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

draw();
loop.start();

rl.on('line', (line) => {
  const { lines, quit } = handleCommand({ state, loop }, line);
  lastEvents = [];
  draw();
  for (const l of lines) console.log(l);
  if (quit) {
    rl.close();
    process.exit(0);
  }
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Run the full test suite one more time**

Run: `npm test`
Expected: PASS — every test from Tasks 2-10 still green.

- [ ] **Step 4: Manual playtest**

Run: `npm run dev`

Verify by typing commands at the prompt:
1. `status` — shows tick 0, mana 50, run state running, core/entrance positions, no entities.
2. `dig 16 6`, `dig 15 6`, ... dig a route from `(16,6)` down to `(3,6)` connecting entrance `(17,6)` to core `(2,6)` — confirm each returns `Dug (x, y).` and mana drops by 2 each time.
3. `spawn goblin 10 6` — confirm `Spawned goblin at (10, 6).` and mana drops by 15.
4. `trap spike 8 6` — confirm `Placed spike trap at (8, 6).` and mana drops by 8.
5. Wait ~10 seconds (tick 10) — confirm an adventurer appears at the entrance and the screen redraws each second with an updated tick count.
6. Watch the adventurer approach the goblin — confirm combat event lines appear (`Goblin hit Adventurer for 3 damage.` etc.), the goblin either dies (mana +12 event) or survives and blocks the adventurer.
7. `pause` then `resume` — confirm `Paused.`/`Resumed.` and the tick count stops/resumes advancing.
8. `pause` twice in a row — confirm the second prints `Already paused.`
9. Let an adventurer reach the core (or remove all defenses) — confirm the run-over message and that `dig`/`spawn`/`trap`/`pause`/`resume` now respond `Run over — type quit to exit.` while `status` and `help` still work.
10. `quit` — confirm `Goodbye.` and the process exits.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "Add main entry point: wire readline, tick loop, commands, renderer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCSHpyhnSw1DZWSZa4AcBu"
```

---

## Post-Plan: What's Deliberately Not Here

Per the spec's "Explicitly Out of Scope for v1": loot tables, multiple adventurer classes, room specialization/synergies, save/load, difficulty scaling, trap reset/reload, graphical/TUI rendering. The only open question after this plan is **economy balance** — tune the numbers in `src/economy.ts` after playtesting; no architecture change is needed to do that.
