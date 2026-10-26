/**
 * Dijkstra's Shortest Path Motion Planner.
 * Uses a Binary Min-Heap Priority Queue to expand nodes in increasing order of
 * accumulated traversal cost g(n).
 *
 * Relaxation equation:
 * g(v) = min(g(v), g(u) + c(u, v))
 */

import { PriorityQueue } from '../PriorityQueue.js';

export function runDijkstra(grid, startPoint, goalPoint, options = {}) {
  const t0 = performance.now();
  const allowDiagonal = options.allowDiagonal ?? true;

  const startCell = grid.worldToGrid(startPoint).cell;
  const goalCell = grid.worldToGrid(goalPoint).cell;

  if (startCell.isBlocked || goalCell.isBlocked) {
    return {
      algorithm: 'DIJKSTRA',
      success: false,
      reason: startCell.isBlocked ? 'START_BLOCKED' : 'GOAL_BLOCKED',
      path: [],
      exploredNodes: [],
      nodesExpanded: 0,
      peakQueueSize: 0,
      planningTimeMs: Number((performance.now() - t0).toFixed(3)),
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const pq = new PriorityQueue();
  const gScore = new Map([[startCell.key, 0]]);
  const parentMap = new Map();
  const parentEdgeCostMap = new Map([[startCell.key, 0]]);
  const closedSet = new Set();
  const exploredNodes = [];

  pq.enqueue(startCell, 0);

  let foundGoal = false;

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    if (closedSet.has(current.key)) continue;
    closedSet.add(current.key);

    const currentG = gScore.get(current.key) ?? 0;
    const lastEdgeCost = parentEdgeCostMap.get(current.key) ?? 0;

    exploredNodes.push({
      key: current.key,
      row: current.row,
      col: current.col,
      x: current.x,
      z: current.z,
      g: Number(currentG.toFixed(3)),
      h: 0,
      f: Number(currentG.toFixed(3)),
      edgeCost: Number(lastEdgeCost.toFixed(3)),
      terrainCost: current.terrainCost,
      stepOrder: exploredNodes.length,
    });

    if (current.key === goalCell.key) {
      foundGoal = true;
      break;
    }

    const neighbors = grid.getNeighbors(current.row, current.col, allowDiagonal);
    for (let i = 0; i < neighbors.length; i++) {
      const { cell: nextCell, edgeCost } = neighbors[i];
      if (closedSet.has(nextCell.key)) continue;

      const tentativeG = currentG + edgeCost;
      const existingG = gScore.get(nextCell.key);

      if (existingG === undefined || tentativeG < existingG - 1e-9) {
        gScore.set(nextCell.key, tentativeG);
        parentMap.set(nextCell.key, current);
        parentEdgeCostMap.set(nextCell.key, edgeCost);
        pq.enqueue(nextCell, tentativeG);
      }
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (!foundGoal) {
    return {
      algorithm: 'DIJKSTRA',
      success: false,
      reason: 'UNREACHABLE_GOAL',
      path: [],
      exploredNodes,
      nodesExpanded: exploredNodes.length,
      peakQueueSize: pq.maxSizeReached,
      planningTimeMs,
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const gridCellsPath = [];
  let curr = goalCell;
  while (curr) {
    gridCellsPath.push(curr);
    curr = parentMap.get(curr.key) || null;
  }
  gridCellsPath.reverse();

  const path = gridCellsPath.map((cell, idx) => {
    const gVal = gScore.get(cell.key) ?? 0;
    const edgeVal = parentEdgeCostMap.get(cell.key) ?? 0;
    const xCoord =
      idx === 0
        ? Number(startPoint.x.toFixed(3))
        : idx === gridCellsPath.length - 1
          ? Number(goalPoint.x.toFixed(3))
          : cell.x;
    const zCoord =
      idx === 0
        ? Number(startPoint.z.toFixed(3))
        : idx === gridCellsPath.length - 1
          ? Number(goalPoint.z.toFixed(3))
          : cell.z;

    return {
      x: xCoord,
      y: 0,
      z: zCoord,
      row: cell.row,
      col: cell.col,
      g: Number(gVal.toFixed(3)),
      h: 0,
      f: Number(gVal.toFixed(3)),
      edgeCost: Number(edgeVal.toFixed(3)),
      terrainCost: cell.terrainCost,
    };
  });

  const finalCost = gScore.get(goalCell.key) ?? 0;

  return {
    algorithm: 'DIJKSTRA',
    success: true,
    reason: null,
    path,
    exploredNodes,
    nodesExpanded: exploredNodes.length,
    peakQueueSize: pq.maxSizeReached,
    planningTimeMs,
    accumulatedCost: Number(finalCost.toFixed(3)),
    hopCount: Math.max(0, path.length - 1),
  };
}
