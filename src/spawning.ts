import { GameState, Adventurer } from './state';
import { pathExists } from './pathfinding';
import { SPAWN_INTERVAL_TICKS, ADVENTURER_KINDS, ADVENTURER_SPAWN_WEIGHTS, AdventurerKind } from './economy';

export function selectAdventurerKind(
  weights: Record<AdventurerKind, number>,
  roll: number,
): AdventurerKind {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let cursor = roll * total;
  for (const [kind, weight] of Object.entries(weights) as [AdventurerKind, number][]) {
    if (cursor < weight) return kind;
    cursor -= weight;
  }
  return 'warrior'; // unreachable given roll < 1, keeps the return type total
}

export function maybeSpawnAdventurer(
  state: GameState,
  rng: () => number = Math.random,
): Adventurer | null {
  if (state.tick % SPAWN_INTERVAL_TICKS !== 0) return null;
  if (!pathExists(state.grid, state.grid.entrancePos, state.grid.corePos)) return null;

  const kind = selectAdventurerKind(ADVENTURER_SPAWN_WEIGHTS, rng());
  const kindDef = ADVENTURER_KINDS[kind];
  const adventurer: Adventurer = {
    id: state.nextEntityId++,
    kind,
    pos: { ...state.grid.entrancePos },
    hp: kindDef.hp,
    maxHp: kindDef.hp,
    attack: kindDef.attack,
  };
  state.adventurers.push(adventurer);
  return adventurer;
}
