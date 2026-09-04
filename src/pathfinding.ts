import { Grid, Pos } from './grid';

function key(pos: Pos): string {
  return `${pos.x},${pos.y}`;
}

export function findPath(grid: Grid, start: Pos, goal: Pos, avoid?: Set<string>): Pos[] | null {
  if (start.x === goal.x && start.y === goal.y) return [start];

  const visited = new Set<string>([key(start)]);
  const cameFrom = new Map<string, Pos>();
  const queue: Pos[] = [start];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    for (const next of grid.neighbors(current)) {
      const k = key(next);
      if (visited.has(k)) continue;
      if (grid.get(next) === 'wall') continue;
      if (avoid?.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, current);
      if (next.x === goal.x && next.y === goal.y) {
        return reconstructPath(cameFrom, start, next);
      }
      queue.push(next);
    }
  }
  return null;
}

function reconstructPath(cameFrom: Map<string, Pos>, start: Pos, goal: Pos): Pos[] {
  const path: Pos[] = [goal];
  let current = goal;
  while (!(current.x === start.x && current.y === start.y)) {
    const prev = cameFrom.get(key(current));
    if (!prev) throw new Error('broken path reconstruction');
    path.push(prev);
    current = prev;
  }
  return path.reverse();
}

export function pathExists(grid: Grid, start: Pos, goal: Pos): boolean {
  return findPath(grid, start, goal) !== null;
}
