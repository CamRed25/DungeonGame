import { Grid, Pos } from './grid';
import { GRID_WIDTH, GRID_HEIGHT, CORE_POS, ENTRANCE_POS, STARTING_MANA } from './economy';

export type RunState = 'running' | 'paused' | 'over';

export interface Monster {
  id: number;
  kind: string;
  pos: Pos;
  hp: number;
  maxHp: number;
  attack: number;
}

export interface Adventurer {
  id: number;
  pos: Pos;
  hp: number;
  maxHp: number;
  attack: number;
}

export interface Trap {
  pos: Pos;
  kind: string;
  damage: number;
}

export interface GameState {
  grid: Grid;
  mana: number;
  tick: number;
  monsters: Monster[];
  adventurers: Adventurer[];
  traps: Trap[];
  runState: RunState;
  nextEntityId: number;
}

export function createGameState(): GameState {
  return {
    grid: new Grid({ width: GRID_WIDTH, height: GRID_HEIGHT, corePos: CORE_POS, entrancePos: ENTRANCE_POS }),
    mana: STARTING_MANA,
    tick: 0,
    monsters: [],
    adventurers: [],
    traps: [],
    runState: 'running',
    nextEntityId: 1,
  };
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function monsterAt(state: GameState, pos: Pos): Monster | undefined {
  return state.monsters.find((m) => samePos(m.pos, pos));
}

export function trapAt(state: GameState, pos: Pos): Trap | undefined {
  return state.traps.find((t) => samePos(t.pos, pos));
}

export function adventurersAt(state: GameState, pos: Pos): Adventurer[] {
  return state.adventurers.filter((a) => samePos(a.pos, pos));
}
