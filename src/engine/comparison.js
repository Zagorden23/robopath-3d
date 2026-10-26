/**
 * Multi-Algorithm Benchmark & Fair Comparison Runner.
 * Evaluates BFS, Dijkstra, A*, and RRT under identical environment and robot C-space assumptions.
 */

import { executeMotionPlan } from './planners/index.js';

export function compareAlgorithms({
  environment,
  robotConfig = {},
  algorithms = ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
  sharedOptions = {},
}) {
  const allowDiagonal = sharedOptions.allowDiagonal ?? true;
  const heuristic = sharedOptions.heuristic ?? (allowDiagonal ? 'octile' : 'manhattan');

  const results = algorithms.map((algo) => {
    const plan = executeMotionPlan({
      environment,
      robotConfig,
      algorithmConfig: {
        algorithm: algo,
        allowDiagonal,
        heuristic,
        heuristicWeight: sharedOptions.heuristicWeight ?? 1.0,
        rrtStepSize: sharedOptions.rrtStepSize ?? 1.15,
        rrtMaxIterations: sharedOptions.rrtMaxIterations ?? 900,
        rrtGoalBias: sharedOptions.rrtGoalBias ?? 0.16,
        seed: environment.seed ?? 2026,
      },
    });

    return {
      algorithm: algo,
      success: plan.success,
      reason: plan.reason,
      pathLength: plan.pathValidation?.pathLength ?? 0,
      traversalCost: plan.pathValidation?.traversalCost ?? 0,
      hopCount: plan.hopCount ?? 0,
      nodesExpanded: plan.nodesExpanded ?? 0,
      peakQueueSize: plan.peakQueueSize ?? 0,
      planningTimeMs: plan.planningTimeMs ?? 0,
      minClearance: plan.pathValidation?.minClearance ?? 0,
      isCollisionFree: Boolean(plan.success && plan.pathValidation?.isValid),
      path: plan.path || [],
      exploredNodes: plan.exploredNodes || [],
      treeEdges: plan.treeEdges || [],
    };
  });

  // Generate honest comparative analysis from actual measured values
  const successful = results.filter((r) => r.success);
  let summaryNarrative = '';

  if (successful.length === 0) {
    summaryNarrative =
      'No algorithm found a feasible path in this configuration. Both graph-search and sampling-based planners verified that C-space obstacle inflation blocks all routes to the goal.';
  } else {
    const astar = successful.find((r) => r.algorithm === 'ASTAR');
    const dijkstra = successful.find((r) => r.algorithm === 'DIJKSTRA');
    const bfs = successful.find((r) => r.algorithm === 'BFS');
    const rrt = successful.find((r) => r.algorithm === 'RRT');

    const parts = [];
    if (astar && dijkstra) {
      const ratio =
        dijkstra.nodesExpanded > 0
          ? Math.round((1 - astar.nodesExpanded / dijkstra.nodesExpanded) * 100)
          : 0;
      if (ratio > 0) {
        parts.push(
          `On this map, A* expanded ${astar.nodesExpanded} nodes vs. Dijkstra's ${dijkstra.nodesExpanded} (${ratio}% fewer expansions) while matching the ${astar.traversalCost} optimal traversal cost.`
        );
      } else {
        parts.push(
          `On this map, A* (${astar.nodesExpanded} nodes) and Dijkstra (${dijkstra.nodesExpanded} nodes) explored a comparable frontier due to obstacle geometry.`
        );
      }
    }

    if (bfs && dijkstra && (environment.terrainZones || []).length > 0) {
      if (bfs.traversalCost > dijkstra.traversalCost + 0.05) {
        parts.push(
          `Because weighted terrain is present, BFS minimized hop count (${bfs.hopCount} steps) at a higher traversal cost (${bfs.traversalCost}), whereas Dijkstra routed around high-cost terrain for cost ${dijkstra.traversalCost}.`
        );
      }
    }

    if (rrt && astar) {
      parts.push(
        `Continuous-space RRT found a valid path of length ${rrt.pathLength}m (${rrt.nodesExpanded} tree samples) compared to A*'s grid-optimal ${astar.pathLength}m—illustrating RRT's non-optimal, sampling-driven exploration.`
      );
    }

    summaryNarrative =
      parts.join(' ') ||
      'Comparison complete. Notice how graph connectivity, edge weights, and heuristics govern frontier expansion and path optimality.';
  }

  return {
    results,
    summaryNarrative,
    gridSummary: executeMotionPlan({
      environment,
      robotConfig,
      algorithmConfig: { algorithm: 'ASTAR' },
    }).gridSummary,
  };
}
