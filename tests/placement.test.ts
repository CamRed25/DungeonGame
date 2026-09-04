import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/state';
import { digCell, digLine, spawnMonster, placeTrap } from '../src/placement';
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

test('digLine digs a horizontal route in either direction and charges per cell', () => {
  const state = createGameState();
  const before = state.mana;

  const result = digLine(state, { x: 16, y: 6 }, { x: 3, y: 6 });

  assert.deepEqual(result, { ok: true });
  for (let x = 3; x <= 16; x++) {
    assert.equal(state.grid.get({ x, y: 6 }), 'floor');
  }
  assert.equal(state.mana, before - 14 * 2);
});

test('digLine rejects diagonal lines without changing state', () => {
  const state = createGameState();
  const before = state.mana;

  const result = digLine(state, { x: 16, y: 6 }, { x: 15, y: 5 });

  assert.equal(result.ok, false);
  assert.equal(state.mana, before);
  assert.equal(state.grid.get({ x: 16, y: 6 }), 'wall');
  assert.equal(state.grid.get({ x: 15, y: 5 }), 'wall');
});

test('digLine validates the whole line before spending mana', () => {
  const state = createGameState();
  const before = state.mana;
  state.mana = 2;

  const result = digLine(state, { x: 16, y: 6 }, { x: 3, y: 6 });

  assert.equal(result.ok, false);
  assert.equal(state.mana, 2);
  assert.equal(state.grid.get({ x: 16, y: 6 }), 'wall');
  assert.equal(before, 50);
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
