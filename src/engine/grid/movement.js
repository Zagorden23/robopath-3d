/**
 * Movement model shared by every grid-based planner.
 *
 * COST MODEL (single source of truth for the whole application)
 * -----------------------------------------------------------
 *  - 4-connected movement: an orthogonal step costs 1.0 "step unit".
 *  - 8-connected movement: an orthogonal step costs 1.0 and a diagonal step
 *    costs sqrt(2). The step unit is multiplied by `cellSize` to obtain
 *    metres, so a diagonal cell step traverses sqrt(2) * cellSize metres.
 *  - Weighted terrain: the raw step cost is multiplied by the average
 *    terrain weight of the two cells being connected. A cell with weight
 *    2.0 is twice as expensive to traverse as a neutral cell.
 *  - Corner cutting is FORBIDDEN. A diagonal move is only legal when both
 *    of the orthogonal cells it touches are free. This keeps the planner
 *    honest about the robot sweeping through the corner of an obstacle.
 *
 * Route length is reported in metres (sum of step unit * cellSize), while
 * path cost is reported in weighted step units. Both are derived from the
 * same traversal, so they can never disagree.
 */

export const SQRT2 = Math.SQRT2;

export const MOVEMENT_MODES = [
  { id: 'four', label: '4-Direction', connectivity: 4 },
  { id: 'eight', label: '8-Direction', connectivity: 8 },
];

const DIAGONALS = [
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

const ORTHOGONALS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
];

export function resolveConnectivity(movementMode) {
  if (movementMode === 'four' || movementMode === 4 || movementMode === '4') return 4;
  return 8;
}

/**
 * Cost of traversing from cell `a` to adjacent cell `b`.
 * `b` must already be known to be adjacent and free.
 */
export function stepCost(grid, a, b, diagonal) {
  const base = diagonal ? SQRT2 : 1;
  const wa = grid.weights[a.row * grid.cols + a.col];
  const wb = grid.weights[b.row * grid.cols + b.col];
  return base * ((wa + wb) / 2);
}

/**
 * Enumerate the legal successors of a cell.
 *
 * @param {object} grid  occupancy grid produced by buildOccupancyGrid
 * @param {{row:number,col:number}} cell
 * @param {number} connectivity 4 or 8
 * @param {boolean} costAware when false every edge costs 1 (BFS semantics)
 * @returns {Array<{cell:{row:number,col:number,index:number}, cost:number, diagonal:boolean}>}
 */
export function neighbors(grid, cell, connectivity, costAware = true) {
  const out = [];
  const { rows, cols, blocked } = grid;

  const push = (dr, dc, diagonal) => {
    const row = cell.row + dr;
    const col = cell.col + dc;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    const index = row * cols + col;
    if (blocked[index]) return;

    if (diagonal) {
      // No corner cutting: both orthogonal neighbours must be free.
      const sideA = cell.row * cols + col;
      const sideB = row * cols + cell.col;
      if (blocked[sideA] || blocked[sideB]) return;
    }

    const next = { row, col, index };
    out.push({
      cell: next,
      cost: costAware ? stepCost(grid, cell, next, diagonal) : 1,
      diagonal,
    });
  };

  for (const [dr, dc] of ORTHOGONALS) push(dr, dc, false);
  if (connectivity === 8) {
    for (const [dr, dc] of DIAGONALS) push(dr, dc, true);
  }

  return out;
}

/**
 * Total metric length of a cell path, in metres.
 */
export function cellPathLengthMetres(grid, cells) {
  if (!cells || cells.length < 2) return 0;
  let units = 0;
  for (let i = 1; i < cells.length; i += 1) {
    const a = cells[i - 1];
    const b = cells[i];
    const diagonal = a.row !== b.row && a.col !== b.col;
    units += diagonal ? SQRT2 : 1;
  }
  return units * grid.cellSize;
}

/**
 * Total weighted traversal cost of a cell path, in weighted step units.
 *
 * This is the cost of the route the planner actually returned. It is
 * computed identically for every planner, which makes it the fair metric
 * for comparing route quality across algorithms.
 *
 * `weighted = false` yields the raw edge count, which is the objective
 * BFS actually minimises.
 */
export function cellPathCost(grid, cells, weighted = true) {
  if (!cells || cells.length < 2) return 0;
  let cost = 0;
  for (let i = 1; i < cells.length; i += 1) {
    const a = cells[i - 1];
    const b = cells[i];
    const diagonal = a.row !== b.row && a.col !== b.col;
    cost += weighted ? stepCost(grid, a, b, diagonal) : (diagonal ? SQRT2 : 1);
  }
  return cost;
}
