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
