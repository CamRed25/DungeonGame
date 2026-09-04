import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, GameState } from '../src/state';
import { maybeSpawnAdventurer, selectAdventurerKind } from '../src/spawning';
import { digCell } from '../src/placement';
import { ENTRANCE_POS, CORE_POS, SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS } from '../src/economy';

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

  const adventurer = maybeSpawnAdventurer(state, () => 0); // deterministic: lands in the warrior slot

  assert.ok(adventurer);
  assert.deepEqual(adventurer?.pos, ENTRANCE_POS);
  assert.equal(state.adventurers.length, 1);
  assert.equal(adventurer?.kind, 'warrior');
  assert.equal(adventurer?.hp, ADVENTURER_KINDS.warrior.hp);
  assert.equal(adventurer?.attack, ADVENTURER_KINDS.warrior.attack);
});

test('a monster or trap sitting on the route does not block spawning', () => {
  const state = createGameState();
  digRoute(state);
  state.monsters.push({ id: 1, kind: 'goblin', pos: { x: CORE_POS.x + 1, y: CORE_POS.y }, hp: 10, maxHp: 10, attack: 3 });
  state.traps.push({ pos: { x: CORE_POS.x + 2, y: CORE_POS.y }, kind: 'spike', damage: 6 });
  state.tick = SPAWN_INTERVAL_TICKS;

  assert.ok(maybeSpawnAdventurer(state));
});

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
