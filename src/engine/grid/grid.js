/**
 * Occupancy grid construction for the unified RoboPath planning engine.
 *
 * The grid is the single representation shared by the 2D simulator, the 3D
 * simulator, the comparison runner and the analytics pipeline. Column index
 * maps to world X, row index maps to world Z, and the vertical axis (Y in
 * Three.js) is reserved exclusively for obstacle height and robot elevation.
 */

import { clamp } from '../geometry.js';

export const MIN_DIMENSION = 4;
export const MAX_DIMENSION = 120;

/**
 * @typedef {object} GridSpec
 * @property {number} rows
 * @property {number} cols
 * @property {number} cellSize        world size of one cell, in metres
 * @property {boolean[]} blocked       length rows*cols, true = occupied
 * @property {number[]} [weights]     length rows*cols, traversal multiplier
 * @property {{row:number,col:number}} start
 * @property {{row:number,col:number}} goal
 */

/**
 * Build an occupancy grid from a grid spec, validating and normalising it.
 */
export function buildOccupancyGrid(spec) {
  const rows = clamp(Math.round(spec?.rows ?? 20), MIN_DIMENSION, MAX_DIMENSION);
  const cols = clamp(Math.round(spec?.cols ?? 20), MIN_DIMENSION, MAX_DIMENSION);
  const cellSize = clamp(Number(spec?.cellSize ?? 0.5), 0.05, 20);
  const total = rows * cols;

  const blocked = new Uint8Array(total);
  const rawBlocked = spec?.blocked || [];
  for (let i = 0; i < Math.min(total, rawBlocked.length); i += 1) {
    blocked[i] = rawBlocked[i] ? 1 : 0;
  }

  const weights = new Float32Array(total).fill(1);
  const rawWeights = spec?.weights || [];
  for (let i = 0; i < Math.min(total, rawWeights.length); i += 1) {
    const w = Number(rawWeights[i]);
    if (Number.isFinite(w) && w > 0) weights[i] = w;
  }

  const start = normaliseCell(spec?.start, rows, cols, { row: 0, col: 0 });
  const goal = normaliseCell(spec?.goal, rows, cols, { row: rows - 1, col: cols - 1 });

  let blockedCount = 0;
  for (let i = 0; i < total; i += 1) blockedCount += blocked[i];

  return {
    rows,
    cols,
    cellSize,
    totalCells: total,
    blocked,
    weights,
    start,
    goal,
    blockedCount,
    freeCells: total - blockedCount,

    index: (row, col) => row * cols + col,
    inBounds: (row, col) => row >= 0 && row < rows && col >= 0 && col < cols,
    isBlocked: (row, col) =>
      row < 0 || row >= rows || col < 0 || col >= cols || blocked[row * cols + col] === 1,
    weightAt: (row, col) => weights[row * cols + col],
    /** World-space centre of a cell (origin at the grid's corner). */
    cellCentre(row, col) {
      return {
        x: (col + 0.5) * cellSize,
        z: (row + 0.5) * cellSize,
      };
    },

    /** Inverse of cellCentre: world coordinates to cell coordinates. */
    worldToCell(x, z) {
      const col = clamp(Math.floor(x / cellSize), 0, cols - 1);
      const row = clamp(Math.floor(z / cellSize), 0, rows - 1);
      return { row, col };
    },

    /** World-space dimensions of the whole arena. */
    get width() {
      return cols * cellSize;
    },
    get depth() {
      return rows * cellSize;
    },
  };
}

function normaliseCell(cell, rows, cols, fallback) {
  if (!cell || !Number.isFinite(cell.row) || !Number.isFinite(cell.col)) {
    return { ...fallback };
  }
  return {
    row: clamp(Math.round(cell.row), 0, rows - 1),
    col: clamp(Math.round(cell.col), 0, cols - 1),
  };
}

/**
 * Validate start and goal placement. Returns every problem found rather
 * than only the first, so the UI can highlight all offending cells at once.
 */
export function validateEndpoints(grid) {
  const errors = [];

  if (grid.isBlocked(grid.start.row, grid.start.col)) {
    errors.push({
      target: 'start',
      code: 'START_BLOCKED',
      message: `Start cell (row ${grid.start.row}, column ${grid.start.col}) is occupied by an obstacle.`,
    });
  }
  if (grid.isBlocked(grid.goal.row, grid.goal.col)) {
    errors.push({
      target: 'goal',
      code: 'GOAL_BLOCKED',
      message: `Goal cell (row ${grid.goal.row}, column ${grid.goal.col}) is occupied by an obstacle.`,
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Serialise a grid back into a plain, JSON-safe specification.
 */
export function gridToSpec(grid, extra = {}) {
  return {
    rows: grid.rows,
    cols: grid.cols,
    cellSize: grid.cellSize,
    blocked: Array.from(grid.blocked),
    weights: Array.from(grid.weights),
    start: { ...grid.start },
    goal: { ...grid.goal },
    ...extra,
  };
}
