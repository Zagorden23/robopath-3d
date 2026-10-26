/**
 * Grid-based search: BFS, Dijkstra and A* on the shared occupancy grid.
 * All three record their exploration order so the timeline, metrics and
 * live explanation panel render real algorithm state (never invented data).
 */
import { PriorityQueue } from './PriorityQueue.js';
import { heuristic as applyHeuristic, neighbors } from './grid.js';

function makeGridResult(grid, startCell, goalCell, extra = {}) {
  return {
    found: false,
    reason: '',
    path: [],
    pathLength: 0,
    pathCost: 0,
    visited: [],
    startCell, goalCell,
    nodesExpanded: 0,
    peakFrontier: extra.peakFrontier ?? 0,
    durationMs: 0,
  };
}

function reconstructPath(parent, startIndex, goalIndex) {
  const chain = [];
  let cur = goalIndex;
  let guard = 0;
  while (cur !== -1 && guard++ < 1e6) {
    chain.push(cur);
    if (cur === startIndex) break;
    cur = parent[cur];
  }
  if (chain[chain.length - 1] !== startIndex) return null;
  chain.reverse();
  return chain;
}

/**
 * Core Dijkstra / A* search. When `useHeuristic` is false the function is
 * exactly Dijkstra. `heuristicName` picks manhattan / octile / euclidean.
 */
function graphSearch(grid, startCell, goalCell, { useHeuristic = false, heuristicName = 'manhattan', connectivity = 4, costAware = true } = {}) {
  const t0 = performance.now();
  const cols = grid.cols;
  const startIdx = startCell.iy * cols + startCell.ix;
  const goalIdx = goalCell.iy * cols + goalCell.ix;

  const result = makeGridResult(grid, startCell, goalCell);

  if (grid.blocked[startIdx]) {
    result.reason = 'start_blocked';
    result.durationMs = performance.now() - t0;
    return result;
  }
  if (grid.blocked[goalIdx]) {
    result.reason = 'goal_blocked';
    result.durationMs = performance.now() - t0;
    return result;
  }

  const gScore = new Float64Array(cols * grid.rows).fill(Infinity);
  const parent = new Int32Array(cols * grid.rows).fill(-1);
  const closed = new Uint8Array(cols * grid.rows);

  const pq = new PriorityQueue();
  gScore[startIdx] = 0;
  const h0 = useHeuristic ? applyHeuristic(heuristicName, startCell, goalCell) : 0;
  const nodes = [];
  let peakFrontier = 0;
  pq.enqueue({ idx: startIdx, h: h0 }, h0, h0);

  let bestFinalG = Infinity;

  const recordVisit = (idx) => {
    const ix = idx % cols;
    const iy = (idx - ix) / cols;
    const g = gScore[idx];
    const h = useHeuristic ? applyHeuristic(heuristicName, { ix, iy }, goalCell) : 0;
    nodes.push({ i: idx, ix, iy, g, h, f: g + h });
  };

  while (!pq.isEmpty()) {
    peakFrontier = Math.max(peakFrontier, pq.size);
    const current = pq.dequeue();
    const idx = current.idx;
    if (closed[idx]) continue;
    closed[idx] = 1;
    recordVisit(idx);

    if (idx === goalIdx) {
      bestFinalG = gScore[idx];
      break;
    }

    const ix = idx % cols;
    const iy = (idx - ix) / cols;
    const here = { ix, iy };
    const succ = neighbors(grid, here, connectivity, costAware);
    for (const { cell: nb, cost } of succ) {
      if (closed[nb.index]) continue;
      const tentative = gScore[idx] + cost;
      if (tentative < gScore[nb.index] - 1e-12) {
        gScore[nb.index] = tentative;
        parent[nb.index] = idx;
        const h = useHeuristic ? applyHeuristic(heuristicName, nb, goalCell) : 0;
        pq.enqueue({ idx: nb.index, h }, tentative + h, h);
      }
    }
  }

  const done = performance.now() - t0;
  result.nodesExpanded = nodes.length;
  result.peakFrontier = peakFrontier;
  result.visited = nodes;
  result.durationMs = done;

  if (bestFinalG === Infinity) {
    result.reason = 'no_path';
    return result;
  }

  const chain = reconstructPath(parent, startIdx, goalIdx);
  if (!chain) {
    result.reason = 'no_path';
    return result;
  }
  const cells = chain.map((idx) => ({ ix: idx % cols, iy: Math.floor(idx / cols) }));
  result.cells = cells;
  result.found = true;
  result.pathCost = bestFinalG;
  return result;
}

export function dijkstraSearch(grid, startCell, goalCell, options = {}) {
  return graphSearch(grid, startCell, goalCell, { ...options, useHeuristic: false });
}

export function astarSearch(grid, startCell, goalCell, options = {}) {
  const { heuristicName = 'octile', connectivity = 8 } = options;
  return graphSearch(grid, startCell, goalCell, { ...options, useHeuristic: true, heuristicName, connectivity });
}

/**
 * Breadth-First Search: explores by edge count. Appropriate for unweighted
 * graphs; on weighted terrain it still finds the fewest-edge path, which may
 * be costlier than Dijkstra's fewest-cost path.
 */
export function bfsSearch(grid, startCell, goalCell, { connectivity = 4 } = {}) {
  const t0 = performance.now();
  const cols = grid.cols;
  const startIdx = startCell.iy * cols + startCell.ix;
  const goalIdx = goalCell.iy * cols + goalCell.ix;
  const result = makeGridResult(grid, startCell, goalCell);

  if (grid.blocked[startIdx]) { result.reason = 'start_blocked'; result.durationMs = performance.now() - t0; return result; }
  if (grid.blocked[goalIdx]) { result.reason = 'goal_blocked'; result.durationMs = performance.now() - t0; return result; }

  const parent = new Int32Array(cols * grid.rows).fill(-1);
  const depth = new Int32Array(cols * grid.rows).fill(-1);
  const seen = new Uint8Array(cols * grid.rows);
  seen[startIdx] = 1;
  depth[startIdx] = 0;
  const queue = [startIdx];
  const nodes = [];
  let head = 0;
  let peakFrontier = 1;

  const record = (idx) => {
    nodes.push({ i: idx, ix: idx % cols, iy: Math.floor(idx / cols), g: depth[idx], h: 0, f: depth[idx] });
  };
  record(startIdx);

  let found = false;
  while (head < queue.length) {
    peakFrontier = Math.max(peakFrontier, queue.length - head);
    const idx = queue[head]; head += 1;
    record(idx);
    if (idx === goalIdx) { found = true; break; }
    const ix = idx % cols;
    const iy = (idx - ix) / cols;
    const here = { ix, iy, index: idx };
    const succ = neighbors(grid, here, connectivity, false);
    for (const { cell: nb } of succ) {
      if (seen[nb.index]) continue;
      seen[nb.index] = 1;
      depth[nb.index] = depth[idx] + 1;
      parent[nb.index] = idx;
      queue.push(nb.index);
    }
  }

  const done = performance.now() - t0;
  result.nodesExpanded = nodes.length;
  result.peakFrontier = peakFrontier;
  result.durationMs = done;
  result.visited = nodes;

  if (!found) { result.reason = 'no_path'; return result; }

  const chain = reconstructPath(parent, startIdx, goalIdx);
  if (!chain) { result.reason = 'no_path'; return result; }
  const cells = chain.map((idx) => ({ ix: idx % cols, iy: Math.floor(idx / cols) }));
  result.cells = cells;
  result.found = true;
  result.pathCost = cells.reduce((acc, c, i) => {
    if (i === 0) return 0;
    const prev = cells[i - 1];
    const diag = prev.ix !== c.ix && prev.iy !== c.iy;
    const wa = grid.weight[prev.iy * cols + prev.ix];
    const wb = grid.weight[c.iy * cols + c.ix];
    return acc + (diag ? Math.SQRT2 : 1) * ((wa + wb) / 2);
  }, 0);
  return result;
}
