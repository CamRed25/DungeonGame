import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/state';
import { TickLoop } from '../src/loop';
import { handleCommand, CommandContext } from '../src/commands';

function makeCtx(): CommandContext {
  return { state: createGameState(), loop: new TickLoop(() => {}, 1_000_000) };
}

test('help lists commands', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'help');
  assert.ok(lines[0].includes('Commands'));
});

test('status reports tick, mana, and run state', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'status');
  assert.ok(lines[0].includes('Tick: 0'));
  assert.ok(lines[0].includes('running'));
});

test('unknown command prints an error', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'frobnicate');
  assert.ok(lines[0].includes('Unknown command'));
});

test('dig delegates to placement and reports success', () => {
  const ctx = makeCtx();
  const target = { x: ctx.state.grid.entrancePos.x - 1, y: ctx.state.grid.entrancePos.y };
  const { lines } = handleCommand(ctx, `dig ${target.x} ${target.y}`);
  assert.ok(lines[0].startsWith('Dug'));
  assert.equal(ctx.state.grid.get(target), 'floor');
});

test('dig with bad arguments reports usage instead of throwing', () => {
  const ctx = makeCtx();
  const { lines } = handleCommand(ctx, 'dig not numbers');
  assert.ok(lines[0].startsWith('Usage'));
});

test('pause and resume are idempotent through the command layer', () => {
  const ctx = makeCtx();
  ctx.loop.start();
  assert.equal(handleCommand(ctx, 'pause').lines[0], 'Paused.');
  assert.equal(handleCommand(ctx, 'pause').lines[0], 'Already paused.');
  assert.equal(handleCommand(ctx, 'resume').lines[0], 'Resumed.');
  assert.equal(handleCommand(ctx, 'resume').lines[0], 'Already running.');
  ctx.loop.end();
});

test('gameplay commands are blocked after the run ends, but status and help still work', () => {
  const ctx = makeCtx();
  ctx.state.runState = 'over';

  assert.ok(handleCommand(ctx, 'dig 1 1').lines[0].startsWith('Run over'));
  assert.ok(handleCommand(ctx, 'pause').lines[0].startsWith('Run over'));
  assert.ok(!handleCommand(ctx, 'status').lines[0].startsWith('Run over'));
  assert.ok(!handleCommand(ctx, 'help').lines[0].startsWith('Run over'));
});

test('quit ends the loop and signals the caller to exit', () => {
  const ctx = makeCtx();
  ctx.loop.start();
  const { lines, quit } = handleCommand(ctx, 'quit');
  assert.equal(quit, true);
  assert.equal(ctx.loop.isRunning(), false);
  assert.ok(lines[0].includes('Goodbye'));
});
