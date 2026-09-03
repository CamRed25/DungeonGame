import test from 'node:test';
import assert from 'node:assert/strict';
import { TickLoop } from '../src/loop';

test('start begins running; pause and resume are idempotent and never throw', () => {
  const loop = new TickLoop(() => {}, 1_000_000); // long interval: won't fire during the test

  assert.equal(loop.isRunning(), false);

  loop.start();
  assert.equal(loop.isRunning(), true);

  assert.equal(loop.pause(), 'ok');
  assert.equal(loop.isRunning(), false);
  assert.equal(loop.pause(), 'already-paused');
  assert.equal(loop.isRunning(), false);

  assert.equal(loop.resume(), 'ok');
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.resume(), 'already-running');
  assert.equal(loop.isRunning(), true);

  loop.end();
  assert.equal(loop.isRunning(), false);
});

test('start called twice does not create a second interval', () => {
  let ticks = 0;
  const loop = new TickLoop(() => {
    ticks++;
  }, 1_000_000);

  loop.start();
  loop.start();
  assert.equal(loop.isRunning(), true);

  loop.end();
});

test('end stops the loop and resume after end does not restart it', () => {
  const loop = new TickLoop(() => {}, 1_000_000);
  loop.start();
  loop.end();

  assert.equal(loop.isRunning(), false);
  loop.resume();
  assert.equal(loop.isRunning(), false);
});
