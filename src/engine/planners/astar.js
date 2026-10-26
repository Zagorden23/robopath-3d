/**
 * A* (A-Star) Heuristic-Guided Motion Planner.
 * Evaluates nodes using f(n) = g(n) + w * h(n), where:
 *  - g(n): exact accumulated traversal cost from start to n
 *  - h(n): admissible heuristic estimate from n to goal
 *  - f(n): estimated total path cost through node n
 */

import { PriorityQueue } from '../PriorityQueue.js';

export function computeHeuristic(cellA, cellB, heuristicType = 'euclidean', weight = 1.0) {
  const dx = Math.abs(cellB.x - cellA.x);
  const dz = Math.abs(cellB.z - cellA.z);
  const type = String(heuristicType || 'euclidean').toLowerCase();

  let rawH = 0;
  if (type === 'manhattan') {
    rawH = dx + dz;
  } else if (type === 'octile' || type === 'diagonal') {
    const F = Math.SQRT2 - 1;
    rawH = dx < dz ? F * dx + dz : F * dz + dx;
  } else {
    // Default Euclidean distance
    rawH = Math.sqrt(dx * dx + dz * dz);
  }

  return rawH * Number(weight || 1.0);
}

export function runAStar(grid, startPoint, goalPoint, options = {}) {
  const t0 = performance.now();
  const allowDiagonal = options.allowDiagonal ?? true;
  const heuristicType = options.heuristic ?? (allowDiagonal ? 'octile' : 'manhattan');
  const heuristicWeight = Number(options.heuristicWeight ?? 1.0);

  const startCell = grid.worldToGrid(startPoint).cell;
  const goalCell = grid.worldToGrid(goalPoint).cell;

  if (startCell.isBlocked || goalCell.isBlocked) {
    return {
      algorithm: 'ASTAR',
      heuristicType,
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
  const startH = computeHeuristic(startCell, goalCell, heuristicType, heuristicWeight);

  const gScore = new Map([[startCell.key, 0]]);
  const hScore = new Map([[startCell.key, startH]]);
  const fScore = new Map([[startCell.key, startH]]);
  const parentMap = new Map();
  const parentEdgeCostMap = new Map([[startCell.key, 0]]);
  const closedSet = new Set();
  const exploredNodes = [];

  // Tie-break by lower h(n) when f(n) values are equal
  pq.enqueue(startCell, startH, startH);

  let foundGoal = false;

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    if (closedSet.has(current.key)) continue;
    closedSet.add(current.key);

    const currentG = gScore.get(current.key) ?? 0;
    const currentH = hScore.get(current.key) ?? 0;
    const currentF = fScore.get(current.key) ?? currentG + currentH;
    const lastEdgeCost = parentEdgeCostMap.get(current.key) ?? 0;

    exploredNodes.push({
      key: current.key,
      row: current.row,
      col: current.col,
      x: current.x,
      z: current.z,
      g: Number(currentG.toFixed(3)),
      h: Number(currentH.toFixed(3)),
      f: Number(currentF.toFixed(3)),
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
        const nextH = computeHeuristic(nextCell, goalCell, heuristicType, heuristicWeight);
        const nextF = tentativeG + nextH;

        gScore.set(nextCell.key, tentativeG);
        hScore.set(nextCell.key, nextH);
        fScore.set(nextCell.key, nextF);
        parentMap.set(nextCell.key, current);
        parentEdgeCostMap.set(nextCell.key, edgeCost);

        pq.enqueue(nextCell, nextF, nextH);
      }
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (!foundGoal) {
    return {
      algorithm: 'ASTAR',
      heuristicType,
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
    const hVal = hScore.get(cell.key) ?? 0;
    const fVal = fScore.get(cell.key) ?? gVal + hVal;
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
      h: Number(hVal.toFixed(3)),
      f: Number(fVal.toFixed(3)),
      edgeCost: Number(edgeVal.toFixed(3)),
      terrainCost: cell.terrainCost,
    };
  });

  const finalCost = gScore.get(goalCell.key) ?? 0;

  return {
    algorithm: 'ASTAR',
    heuristicType,
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

/**
 * Greedy Best-First Search Motion Planner.
 * Orders the priority queue strictly by heuristic estimate f(n) = h(n),
 * ignoring accumulated path cost g(n). Fast, but does not guarantee an optimal route.
 */
export function runGreedyBestFirst(grid, startPoint, goalPoint, options = {}) {
  const t0 = performance.now();
  const allowDiagonal = options.allowDiagonal ?? true;
  const heuristicType = options.heuristic ?? (allowDiagonal ? 'octile' : 'manhattan');

  const startCell = grid.worldToGrid(startPoint).cell;
  const goalCell = grid.worldToGrid(goalPoint).cell;

  if (startCell.isBlocked || goalCell.isBlocked) {
    return {
      algorithm: 'GREEDY',
      heuristicType,
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
  const startH = computeHeuristic(startCell, goalCell, heuristicType, 1.0);

  const visited = new Set([startCell.key]);
  const gScore = new Map([[startCell.key, 0]]);
  const hScore = new Map([[startCell.key, startH]]);
  const parentMap = new Map();
  const parentEdgeCostMap = new Map([[startCell.key, 0]]);
  const exploredNodes = [];

  pq.enqueue(startCell, startH);

  let foundGoal = false;

  while (!pq.isEmpty()) {
    const current = pq.dequeue();
    const currentG = gScore.get(current.key) ?? 0;
    const currentH = hScore.get(current.key) ?? 0;
    const lastEdgeCost = parentEdgeCostMap.get(current.key) ?? 0;

    exploredNodes.push({
      key: current.key,
      row: current.row,
      col: current.col,
      x: current.x,
      z: current.z,
      g: Number(currentG.toFixed(3)),
      h: Number(currentH.toFixed(3)),
      f: Number(currentH.toFixed(3)),
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
      if (visited.has(nextCell.key)) continue;
      visited.add(nextCell.key);

      const nextG = currentG + edgeCost;
      const nextH = computeHeuristic(nextCell, goalCell, heuristicType, 1.0);

      gScore.set(nextCell.key, nextG);
      hScore.set(nextCell.key, nextH);
      parentMap.set(nextCell.key, current);
      parentEdgeCostMap.set(nextCell.key, edgeCost);

      pq.enqueue(nextCell, nextH);
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (!foundGoal) {
    return {
      algorithm: 'GREEDY',
      heuristicType,
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
    const hVal = hScore.get(cell.key) ?? 0;
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
      h: Number(hVal.toFixed(3)),
      f: Number(hVal.toFixed(3)),
      edgeCost: Number(edgeVal.toFixed(3)),
      terrainCost: cell.terrainCost,
    };
  });

  const finalCost = gScore.get(goalCell.key) ?? 0;

  return {
    algorithm: 'GREEDY',
    heuristicType,
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
