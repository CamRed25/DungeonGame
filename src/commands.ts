import { GameState } from './state';
import { digCell, spawnMonster, placeTrap } from './placement';
import { TickLoop } from './loop';

export interface CommandContext {
  state: GameState;
  loop: TickLoop;
}

const GAMEPLAY_COMMANDS = new Set(['dig', 'spawn', 'trap', 'pause', 'resume']);

const HELP_TEXT = [
  'Commands:',
  '  dig x y',
  '  spawn <monsterKind> x y',
  '  trap <trapKind> x y',
  '  pause',
  '  resume',
  '  status',
  '  help',
  '  quit',
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
    `Mana: ${state.mana}`,
    `Run state: ${state.runState}`,
    `Core: (${state.grid.corePos.x}, ${state.grid.corePos.y})`,
    `Entrance: (${state.grid.entrancePos.x}, ${state.grid.entrancePos.y})`,
    `Adventurers: ${state.adventurers.map((a) => `#${a.id} (${a.pos.x},${a.pos.y}) hp ${a.hp}/${a.maxHp}`).join(', ') || 'none'}`,
    `Monsters: ${state.monsters.map((m) => `${m.kind}#${m.id} (${m.pos.x},${m.pos.y}) hp ${m.hp}/${m.maxHp}`).join(', ') || 'none'}`,
    `Traps: ${state.traps.map((t) => `${t.kind} (${t.pos.x},${t.pos.y})`).join(', ') || 'none'}`,
  ];
  return lines.join('\n');
}
