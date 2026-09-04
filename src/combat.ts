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
