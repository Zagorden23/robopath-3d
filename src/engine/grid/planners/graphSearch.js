/**
 * Graph-search planners: BFS, Dijkstra, A* and Greedy Best-First Search.
 *
 * All four operate on the same occupancy grid and share one search core, but
 * each configures the core differently so that their behaviour genuinely
 * differs:
 *
 *  - BFS      : FIFO frontier, every edge costs 1, no heuristic.
 *  - Dijkstra : priority queue keyed on accumulated cost g(n), no heuristic.
 *  - A*       : priority queue keyed on f(n) = g(n) + h(n).
 *  - Greedy   : priority queue keyed on h(n) only (g is still accumulated and
 *                reported, but never used for ordering).
 *
 * Because BFS and Dijkstra never order by a heuristic, the UI must not offer
 * a heuristic for them — that is enforced by the planner registry metadata.
 */

import { PriorityQueue } from '../../PriorityQueue.js';
import { heuristicCost, resolveHeuristic } from '../heuristics.js';
import { neighbors, cellPathCost, cellPathLengthMetres } from '../movement.js';
import { RESULT_STATUS, makeResult, exhaustedStatus } from '../result.js';

/**
 * @typedef {object} GraphSearchOptions
 * @property {number} connectivity       4 or 8
 * @property {boolean} costAware         false for BFS (unit edges), true otherwise
 * @property {string|null} heuristic     null disables heuristic ordering
 * @property {number} heuristicWeight    >= 1, 1 keeps A* admissible
 * @property {number} maxIterations      safety limit on expansions
 * @property {() => boolean} [isCancelled]
 */

/**
 * Core graph search shared by the four graph planners.
 */
export function graphSearch(grid, options) {
  const {
    connectivity = 8,
    costAware = true,
    heuristic = null,
    heuristicWeight = 1,
    maxIterations = 2_000_000,
    isCancelled = () => false,
  } = options;

  const startedAt = now();
  const useHeuristic = heuristic !== null && heuristic !== undefined;
  const weight = Math.max(1, heuristicWeight);

  const startIndex = grid.index(grid.start.row, grid.start.col);
  const goalIndex = grid.index(grid.goal.row, grid.goal.col);

  const gScore = new Float64Array(grid.totalCells).fill(Infinity);
  const parent = new Int32Array(grid.totalCells).fill(-1);
  const closed = new Uint8Array(grid.totalCells);

  const frontier = new PriorityQueue();
  const visited = [];

  gScore[startIndex] = 0;
  const h0 = useHeuristic ? hOf(heuristic, grid, grid.start, grid.goal, connectivity) : 0;
  frontier.enqueue({ index: startIndex, h: h0 }, useHeuristic ? h0 * weight : 0, h0);

  let goalReached = false;
  let iterations = 0;
  let peakFrontier = 0;
  let cancelled = false;

  while (!frontier.isEmpty()) {
    if (iterations >= maxIterations) {
      return finish({
        grid,
        planner: options.planner,
        kind: 'exhaustive',
        status: RESULT_STATUS.SEARCH_LIMIT_REACHED,
        reason: `Search stopped after the configured limit of ${maxIterations.toLocaleString()} node expansions.`,
        visited,
        peakFrontier,
        startedAt,
        iterations,
      });
    }
    if (isCancelled()) {
      cancelled = true;
      break;
    }

    iterations += 1;
    peakFrontier = Math.max(peakFrontier, frontier.size);

    const current = frontier.dequeue();
    const index = current.index;
    if (closed[index]) continue;
    closed[index] = 1;

    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    const g = gScore[index];
    const h = useHeuristic ? hOf(heuristic, grid, { row, col }, grid.goal, connectivity) : 0;

    visited.push({
      row,
      col,
      g,
      h,
      f: g + h * weight,
      order: visited.length,
      x: (col + 0.5) * grid.cellSize,
      z: (row + 0.5) * grid.cellSize,
    });

    if (index === goalIndex) {
      goalReached = true;
      break;
    }

    const cell = { row, col };
    for (const { cell: next, cost } of neighbors(grid, cell, connectivity, costAware)) {
      if (closed[next.index]) continue;
      const tentative = g + cost;
      if (tentative < gScore[next.index] - 1e-12) {
        gScore[next.index] = tentative;
        parent[next.index] = index;
        const nextH = useHeuristic
          ? hOf(heuristic, grid, next, grid.goal, connectivity)
          : 0;
        const priority = useHeuristic
          ? tentative + nextH * weight
          : tentative;
        frontier.enqueue({ index: next.index, h: nextH }, priority, nextH);
      }
    }
  }

  if (cancelled) {
    return finish({
      grid,
      planner: options.planner,
      kind: 'exhaustive',
      status: RESULT_STATUS.CANCELLED,
      reason: 'Search cancelled by the operator before a complete result was reached.',
      visited,
      peakFrontier,
      startedAt,
      iterations,
    });
  }

  if (!goalReached) {
    return finish({
      grid,
      planner: options.planner,
      kind: 'exhaustive',
      status: exhaustedStatus('exhaustive'),
      reason:
        'The search exhausted every reachable free cell without reaching the goal, so no valid route exists in this configuration.',
      visited,
      peakFrontier,
      startedAt,
      iterations,
    });
  }

  const cells = reconstructPath(parent, startIndex, goalIndex, grid);
  if (!cells) {
    return finish({
      grid,
      planner: options.planner,
      kind: 'exhaustive',
      status: RESULT_STATUS.ERROR,
      reason: 'Path reconstruction failed despite the goal having been reached.',
      visited,
      peakFrontier,
      startedAt,
      iterations,
    });
  }

  return finish({
    grid,
    planner: options.planner,
    kind: 'exhaustive',
    status: RESULT_STATUS.PATH_FOUND,
    reason: null,
    path: cells,
    visited,
    peakFrontier,
    startedAt,
    iterations,
  });
}
function hOf(heuristic, grid, from, to, connectivity) {
  return heuristicCost(
    heuristic,
    to.col - from.col,
    to.row - from.row,
    connectivity === 8
  );
}

function reconstructPath(parent, startIndex, goalIndex, grid) {
  const chain = [];
  let current = goalIndex;
  let guard = 0;

  while (current !== -1 && guard < 1e7) {
    chain.push(current);
    if (current === startIndex) break;
    current = parent[current];
    guard += 1;
  }

  if (chain[chain.length - 1] !== startIndex) return null;
  chain.reverse();

  return chain.map((index) => {
    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    return {
      row,
      col,
      index,
      x: (col + 0.5) * grid.cellSize,
      z: (row + 0.5) * grid.cellSize,
    };
  });
}

function finish({
  grid,
  planner,
  kind,
  status,
  reason,
  path = [],
  visited = [],
  peakFrontier = 0,
  startedAt,
  iterations,
}) {
  const weightedCost = path.length ? cellPathCost(grid, path, true) : 0;
  return makeResult({
    planner,
    status,
    reason,
    path,
    pathLength: path.length ? cellPathLengthMetres(grid, path) : 0,
    pathCost: weightedCost,
    // For the cost-based planners the objective equals the reported path
    // cost. BFS overrides this separately with its edge count.
    objectiveValue: path.length ? weightedCost : null,
    nodesExpanded: visited.length,
    nodesGenerated: visited.length,
    peakFrontier,
    planningTimeMs: Number((now() - startedAt).toFixed(3)),
    visited,
    metadata: { iterations, kind },
  });
}

/**
 * Breadth-First Search: explores level by level using a FIFO queue and
 * finds the route with the fewest edges. Every edge costs 1, so weighted
 * terrain does not influence the choice of route.
 */
export function runBFS(grid, options = {}) {
  const queue = [];
  let head = 0;
  const parent = new Int32Array(grid.totalCells).fill(-1);
  const seen = new Uint8Array(grid.totalCells);
  const visited = [];

  const startIndex = grid.index(grid.start.row, grid.start.col);
  const goalIndex = grid.index(grid.goal.row, grid.goal.col);
  const connectivity = options.connectivity ?? 8;
  const maxIterations = options.maxIterations ?? 2_000_000;
  const isCancelled = options.isCancelled ?? (() => false);
  const startedAt = now();

  seen[startIndex] = 1;
  queue.push(startIndex);

  let peakFrontier = 0;
  let iterations = 0;
  let goalReached = false;

  while (head < queue.length) {
    if (iterations >= maxIterations) {
      return makeResult({
        planner: 'BFS',
        status: RESULT_STATUS.SEARCH_LIMIT_REACHED,
        reason: `Search stopped after the configured limit of ${maxIterations.toLocaleString()} node expansions.`,
        visited,
        peakFrontier,
        planningTimeMs: Number((now() - startedAt).toFixed(3)),
        metadata: { iterations, kind: 'exhaustive' },
      });
    }
    if (isCancelled()) {
      return makeResult({
        planner: 'BFS',
        status: RESULT_STATUS.CANCELLED,
        reason: 'Search cancelled by the operator before a complete result was reached.',
        visited,
        peakFrontier,
        planningTimeMs: Number((now() - startedAt).toFixed(3)),
        metadata: { iterations, kind: 'exhaustive' },
      });
    }

    iterations += 1;
    peakFrontier = Math.max(peakFrontier, queue.length - head);

    const index = queue[head];
    head += 1;

    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    visited.push({
      row,
      col,
      g: visited.length,
      h: 0,
      f: visited.length,
      order: visited.length,
      x: (col + 0.5) * grid.cellSize,
      z: (row + 0.5) * grid.cellSize,
    });

    if (index === goalIndex) {
      goalReached = true;
      break;
    }

    for (const { cell: next } of neighbors(grid, { row, col }, connectivity, false)) {
      if (seen[next.index]) continue;
      seen[next.index] = 1;
      parent[next.index] = index;
      queue.push(next.index);
    }
  }

  if (!goalReached) {
    return makeResult({
      planner: 'BFS',
      status: RESULT_STATUS.NO_PATH,
      reason:
        'BFS exhausted every reachable free cell without reaching the goal, so no valid route exists in this configuration.',
      visited,
      peakFrontier,
      planningTimeMs: Number((now() - startedAt).toFixed(3)),
      metadata: { iterations, kind: 'exhaustive' },
    });
  }

  const cells = reconstructPath(parent, startIndex, goalIndex, grid);
  if (!cells) {
    return makeResult({
      planner: 'BFS',
      status: RESULT_STATUS.ERROR,
      reason: 'Path reconstruction failed despite the goal having been reached.',
      visited,
      peakFrontier,
      planningTimeMs: Number((now() - startedAt).toFixed(3)),
      metadata: { iterations, kind: 'exhaustive' },
    });
  }

  return makeResult({
    planner: 'BFS',
    status: RESULT_STATUS.PATH_FOUND,
    reason: null,
    path: cells,
    pathLength: cellPathLengthMetres(grid, cells),
    // BFS minimises the number of edges, so its objective value is the
    // unweighted edge count. `pathCost` still reports the weighted cost of
    // the returned route so route quality stays comparable across planners.
    pathCost: cellPathCost(grid, cells, true),
    objectiveValue: cells.length - 1,
    nodesExpanded: visited.length,
    nodesGenerated: visited.length,
    peakFrontier,
    planningTimeMs: Number((now() - startedAt).toFixed(3)),
    visited,
    metadata: { iterations, kind: 'exhaustive', objective: 'edge-count' },
  });
}

/**
 * Dijkstra's algorithm: uniform-cost search over the weighted grid.
 * Guarantees the minimum traversal cost, not the minimum edge count.
 */
export function runDijkstra(grid, options = {}) {
  return graphSearch(grid, {
    ...options,
    planner: 'DIJKSTRA',
    costAware: true,
    heuristic: null,
  });
}

/**
 * A* Search: Dijkstra guided by an admissible heuristic.
 * With heuristicWeight 1 and a consistent heuristic this returns a
 * minimum-cost route.
 */
export function runAStar(grid, options = {}) {
  const connectivity = options.connectivity ?? 8;
  const heuristic = resolveHeuristic(options.heuristic ?? 'auto', connectivity === 8);
  return graphSearch(grid, {
    ...options,
    planner: 'ASTAR',
    costAware: true,
    heuristic,
  });
}

/**
 * Greedy Best-First Search: orders the frontier by h(n) alone.
 * It usually expands far fewer nodes than Dijkstra but the resulting route
 * is NOT guaranteed to be optimal.
 */
export function runGreedyBestFirst(grid, options = {}) {
  const connectivity = options.connectivity ?? 8;
  const heuristic = resolveHeuristic(options.heuristic ?? 'auto', connectivity === 8);
  return graphSearch(grid, {
    ...options,
    planner: 'GREEDY',
    costAware: true,
    heuristic,
  });
}

/**
 * Monotonic clock that works in browsers, workers and Node.
 */
function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
