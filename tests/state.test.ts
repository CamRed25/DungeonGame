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
