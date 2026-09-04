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
