import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonsterKind, getTrapKind, MONSTER_KINDS, TRAP_KINDS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS } from '../src/economy';

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

test('ADVENTURER_KINDS defines all four v2 classes with their documented stats', () => {
  assert.deepEqual(ADVENTURER_KINDS.warrior, { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.scout, { name: 'scout', hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.mage, { name: 'mage', hp: 8, attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false });
  assert.deepEqual(ADVENTURER_KINDS.rogue, { name: 'rogue', hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true });
});

test('ADVENTURER_SPAWN_WEIGHTS matches the documented spawn distribution', () => {
  assert.deepEqual(ADVENTURER_SPAWN_WEIGHTS, { warrior: 40, scout: 30, rogue: 20, mage: 10 });
});
