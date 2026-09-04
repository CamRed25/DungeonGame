import { GameState, monsterAt, trapAt } from './state';
import { Pos } from './grid';
import { getMonsterKind, getTrapKind, DIG_COST } from './economy';

export type ActionResult = { ok: true } | { ok: false; error: string };

export function digCell(state: GameState, pos: Pos): ActionResult {
  if (state.mana < DIG_COST) {
    return { ok: false, error: `Not enough mana: dig costs ${DIG_COST}, have ${state.mana}.` };
  }
  if (!state.grid.canDig(pos)) {
    return { ok: false, error: `Cannot dig (${pos.x}, ${pos.y}): not a diggable wall.` };
  }
  state.grid.dig(pos);
  state.mana -= DIG_COST;
  return { ok: true };
}

export function digLine(state: GameState, start: Pos, end: Pos): ActionResult {
  if (start.x !== end.x && start.y !== end.y) {
    return { ok: false, error: 'Dig line must be horizontal or vertical.' };
  }

  const stepX = Math.sign(end.x - start.x);
  const stepY = Math.sign(end.y - start.y);
  const length = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1;
  const cells = Array.from({ length }, (_, i) => ({
    x: start.x + stepX * i,
    y: start.y + stepY * i,
  }));

  if (cells.some((pos) => !state.grid.inBounds(pos))) {
    return { ok: false, error: 'Dig line is out of bounds.' };
  }
  if (cells.some((pos) => state.grid.get(pos) !== 'wall')) {
    return { ok: false, error: 'Dig line must contain only wall cells.' };
  }

  const cost = cells.length * DIG_COST;
  if (state.mana < cost) {
    return { ok: false, error: `Not enough mana: dig line costs ${cost}, have ${state.mana}.` };
  }

  const order = [cells, [...cells].reverse()].find((candidate) => canDigInOrder(state, candidate));
  if (!order) {
    return { ok: false, error: 'Dig line must start next to an existing floor or core cell.' };
  }

  for (const pos of order) state.grid.dig(pos);
  state.mana -= cost;
  return { ok: true };
}

function canDigInOrder(state: GameState, cells: Pos[]): boolean {
  const dug = new Set<string>();
  for (const pos of cells) {
    const adjacent = state.grid.neighbors(pos).some((neighbor) => {
      const key = `${neighbor.x},${neighbor.y}`;
      return dug.has(key) || state.grid.get(neighbor) === 'floor' || state.grid.get(neighbor) === 'core';
    });
    if (!adjacent) return false;
    dug.add(`${pos.x},${pos.y}`);
  }
  return true;
}

function isCoreOrEntrance(state: GameState, pos: Pos): boolean {
  const g = state.grid;
  return (
    (pos.x === g.corePos.x && pos.y === g.corePos.y) ||
    (pos.x === g.entrancePos.x && pos.y === g.entrancePos.y)
  );
}

export function spawnMonster(state: GameState, kindName: string, pos: Pos): ActionResult {
  if (!state.grid.inBounds(pos)) {
    return { ok: false, error: `(${pos.x}, ${pos.y}) is out of bounds.` };
  }
  const kind = getMonsterKind(kindName);
  if (!kind) {
    return { ok: false, error: `Unknown monster kind: ${kindName}.` };
  }
  if (state.mana < kind.cost) {
    return { ok: false, error: `Not enough mana: ${kindName} costs ${kind.cost}, have ${state.mana}.` };
  }
  if (state.grid.get(pos) !== 'floor') {
    return { ok: false, error: `Cannot place monster at (${pos.x}, ${pos.y}): not a floor cell.` };
  }
  if (isCoreOrEntrance(state, pos)) {
    return { ok: false, error: 'Cannot place a monster on the core or entrance.' };
  }
  if (monsterAt(state, pos)) {
    return { ok: false, error: `Cannot place monster at (${pos.x}, ${pos.y}): already occupied by a monster.` };
  }
  state.monsters.push({
    id: state.nextEntityId++,
    kind: kindName,
    pos,
    hp: kind.hp,
    maxHp: kind.hp,
    attack: kind.attack,
  });
  state.mana -= kind.cost;
  return { ok: true };
}

export function placeTrap(state: GameState, kindName: string, pos: Pos): ActionResult {
  if (!state.grid.inBounds(pos)) {
    return { ok: false, error: `(${pos.x}, ${pos.y}) is out of bounds.` };
  }
  const kind = getTrapKind(kindName);
  if (!kind) {
    return { ok: false, error: `Unknown trap kind: ${kindName}.` };
  }
  if (state.mana < kind.cost) {
    return { ok: false, error: `Not enough mana: ${kindName} costs ${kind.cost}, have ${state.mana}.` };
  }
  if (state.grid.get(pos) !== 'floor') {
    return { ok: false, error: `Cannot place trap at (${pos.x}, ${pos.y}): not a floor cell.` };
  }
  if (isCoreOrEntrance(state, pos)) {
    return { ok: false, error: 'Cannot place a trap on the core or entrance.' };
  }
  if (trapAt(state, pos)) {
    return { ok: false, error: `Cannot place trap at (${pos.x}, ${pos.y}): already occupied by a trap.` };
  }
  state.traps.push({ pos, kind: kindName, damage: kind.damage });
  state.mana -= kind.cost;
  return { ok: true };
}
