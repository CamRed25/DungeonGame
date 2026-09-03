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
