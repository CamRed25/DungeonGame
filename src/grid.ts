export type CellKind = 'wall' | 'floor' | 'core';

export interface Pos {
  x: number;
  y: number;
}

export interface GridConfig {
  width: number;
  height: number;
  corePos: Pos;
  entrancePos: Pos;
}

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly corePos: Pos;
  readonly entrancePos: Pos;
  private cells: CellKind[][];

  constructor(config: GridConfig) {
    this.width = config.width;
    this.height = config.height;
    this.corePos = config.corePos;
    this.entrancePos = config.entrancePos;
    this.cells = [];
    for (let y = 0; y < this.height; y++) {
      const row: CellKind[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push('wall');
      }
      this.cells.push(row);
    }
    this.cells[this.corePos.y][this.corePos.x] = 'core';
    this.cells[this.entrancePos.y][this.entrancePos.x] = 'floor';
  }

  inBounds(pos: Pos): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  get(pos: Pos): CellKind {
    if (!this.inBounds(pos)) {
      throw new Error(`out of bounds: (${pos.x}, ${pos.y})`);
    }
    return this.cells[pos.y][pos.x];
  }

  neighbors(pos: Pos): Pos[] {
    const candidates: Pos[] = [
      { x: pos.x, y: pos.y - 1 },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x + 1, y: pos.y },
    ];
    return candidates.filter((p) => this.inBounds(p));
  }

  canDig(pos: Pos): boolean {
    if (!this.inBounds(pos)) return false;
    if (this.get(pos) !== 'wall') return false;
    return this.neighbors(pos).some((n) => {
      const kind = this.get(n);
      return kind === 'floor' || kind === 'core';
    });
  }

  dig(pos: Pos): boolean {
    if (!this.canDig(pos)) return false;
    this.cells[pos.y][pos.x] = 'floor';
    return true;
  }
}
