import { Pos } from './grid';

export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 12;
export const CORE_POS: Pos = { x: 2, y: 6 };
export const ENTRANCE_POS: Pos = { x: 17, y: 6 };

export const STARTING_MANA = 50;
export const DIG_COST = 2;
export const MANA_PER_KILL = 12;
export const TICK_MS = 1000;
export const SPAWN_INTERVAL_TICKS = 10;

export const ADVENTURER_HP = 12;
export const ADVENTURER_ATTACK = 4;

export interface MonsterKindDef {
  name: string;
  cost: number;
  hp: number;
  attack: number;
}

export interface TrapKindDef {
  name: string;
  cost: number;
  damage: number;
}

export const MONSTER_KINDS: Record<string, MonsterKindDef> = {
  goblin: { name: 'goblin', cost: 15, hp: 10, attack: 3 },
};

export const TRAP_KINDS: Record<string, TrapKindDef> = {
  spike: { name: 'spike', cost: 8, damage: 6 },
};

export function getMonsterKind(name: string): MonsterKindDef | undefined {
  return MONSTER_KINDS[name];
}

export function getTrapKind(name: string): TrapKindDef | undefined {
  return TRAP_KINDS[name];
}
