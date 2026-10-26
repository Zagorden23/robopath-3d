/**
 * Unified Motion Planner Dispatcher.
 * Coordinates spatial grid generation, start/goal validation,
 * algorithm execution (BFS, Dijkstra, A*, Greedy Best-First, RRT, RRT*),
 * and continuous C-space path validation.
 */

import { buildSpatialGrid, validateStartAndGoal } from '../environment.js';
import { validatePath, euclideanDistance2D } from '../collision.js';
import { runBFS } from './bfs.js';
import { runDijkstra } from './dijkstra.js';
import { runAStar, runGreedyBestFirst } from './astar.js';
import { runRRT, runRRTStar } from './rrt.js';

export function executeMotionPlan({
  environment,
  robotConfig = {},
  algorithmConfig = {},
}) {
  const algoName = String(algorithmConfig.algorithm || 'ASTAR').toUpperCase();
  const start = environment.start || { x: -7.5, z: -7.5, theta: 0 };
  const goal = environment.goal || { x: 7.5, z: 7.5, theta: 0 };

  const grid = buildSpatialGrid(environment, robotConfig);
  const endpointValidation = validateStartAndGoal(start, goal, environment, robotConfig);

  if (!endpointValidation.valid) {
    const firstError = endpointValidation.errors[0];
    return {
      algorithm: algoName,
      success: false,
      resultStatus: 'ERROR',
      reason: firstError.target === 'start' ? 'START_BLOCKED' : 'GOAL_BLOCKED',
      errorMessage: firstError.message,
      endpointValidation,
      gridSummary: {
        rows: grid.rows,
        cols: grid.cols,
        resolution: grid.resolution,
        totalCells: grid.totalCells,
        freeCellsCount: grid.freeCellsCount,
        rawBlockedCount: grid.rawBlockedCount,
        inflatedBlockedCount: grid.inflatedBlockedCount,
        effectiveRadius: grid.effectiveRadius,
      },
      path: [],
      exploredNodes: [],
      treeEdges: [],
      nodesExpanded: 0,
      peakQueueSize: 0,
      planningTimeMs: 0,
      pathValidation: {
        isValid: false,
        reason: firstError.reason,
        pathLength: 0,
        traversalCost: 0,
        minClearance: 0,
        collisions: [],
      },
      straightLineDistance: Number(euclideanDistance2D(start, goal).toFixed(3)),
    };
  }

  let planResult;
  if (algoName === 'BFS') {
    planResult = runBFS(grid, start, goal, {
      allowDiagonal: algorithmConfig.allowDiagonal ?? false,
    });
  } else if (algoName === 'DIJKSTRA') {
    planResult = runDijkstra(grid, start, goal, {
      allowDiagonal: algorithmConfig.allowDiagonal ?? true,
    });
  } else if (algoName === 'GREEDY' || algoName === 'GREEDY_BFS') {
    planResult = runGreedyBestFirst(grid, start, goal, {
      allowDiagonal: algorithmConfig.allowDiagonal ?? true,
      heuristic: algorithmConfig.heuristic ?? 'octile',
    });
  } else if (algoName === 'RRT') {
    planResult = runRRT(environment, start, goal, robotConfig, {
      stepSize: algorithmConfig.rrtStepSize ?? 1.15,
      maxIterations: algorithmConfig.rrtMaxIterations ?? 900,
      goalBias: algorithmConfig.rrtGoalBias ?? 0.16,
      seed: algorithmConfig.seed ?? environment.seed ?? 2026,
    });
  } else if (algoName === 'RRT_STAR') {
    planResult = runRRTStar(environment, start, goal, robotConfig, {
      stepSize: algorithmConfig.rrtStepSize ?? 1.15,
      maxIterations: algorithmConfig.rrtMaxIterations ?? 900,
      goalBias: algorithmConfig.rrtGoalBias ?? 0.16,
      seed: algorithmConfig.seed ?? environment.seed ?? 2026,
    });
  } else {
    planResult = runAStar(grid, start, goal, {
      allowDiagonal: algorithmConfig.allowDiagonal ?? true,
      heuristic: algorithmConfig.heuristic ?? 'octile',
      heuristicWeight: algorithmConfig.heuristicWeight ?? 1.0,
    });
  }

  const pathValidation = validatePath(planResult.path, environment, robotConfig);
  const directLineValidation = validatePath([start, goal], environment, robotConfig);

  const isSampling = algoName === 'RRT' || algoName === 'RRT_STAR';
  const resultStatus = planResult.success
    ? 'PATH_FOUND'
    : isSampling
      ? 'SEARCH_LIMIT_REACHED'
      : 'NO_PATH';

  return {
    ...planResult,
    resultStatus,
    endpointValidation,
    gridSummary: {
      rows: grid.rows,
      cols: grid.cols,
      resolution: grid.resolution,
      totalCells: grid.totalCells,
      freeCellsCount: grid.freeCellsCount,
      rawBlockedCount: grid.rawBlockedCount,
      inflatedBlockedCount: grid.inflatedBlockedCount,
      effectiveRadius: grid.effectiveRadius,
    },
    gridCells: grid.cells,
    pathValidation,
    directLineValidation,
    straightLineDistance: Number(euclideanDistance2D(start, goal).toFixed(3)),
  };
}
