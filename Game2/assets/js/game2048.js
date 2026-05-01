let nextTileId = 1;

const vectors = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
};

export class Game2048 {
  constructor(size = 4) {
    this.size = size;
    this.reset();
  }

  reset() {
    this.cells = this.createGrid();
    this.score = 0;
    this.moves = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;
    this.addRandomTile();
    this.addRandomTile();
  }

  move(direction) {
    const vector = vectors[direction];

    if (!vector || this.isGameTerminated()) {
      return { moved: false, scoreGain: 0, mergedValues: [], won: this.won, over: this.over };
    }

    const traversals = this.buildTraversals(vector);
    const mergedValues = [];
    let moved = false;
    let scoreGain = 0;

    this.prepareTiles();

    traversals.rows.forEach((row) => {
      traversals.cols.forEach((col) => {
        const cell = { row, col };
        const tile = this.cellContent(cell);

        if (!tile) {
          return;
        }

        const positions = this.findFarthestPosition(cell, vector);
        const next = this.cellContent(positions.next);

        if (next && next.value === tile.value && !next.mergedFrom) {
          const merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          this.insertTile(merged);
          this.removeTile(tile);

          tile.updatePosition(positions.next);
          scoreGain += merged.value;
          mergedValues.push(merged.value);
          this.score += merged.value;

          if (merged.value === 2048) {
            this.won = true;
          }
        } else {
          this.moveTile(tile, positions.farthest);
        }

        if (!this.positionsEqual(cell, tile)) {
          moved = true;
        }
      });
    });

    if (moved) {
      this.moves += 1;
      this.addRandomTile();

      if (!this.movesAvailable()) {
        this.over = true;
      }
    }

    return {
      moved,
      scoreGain,
      mergedValues,
      won: this.won,
      over: this.over,
      maxTile: this.getMaxTile(),
    };
  }

  getTiles() {
    return this.cells.flat().filter(Boolean);
  }

  getMaxTile() {
    return this.getTiles().reduce((max, tile) => Math.max(max, tile.value), 2);
  }

  continueAfterWin() {
    this.keepPlaying = true;
  }

  isGameTerminated() {
    return this.over || (this.won && !this.keepPlaying);
  }

  createGrid() {
    return Array.from({ length: this.size }, () => Array.from({ length: this.size }, () => null));
  }

  availableCells() {
    const cells = [];

    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        if (!this.cells[row][col]) {
          cells.push({ row, col });
        }
      }
    }

    return cells;
  }

  randomAvailableCell() {
    const cells = this.availableCells();
    return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
  }

  addRandomTile() {
    const cell = this.randomAvailableCell();

    if (!cell) {
      return;
    }

    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = new Tile(cell, value);
    tile.isNew = true;
    this.insertTile(tile);
  }

  insertTile(tile) {
    this.cells[tile.row][tile.col] = tile;
  }

  removeTile(tile) {
    this.cells[tile.row][tile.col] = null;
  }

  moveTile(tile, cell) {
    this.cells[tile.row][tile.col] = null;
    this.cells[cell.row][cell.col] = tile;
    tile.updatePosition(cell);
  }

  prepareTiles() {
    this.getTiles().forEach((tile) => {
      tile.mergedFrom = null;
      tile.isNew = false;
      tile.savePosition();
    });
  }

  buildTraversals(vector) {
    const traversals = {
      rows: Array.from({ length: this.size }, (_, index) => index),
      cols: Array.from({ length: this.size }, (_, index) => index),
    };

    if (vector.row === 1) {
      traversals.rows.reverse();
    }

    if (vector.col === 1) {
      traversals.cols.reverse();
    }

    return traversals;
  }

  findFarthestPosition(cell, vector) {
    let previous;

    do {
      previous = cell;
      cell = {
        row: previous.row + vector.row,
        col: previous.col + vector.col,
      };
    } while (this.withinBounds(cell) && this.cellAvailable(cell));

    return {
      farthest: previous,
      next: cell,
    };
  }

  movesAvailable() {
    return this.availableCells().length > 0 || this.tileMatchesAvailable();
  }

  tileMatchesAvailable() {
    const directions = Object.values(vectors);

    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.cellContent({ row, col });

        if (!tile) {
          continue;
        }

        for (const vector of directions) {
          const other = this.cellContent({ row: row + vector.row, col: col + vector.col });

          if (other && other.value === tile.value) {
            return true;
          }
        }
      }
    }

    return false;
  }

  cellAvailable(cell) {
    return !this.cellOccupied(cell);
  }

  cellOccupied(cell) {
    return Boolean(this.cellContent(cell));
  }

  cellContent(cell) {
    return this.withinBounds(cell) ? this.cells[cell.row][cell.col] : null;
  }

  withinBounds(cell) {
    return cell.row >= 0 && cell.row < this.size && cell.col >= 0 && cell.col < this.size;
  }

  positionsEqual(first, second) {
    return first.row === second.row && first.col === second.col;
  }
}

class Tile {
  constructor(position, value) {
    this.id = nextTileId;
    nextTileId += 1;
    this.row = position.row;
    this.col = position.col;
    this.value = value;
    this.previousPosition = null;
    this.mergedFrom = null;
    this.isNew = false;
  }

  savePosition() {
    this.previousPosition = { row: this.row, col: this.col };
  }

  updatePosition(position) {
    this.row = position.row;
    this.col = position.col;
  }
}
