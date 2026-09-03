import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';

function testGrid(): Grid {
  return new Grid({ width: 5, height: 5, corePos: { x: 1, y: 1 }, entrancePos: { x: 3, y: 3 } });
}

test('initial grid places core, entrance, and walls everywhere else', () => {
  const grid = testGrid();
  assert.equal(grid.get({ x: 1, y: 1 }), 'core');
  assert.equal(grid.get({ x: 3, y: 3 }), 'floor');
  assert.equal(grid.get({ x: 0, y: 0 }), 'wall');
  assert.equal(grid.get({ x: 4, y: 4 }), 'wall');
});

test('canDig is true for a wall adjacent to the entrance', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 2, y: 3 }), true);
  assert.equal(grid.canDig({ x: 4, y: 3 }), true);
});

test('canDig is false for a wall not adjacent to any floor or core', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 0, y: 4 }), false);
});

test('canDig is false for the core cell and the entrance cell', () => {
  const grid = testGrid();
  assert.equal(grid.canDig({ x: 1, y: 1 }), false);
  assert.equal(grid.canDig({ x: 3, y: 3 }), false);
});

test('dig converts a diggable wall to floor and returns true', () => {
  const grid = testGrid();
  const result = grid.dig({ x: 2, y: 3 });
  assert.equal(result, true);
  assert.equal(grid.get({ x: 2, y: 3 }), 'floor');
});

test('dig on a non-diggable cell is a no-op and returns false', () => {
  const grid = testGrid();
  const result = grid.dig({ x: 0, y: 4 });
  assert.equal(result, false);
  assert.equal(grid.get({ x: 0, y: 4 }), 'wall');
});

test('digging extends the frontier: a cell adjacent to newly dug floor becomes diggable', () => {
  const grid = testGrid();
  grid.dig({ x: 2, y: 3 });
  assert.equal(grid.canDig({ x: 1, y: 3 }), true);
});

test('inBounds is false outside the grid', () => {
  const grid = testGrid();
  assert.equal(grid.inBounds({ x: -1, y: 0 }), false);
  assert.equal(grid.inBounds({ x: 5, y: 0 }), false);
});
