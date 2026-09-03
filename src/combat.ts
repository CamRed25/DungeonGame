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
