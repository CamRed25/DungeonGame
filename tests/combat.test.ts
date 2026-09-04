import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';
import { GameState } from '../src/state';
import { runTick } from '../src/combat';
import { PASSIVE_MANA_PER_TICK } from '../src/economy';

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
  assert.ok(events.some((e) => e.includes('Goblin defeated')));
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
  assert.equal(state.mana, 12 + PASSIVE_MANA_PER_TICK);
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

test('passive mana accumulates at 0.1 per minute', () => {
  const state = makeState(new Grid({
    width: 1,
    height: 1,
    corePos: { x: 0, y: 0 },
    entrancePos: { x: 0, y: 0 },
  }), { mana: 0 });

  for (let i = 0; i < 60; i++) runTick(state);

  assert.ok(Math.abs(state.mana - 0.1) < 1e-9);
});
