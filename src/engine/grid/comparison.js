/**
 * Fair multi-algorithm comparison.
 *
 * Every planner in a comparison runs against the SAME environment, the SAME
 * start/goal cells, the SAME movement model and the SAME cost definition.
 * Results therefore describe a genuine head-to-head on one map.
 *
 * Planners whose family does not support the requested movement mode are
 * reported as "not applicable" rather than silently run with different
 * settings, because an unmatched run is not a controlled comparison.
 */

import { buildOccupancyGrid, validateEndpoints } from './grid.js';
import { runPlanner, getPlanner, listPlanners } from './registry.js';
import { RESULT_STATUS } from './result.js';
import { resolveHeuristic } from './heuristics.js';
import { resolveConnectivity } from './movement.js';

/**
 * @param {object} params
 * @param {object} params.environment  grid environment state
 * @param {string[]} [params.planners] planner ids to compare
 * @param {object} [params.options]   shared planner options
 */
export function comparePlanners({
  environment,
  planners = ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'],
  options = {},
}) {
  const grid = buildOccupancyGrid(environment);
  const endpointValidation = validateEndpoints(grid);
  const connectivity = resolveConnectivity(options.movementMode ?? 'eight');
  const heuristic = resolveHeuristic(
    options.heuristic ?? 'auto',
    connectivity === 8
  );

  const shared = {
    connectivity,
    heuristic,
    heuristicWeight: options.heuristicWeight ?? 1,
    maxIterations: options.maxIterations,
    seed: options.seed ?? environment.seed ?? 2026,
    isCancelled: options.isCancelled,
  };

  const results = planners.map((id) => {
    const descriptor = getPlanner(id);

    if (!descriptor) {
      return {
        planner: id,
        applicable: false,
        status: RESULT_STATUS.ERROR,
        pathFound: false,
        reason: `Unknown planner "${id}".`,
        pathLength: 0,
        pathCost: 0,
        nodesExpanded: 0,
        nodesGenerated: 0,
        planningTimeMs: 0,
        path: [],
        visited: [],
        treeEdges: [],
      };
    }

    if (!endpointValidation.valid) {
      return {
        planner: id,
        applicable: false,
        status: RESULT_STATUS.ERROR,
        pathFound: false,
        reason: endpointValidation.errors[0].message,
        pathLength: 0,
        pathCost: 0,
        nodesExpanded: 0,
        nodesGenerated: 0,
        planningTimeMs: 0,
        path: [],
        visited: [],
        treeEdges: [],
      };
    }

    const result = runPlanner({ grid, planner: id, options: shared });

    return {
      planner: id,
      label: descriptor.label,
      applicable: true,
      status: result.status,
      pathFound: result.pathFound,
      reason: result.reason,
      pathLength: result.pathLength,
      pathCost: result.pathCost,
      nodesExpanded: result.nodesExpanded,
      nodesGenerated: result.nodesGenerated,
      peakFrontier: result.peakFrontier,
      planningTimeMs: result.planningTimeMs,
      path: result.path,
      visited: result.visited,
      treeEdges: result.treeEdges,
      effortLabel: descriptor.effortLabel,
      optimality: descriptor.optimality,
    };
  });

  return {
    results,
    environmentId: environment.id ?? null,
    environmentLabel: environment.name ?? 'Environment',
    settings: {
      movementMode: options.movementMode ?? 'eight',
      connectivity,
      heuristic,
      heuristicWeight: shared.heuristicWeight,
      seed: shared.seed,
    },
    summary: summarise(results),
  };
}

/**
 * Produce an honest narrative from the measured comparison results.
 */
function summarise(results) {
  const applicable = results.filter((r) => r.applicable);
  const successful = applicable.filter((r) => r.status === RESULT_STATUS.PATH_FOUND);

  if (applicable.length === 0) {
    return 'No planner could be evaluated for this environment.';
  }
  if (successful.length === 0) {
    const limits = applicable.filter((r) => r.status === RESULT_STATUS.SEARCH_LIMIT_REACHED);
    if (limits.length === applicable.length) {
      return 'Every sampling planner reached its iteration limit before connecting to the goal. This does not prove the goal is unreachable — increase the iteration limit or adjust the seed.';
    }
    return 'No planner found a valid route. The exhaustive planners exhausted their frontier, so no route exists in this configuration.';
  }

  const parts = [];

  const astar = successful.find((r) => r.planner === 'ASTAR');
  const dijkstra = successful.find((r) => r.planner === 'DIJKSTRA');
  const greedy = successful.find((r) => r.planner === 'GREEDY');

  if (astar && dijkstra) {
    if (astar.pathCost === dijkstra.pathCost) {
      const saved =
        dijkstra.nodesExpanded > 0
          ? Math.round(
              (1 - astar.nodesExpanded / dijkstra.nodesExpanded) * 100
            )
          : 0;
      parts.push(
        `A* and Dijkstra returned the same minimum traversal cost (${astar.pathCost.toFixed(
          2
        )}), with A* expanding ${astar.nodesExpanded} cells against Dijkstra's ${dijkstra.nodesExpanded}${
          saved > 0 ? ` (${saved}% fewer)` : ''
        }.`
      );
    } else {
      parts.push(
        `A* returned a traversal cost of ${astar.pathCost.toFixed(2)} while Dijkstra returned ${dijkstra.pathCost.toFixed(
          2
        )}. Both are cost-optimal, so a difference here indicates the heuristic weight above 1 is no longer admissible.`
      );
    }
  }

  if (greedy && astar && greedy.pathCost > astar.pathCost + 1e-6) {
    parts.push(
      `Greedy Best-First expanded only ${greedy.nodesExpanded} cells but returned a longer route (cost ${greedy.pathCost.toFixed(
        2
      )} against A*'s ${astar.pathCost.toFixed(2)}), illustrating that it trades route quality for search effort.`
    );
  }

  const sampling = successful.filter((r) => r.family === 'sampling' || r.planner.startsWith('RRT'));
  if (sampling.length > 0 && astar) {
    for (const sample of sampling) {
      parts.push(
        `${sample.planner} produced a feasible route of length ${sample.pathLength.toFixed(
          2
        )} m using ${sample.nodesGenerated} tree nodes, compared with A*'s grid-optimal ${astar.pathLength.toFixed(
          2
        )} m. Sampling planners do not guarantee the shortest route.`
      );
    }
  }

  return parts.join(' ') || 'Comparison complete.';
}

/**
 * Flatten comparison results into a table-friendly shape.
 */
export function buildComparisonTable(comparison) {
  return comparison.results.map((r) => ({
    planner: r.planner,
    label: r.label ?? r.planner,
    applicable: r.applicable,
    status: r.status,
    pathFound: r.pathFound,
    pathLength: Number((r.pathLength ?? 0).toFixed(3)),
    pathCost: Number((r.pathCost ?? 0).toFixed(3)),
    nodesExpanded: r.nodesExpanded ?? 0,
    nodesGenerated: r.nodesGenerated ?? 0,
    planningTimeMs: Number((r.planningTimeMs ?? 0).toFixed(3)),
    effortLabel: r.effortLabel ?? 'Search effort',
    optimality: r.optimality ?? '',
  }));
}

export { listPlanners };
