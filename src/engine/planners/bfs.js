/**
 * Breadth-First Search (BFS) Motion Planner.
 * Explores graph layer-by-layer using a FIFO queue.
 * Guarantees minimum edge-count (hop) path on unweighted graphs,
 * while also tracking actual geometric distance and terrain traversal cost.
 */

export function runBFS(grid, startPoint, goalPoint, options = {}) {
  const t0 = performance.now();
  const allowDiagonal = options.allowDiagonal ?? false;

  const startCellInfo = grid.worldToGrid(startPoint);
  const goalCellInfo = grid.worldToGrid(goalPoint);
  const startCell = startCellInfo.cell;
  const goalCell = goalCellInfo.cell;

  if (startCell.isBlocked || goalCell.isBlocked) {
    return {
      algorithm: 'BFS',
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

  const queue = [startCell];
  let head = 0;
  let peakQueueSize = 1;

  const visited = new Set([startCell.key]);
  const parentMap = new Map();
  const depthMap = new Map([[startCell.key, 0]]);
  const gCostMap = new Map([[startCell.key, 0]]);
  const exploredNodes = [];

  let foundGoal = false;

  while (head < queue.length) {
    const activeQueueLen = queue.length - head;
    if (activeQueueLen > peakQueueSize) {
      peakQueueSize = activeQueueLen;
    }

    const current = queue[head++];
    const currentDepth = depthMap.get(current.key) ?? 0;
    const currentG = gCostMap.get(current.key) ?? 0;

    exploredNodes.push({
      key: current.key,
      row: current.row,
      col: current.col,
      x: current.x,
      z: current.z,
      depth: currentDepth,
      g: Number(currentG.toFixed(3)),
      h: 0,
      f: currentDepth,
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
      if (!visited.has(nextCell.key)) {
        visited.add(nextCell.key);
        parentMap.set(nextCell.key, current);
        depthMap.set(nextCell.key, currentDepth + 1);
        gCostMap.set(nextCell.key, currentG + edgeCost);
        queue.push(nextCell);
      }
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (!foundGoal) {
    return {
      algorithm: 'BFS',
      success: false,
      reason: 'UNREACHABLE_GOAL',
      path: [],
      exploredNodes,
      nodesExpanded: exploredNodes.length,
      peakQueueSize,
      planningTimeMs,
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  // Reconstruct path from goalCell back to startCell
  const gridCellsPath = [];
  let curr = goalCell;
  while (curr) {
    gridCellsPath.push(curr);
    curr = parentMap.get(curr.key) || null;
  }
  gridCellsPath.reverse();

  const path = gridCellsPath.map((cell, idx) => {
    if (idx === 0) {
      return {
        x: Number(startPoint.x.toFixed(3)),
        y: 0,
        z: Number(startPoint.z.toFixed(3)),
        row: cell.row,
        col: cell.col,
        g: 0,
        h: 0,
        f: 0,
        depth: 0,
      };
    }
    if (idx === gridCellsPath.length - 1) {
      const gVal = gCostMap.get(cell.key) ?? 0;
      const dVal = depthMap.get(cell.key) ?? idx;
      return {
        x: Number(goalPoint.x.toFixed(3)),
        y: 0,
        z: Number(goalPoint.z.toFixed(3)),
        row: cell.row,
        col: cell.col,
        g: Number(gVal.toFixed(3)),
        h: 0,
        f: dVal,
        depth: dVal,
      };
    }
    const gVal = gCostMap.get(cell.key) ?? 0;
    const dVal = depthMap.get(cell.key) ?? idx;
    return {
      x: cell.x,
      y: 0,
      z: cell.z,
      row: cell.row,
      col: cell.col,
      g: Number(gVal.toFixed(3)),
      h: 0,
      f: dVal,
      depth: dVal,
    };
  });

  const finalCost = gCostMap.get(goalCell.key) ?? 0;

  return {
    algorithm: 'BFS',
    success: true,
    reason: null,
    path,
    exploredNodes,
    nodesExpanded: exploredNodes.length,
    peakQueueSize,
    planningTimeMs,
    accumulatedCost: Number(finalCost.toFixed(3)),
    hopCount: Math.max(0, path.length - 1),
  };
}
