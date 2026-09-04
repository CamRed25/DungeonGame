import { Pos } from './grid';

export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 12;
export const CORE_POS: Pos = { x: 2, y: 6 };
export const ENTRANCE_POS: Pos = { x: 17, y: 6 };

export const STARTING_MANA = 50;
export const DIG_COST = 2;
export const MANA_PER_KILL = 12;
export const PASSIVE_MANA_PER_MINUTE = 0.1;
export const TICK_MS = 1000;
export const SPAWN_INTERVAL_TICKS = 10;
export const PASSIVE_MANA_PER_TICK = PASSIVE_MANA_PER_MINUTE / (60_000 / TICK_MS);

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

export type AdventurerKind = 'warrior' | 'scout' | 'mage' | 'rogue';

export interface AdventurerKindDef {
  name: AdventurerKind;
  hp: number;
  attack: number;
  moveSpeed: number;
  attackRange: number;
  avoidsTraps: boolean;
}

export const ADVENTURER_KINDS: Record<AdventurerKind, AdventurerKindDef> = {
  warrior: { name: 'warrior', hp: 24, attack: 6, moveSpeed: 1, attackRange: 1, avoidsTraps: false },
  scout: { name: 'scout', hp: 10, attack: 3, moveSpeed: 2, attackRange: 1, avoidsTraps: false },
  mage: { name: 'mage', hp: 8, attack: 5, moveSpeed: 1, attackRange: 3, avoidsTraps: false },
  rogue: { name: 'rogue', hp: 10, attack: 4, moveSpeed: 1, attackRange: 1, avoidsTraps: true },
};

export const ADVENTURER_SPAWN_WEIGHTS: Record<AdventurerKind, number> = {
  warrior: 40,
  scout: 30,
  rogue: 20,
  mage: 10,
};
