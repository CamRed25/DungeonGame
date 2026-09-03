import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid';
import { findPath, pathExists } from '../src/pathfinding';

test('findPath returns the shortest path across open floor', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });

  const path = findPath(grid, { x: 4, y: 0 }, { x: 0, y: 0 });

  assert.ok(path);
  assert.deepEqual(path, [
    { x: 4, y: 0 },
    { x: 3, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ]);
});

test('findPath returns null when no route exists', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  const path = findPath(grid, { x: 4, y: 0 }, { x: 0, y: 0 });
  assert.equal(path, null);
});

test('findPath picks the shorter of two available routes', () => {
  const grid = new Grid({ width: 3, height: 3, corePos: { x: 1, y: 0 }, entrancePos: { x: 1, y: 2 } });
  grid.dig({ x: 1, y: 1 }); // direct 1-cell route through the middle
  grid.dig({ x: 0, y: 1 });
  grid.dig({ x: 0, y: 0 });
  grid.dig({ x: 0, y: 2 }); // a longer detour also exists

  const path = findPath(grid, { x: 1, y: 2 }, { x: 1, y: 0 });

  assert.equal(path?.length, 3);
});

test('pathExists mirrors findPath reachability', () => {
  const grid = new Grid({ width: 5, height: 1, corePos: { x: 0, y: 0 }, entrancePos: { x: 4, y: 0 } });
  assert.equal(pathExists(grid, { x: 4, y: 0 }, { x: 0, y: 0 }), false);
  grid.dig({ x: 3, y: 0 });
  grid.dig({ x: 2, y: 0 });
  grid.dig({ x: 1, y: 0 });
  assert.equal(pathExists(grid, { x: 4, y: 0 }, { x: 0, y: 0 }), true);
});
