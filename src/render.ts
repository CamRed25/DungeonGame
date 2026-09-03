import { GameState } from './state';
import { Pos } from './grid';

const GLYPHS: Record<string, string> = {
  wall: '#',
  floor: '.',
  core: 'C',
  monster: 'm',
  adventurer: 'A',
  trap: 't',
};

export function render(state: GameState, events: string[]): string {
  const rows: string[] = [];
  for (let y = 0; y < state.grid.height; y++) {
    let row = '';
    for (let x = 0; x < state.grid.width; x++) {
      row += glyphAt(state, { x, y });
    }
    rows.push(row);
  }

  const status = `Tick: ${state.tick}  Mana: ${state.mana}  Adventurers: ${state.adventurers.length}  State: ${state.runState}`;

  return [...rows, '', status, ...(events.length ? ['', ...events] : [])].join('\n');
}

function glyphAt(state: GameState, pos: Pos): string {
  if (state.adventurers.some((a) => a.pos.x === pos.x && a.pos.y === pos.y)) return GLYPHS.adventurer;
  if (state.monsters.some((m) => m.pos.x === pos.x && m.pos.y === pos.y)) return GLYPHS.monster;
  if (state.traps.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return GLYPHS.trap;
  return GLYPHS[state.grid.get(pos)];
}
