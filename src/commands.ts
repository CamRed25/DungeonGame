import { GameState } from './state';
import { digCell, digLine, spawnMonster, placeTrap } from './placement';
import { TickLoop } from './loop';

export interface CommandContext {
  state: GameState;
  loop: TickLoop;
}

const GAMEPLAY_COMMANDS = new Set(['dig', 'spawn', 'trap', 'pause', 'resume']);

const HELP_TEXT = [
  'Commands:',
  '  dig x y',
  '  dig line x1 y1 x2 y2',
  '  spawn <monsterKind> x y',
  '  trap <trapKind> x y',
  '  pause',
  '  resume',
  '  status',
  '  tutorial',
  '  help',
  '  quit',
].join('\n');

const TUTORIAL_TEXT = [
  'You are the dungeon core.',
  '1. Dig from the core or entrance to connect the dungeon.',
  '2. Spawn monsters on floor cells.',
  '3. Place traps along the route.',
  '4. Keep adventurers away from the core.',
  "Type 'help' for commands. Example: dig line 16 6 3 6",
].join('\n');

export function handleCommand(ctx: CommandContext, line: string): { lines: string[]; quit: boolean } {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { lines: [], quit: false };
  const [cmd, ...args] = tokens;

  if (cmd === 'quit') {
    ctx.loop.end();
    return { lines: ['Goodbye.'], quit: true };
  }

  if (ctx.state.runState === 'over' && GAMEPLAY_COMMANDS.has(cmd)) {
    return { lines: ['Run over — type quit to exit.'], quit: false };
  }

  switch (cmd) {
    case 'help':
      return { lines: [HELP_TEXT], quit: false };
    case 'status':
      return { lines: [formatStatus(ctx.state)], quit: false };
    case 'tutorial':
      return { lines: [TUTORIAL_TEXT], quit: false };
    case 'pause': {
      const result = ctx.loop.pause();
      ctx.state.runState = 'paused';
      return { lines: [result === 'ok' ? 'Paused.' : 'Already paused.'], quit: false };
    }
    case 'resume': {
      const result = ctx.loop.resume();
      ctx.state.runState = 'running';
      return { lines: [result === 'ok' ? 'Resumed.' : 'Already running.'], quit: false };
    }
    case 'dig': {
      if (args[0] === 'line') {
        if (args.length !== 5) return { lines: ['Usage: dig line x1 y1 x2 y2'], quit: false };
        const start = parsePos(args.slice(1, 3));
        const end = parsePos(args.slice(3, 5));
        if (!start || !end) return { lines: ['Usage: dig line x1 y1 x2 y2'], quit: false };
        const result = digLine(ctx.state, start, end);
        const cells = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1;
        return { lines: [result.ok ? `Dug ${cells} cells.` : result.error], quit: false };
      }
      const pos = parsePos(args);
      if (!pos) return { lines: ['Usage: dig x y'], quit: false };
      const result = digCell(ctx.state, pos);
      return { lines: [result.ok ? `Dug (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    case 'spawn': {
      if (args.length !== 3) return { lines: ['Usage: spawn <monsterKind> x y'], quit: false };
      const [kind, ...rest] = args;
      const pos = parsePos(rest);
      if (!pos) return { lines: ['Usage: spawn <monsterKind> x y'], quit: false };
      const result = spawnMonster(ctx.state, kind, pos);
      return { lines: [result.ok ? `Spawned ${kind} at (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    case 'trap': {
      if (args.length !== 3) return { lines: ['Usage: trap <trapKind> x y'], quit: false };
      const [kind, ...rest] = args;
      const pos = parsePos(rest);
      if (!pos) return { lines: ['Usage: trap <trapKind> x y'], quit: false };
      const result = placeTrap(ctx.state, kind, pos);
      return { lines: [result.ok ? `Placed ${kind} trap at (${pos.x}, ${pos.y}).` : result.error], quit: false };
    }
    default:
      return { lines: [`Unknown command: ${cmd}. Type 'help' for a list.`], quit: false };
  }
}

function parsePos(args: string[]): { x: number; y: number } | null {
  if (args.length !== 2) return null;
  const x = Number(args[0]);
  const y = Number(args[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function formatStatus(state: GameState): string {
  const lines = [
    `Tick: ${state.tick}`,
    `Mana: ${state.mana.toFixed(2)}`,
    `Run state: ${state.runState}`,
    `Core: (${state.grid.corePos.x}, ${state.grid.corePos.y})`,
    `Entrance: (${state.grid.entrancePos.x}, ${state.grid.entrancePos.y})`,
    `Adventurers: ${state.adventurers.map((a) => `${a.kind}#${a.id} (${a.pos.x},${a.pos.y}) hp ${a.hp}/${a.maxHp}`).join(', ') || 'none'}`,
    `Monsters: ${state.monsters.map((m) => `${m.kind}#${m.id} (${m.pos.x},${m.pos.y}) hp ${m.hp}/${m.maxHp}`).join(', ') || 'none'}`,
    `Traps: ${state.traps.map((t) => `${t.kind} (${t.pos.x},${t.pos.y})`).join(', ') || 'none'}`,
  ];
  return lines.join('\n');
}
