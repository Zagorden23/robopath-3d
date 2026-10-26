/**
 * Spatial grid representation: rasterizes obstacle geometry into an occupancy
 * map inflated by the robot footprint, plus per-cell traversal weights.
 * BFS / Dijkstra / A* operate exclusively on this grid.
 */
import { createCollisionWorld } from './collision.js';

export const SQRT2 = Math.SQRT2;
export const OFFSETS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const OFFSETS_8 = [...OFFSETS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const HEURISTICS = {
  manhattan: (dx, dy) => Math.abs(dx) + Math.abs(dy),
  octile: (dx, dy) => {
    const absx = Math.abs(dx);
    const absy = Math.abs(dy);
    return Math.max(absx, absy) + (SQRT2 - 1) * Math.min(absx, absy);
  },
  euclidean: (dx, dy) => Math.hypot(dx, dy),
};

/**
 * Rasterize the environment into a blocked/weight grid.
 * A cell is blocked when the collision clearance measured at its center is
 * smaller than the robot radius + inflation margin. Higher resolution grids
 * approximate the obstacle shape more closely but cost more to search.
 */
export function buildOccupancyGrid(env, { robotRadius = 0.3, safetyMargin = 0.08 } = {}) {
  const { cols, rows, cellSize } = env;
  const world = createCollisionWorld(env, { robotRadius, safetyMargin });
  const blocked = new Uint8Array(cols * rows);
  const weight = new Float32Array(cols * rows).fill(1);

  for (let iy = 0; iy < rows; iy += 1) {
    for (let ix = 0; ix < cols; ix += 1) {
      const x = (ix + 0.5) * cellSize;
      const y = (iy + 0.5) * cellSize;
      const index = iy * cols + ix;
      if (x > env.width || y > env.height || x < 0 || y < 0) {
        blocked[index] = 1;
        continue;
      }
      const clearance = world.clearanceAt(x, y);
      if (clearance < robotRadius + safetyMargin) blocked[index] = 1;
      let w = 1;
      for (const zone of env.weightZones) {
        const within = x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.depth;
        if (within) w = Math.max(w, zone.multiplier);
      }
      weight[index] = w;
    }
  }

  const inBounds = (ix, iy) => ix >= 0 && iy >= 0 && ix < cols && iy < rows;

  return {
    cols, rows, cellSize, blocked, weight,
    env,
    index: (ix, iy) => iy * cols + ix,
    inBounds,
    isBlocked: (ix, iy) => !inBounds(ix, iy) || blocked[iy * cols + ix] === 1,
  };
}

/** Movement legality incl. no-corner-cutting rule for diagonals. */
export function canStep(grid, ix, iy, nx, ny) {
  if (!grid.inBounds(nx, ny)) return false;
  if (grid.blocked[ny * grid.cols + nx]) return false;
  const dx = nx - ix;
  const dy = ny - iy;
  if (dx !== 0 && dy !== 0) {
    if (grid.blocked[iy * grid.cols + nx] || grid.blocked[ny * grid.cols + ix]) return false;
  }
  return true;
}

/** Edge traversing cost: geometric step length scaled by average terrain weight. */
export function stepCost(grid, a, b) {
  const base = a.ix !== b.ix && a.iy !== b.iy ? SQRT2 : 1;
  const wa = grid.weight[a.iy * grid.cols + a.ix];
  const wb = grid.weight[b.iy * grid.cols + b.ix];
  return base * ((wa + wb) / 2);
}

/** Admissible heuristic between two cells for the chosen movement model. */
export function heuristic(heuristicName, a, b) {
  const h = HEURISTICS[heuristicName] || HEURISTICS.manhattan;
  return h(b.ix - a.ix, b.iy - a.iy);
}

/** Cells adjacent to a start cell, as {ix, iy, cell cost, step cost}. */
export function neighbors(grid, cell, connectivity, costAware = true) {
  const offsets = connectivity === 8 ? OFFSETS_8 : OFFSETS_4;
  const out = [];
  for (const [dx, dy] of offsets) {
    const nx = cell.ix + dx;
    const ny = cell.iy + dy;
    if (!canStep(grid, cell.ix, cell.iy, nx, ny)) continue;
    const next = { ix: nx, iy: ny, index: ny * grid.cols + nx };
    out.push({ cell: next, cost: costAware ? stepCost(grid, cell, next) : 1 });
  }
  return out;
}
