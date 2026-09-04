import { GameState } from './state';
import { Pos } from './grid';
import { AdventurerKind } from './economy';

const GLYPHS: Record<string, string> = {
  wall: '#',
  floor: '.',
  core: 'C',
  monster: 'm',
  trap: 't',
};

const ADVENTURER_GLYPHS: Record<AdventurerKind, string> = {
  warrior: 'W',
  scout: 'S',
  mage: 'M',
  rogue: 'R',
};

export function render(state: GameState, events: string[]): string {
  const rows: string[] = [coordinateHeader(state.grid.width)];
  for (let y = 0; y < state.grid.height; y++) {
    let row = '';
    for (let x = 0; x < state.grid.width; x++) {
      row += glyphAt(state, { x, y });
    }
    rows.push(`${String(y).padStart(2, '0')}  ${row}`);
  }

  const status = `Tick: ${state.tick}  Mana: ${state.mana.toFixed(2)}  Adventurers: ${state.adventurers.length}  State: ${state.runState}`;

  return [...rows, '', status, ...(events.length ? ['', ...events] : [])].join('\n');
}

function coordinateHeader(width: number): string {
  const tens = Array.from({ length: width }, (_, x) => Math.floor(x / 10)).join('');
  const ones = Array.from({ length: width }, (_, x) => x % 10).join('');
  return `    ${tens}\n    ${ones}`;
}

function glyphAt(state: GameState, pos: Pos): string {
  if (state.runState === 'over' && pos.x === state.grid.corePos.x && pos.y === state.grid.corePos.y) return 'X';
  const adventurer = state.adventurers.find((a) => a.pos.x === pos.x && a.pos.y === pos.y);
  if (adventurer) return ADVENTURER_GLYPHS[adventurer.kind];
  if (state.monsters.some((m) => m.pos.x === pos.x && m.pos.y === pos.y)) return GLYPHS.monster;
  if (state.traps.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return GLYPHS.trap;
  return GLYPHS[state.grid.get(pos)];
}
