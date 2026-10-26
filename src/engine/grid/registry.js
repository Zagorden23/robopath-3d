/**
 * Planner registry.
 *
 * A single declarative source of truth describing every supported planner.
 * The UI reads the capability flags from here so that controls are always
 * contextual: heuristics are only offered to heuristic-guided planners, and
 * movement modes are only offered to the grid-based planners. Adding a new
 * planner means registering it here — no UI rewrites required.
 */

import { runBFS, runDijkstra, runAStar, runGreedyBestFirst } from './planners/graphSearch.js';
import { runRRT, runRRTStar } from './planners/sampling.js';
import { RESULT_STATUS } from './result.js';

export const PLANNER_IDS = ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'];

/**
 * @typedef {object} PlannerDescriptor
 * @property {string} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {'graph'|'sampling'} family
 * @property {'exhaustive'|'sampling'} kind
 * @property {boolean} supportsHeuristic    may the user choose a heuristic?
 * @property {boolean} supportsMovementMode may the user choose 4/8-direction?
 * @property {boolean} supportsSeed         does it accept a random seed?
 * @property {string}  optimality           honest statement of the guarantee
 * @property {string}  description
 * @property {string}  effortLabel          what `nodesExpanded` counts for this planner
 */

/** @type {Record<string, PlannerDescriptor>} */
export const PLANNER_REGISTRY = {
  BFS: {
    id: 'BFS',
    label: 'Breadth-First Search',
    shortLabel: 'BFS',
    family: 'graph',
    kind: 'exhaustive',
    supportsHeuristic: false,
    supportsMovementMode: true,
    supportsSeed: false,
    optimality: 'Optimal for edge count on unweighted graphs',
    description:
      'Explores the grid level by level with a FIFO queue. Returns the route with the fewest steps. Terrain cost is ignored, so it can be longer in distance than a cost-aware planner.',
    effortLabel: 'Grid cells expanded',
  },
  DIJKSTRA: {
    id: 'DIJKSTRA',
    label: "Dijkstra's Algorithm",
    shortLabel: 'Dijkstra',
    family: 'graph',
    kind: 'exhaustive',
    supportsHeuristic: false,
    supportsMovementMode: true,
    supportsSeed: false,
    optimality: 'Optimal traversal cost',
    description:
      'Uniform-cost search over a min-heap. Expands the cheapest known route first and guarantees the minimum total traversal cost, including terrain penalties.',
    effortLabel: 'Grid cells expanded',
  },
  ASTAR: {
    id: 'ASTAR',
    label: 'A* Search',
    shortLabel: 'A*',
    family: 'graph',
    kind: 'exhaustive',
    supportsHeuristic: true,
    supportsMovementMode: true,
    supportsSeed: false,
    optimality: 'Optimal cost with an admissible heuristic',
    description:
      'Dijkstra guided by an admissible heuristic, ordering the frontier by f(n) = g(n) + h(n). Expands far fewer cells than Dijkstra while still returning a minimum-cost route.',
    effortLabel: 'Grid cells expanded',
  },
  GREEDY: {
    id: 'GREEDY',
    label: 'Greedy Best-First Search',
    shortLabel: 'Greedy',
    family: 'graph',
    kind: 'exhaustive',
    supportsHeuristic: true,
    supportsMovementMode: true,
    supportsSeed: false,
    optimality: 'No optimality guarantee',
    description:
      'Orders the frontier purely by the heuristic h(n), ignoring accumulated cost. Usually expands the fewest cells, but the route it returns is not guaranteed to be optimal.',
    effortLabel: 'Grid cells expanded',
  },
  RRT: {
    id: 'RRT',
    label: 'Rapidly-Exploring Random Tree',
    shortLabel: 'RRT',
    family: 'sampling',
    kind: 'sampling',
    supportsHeuristic: false,
    supportsMovementMode: false,
    supportsSeed: true,
    optimality: 'Feasible route only',
    description:
      'Grows a random tree through continuous space by sampling configurations and extending toward them. Finds a collision-free route quickly but never guarantees the shortest one, and cannot prove a goal is unreachable.',
    effortLabel: 'Tree nodes generated',
  },
  RRT_STAR: {
    id: 'RRT_STAR',
    label: 'Rapidly-Exploring Random Tree Star',
    shortLabel: 'RRT*',
    family: 'sampling',
    kind: 'sampling',
    supportsHeuristic: false,
    supportsMovementMode: false,
    supportsSeed: true,
    optimality: 'Asymptotically optimal over many iterations',
    description:
      'Extends RRT with sub-tree rewiring and edge costs, so the route quality improves as iterations increase. A single run is still not guaranteed to be optimal.',
    effortLabel: 'Tree nodes generated',
  },
};

export function getPlanner(id) {
  return PLANNER_REGISTRY[String(id || '').toUpperCase()] || null;
}

export function listPlanners() {
  return PLANNER_IDS.map((id) => PLANNER_REGISTRY[id]);
}

/**
 * Dispatch a planning request to the correct implementation.
 *
 * @param {object} params
 * @param {object} params.grid      occupancy grid from buildOccupancyGrid
 * @param {string} params.planner   planner id
 * @param {object} [params.options] planner-specific options
 * @returns {object} planner result (see result.js)
 */
export function runPlanner({ grid, planner, options = {} }) {
  const id = String(planner || '').toUpperCase();
  const descriptor = PLANNER_REGISTRY[id];

  if (!descriptor) {
    return {
      planner: id || 'UNKNOWN',
      status: RESULT_STATUS.ERROR,
      pathFound: false,
      reason: `Unknown planner "${planner}".`,
      path: [],
      pathLength: 0,
      pathCost: 0,
      nodesExpanded: 0,
      nodesGenerated: 0,
      peakFrontier: 0,
      planningTimeMs: 0,
      visited: [],
      frontier: [],
      treeEdges: [],
      metadata: { kind: 'unknown' },
    };
  }

  const merged = {
    connectivity: options.connectivity ?? 8,
    heuristic: options.heuristic ?? 'auto',
    heuristicWeight: options.heuristicWeight ?? 1,
    maxIterations: options.maxIterations ?? 2_000_000,
    isCancelled: options.isCancelled,
    ...options,
  };

  switch (id) {
    case 'BFS':
      return runBFS(grid, merged);
    case 'DIJKSTRA':
      return runDijkstra(grid, merged);
    case 'ASTAR':
      return runAStar(grid, merged);
    case 'GREEDY':
      return runGreedyBestFirst(grid, merged);
    case 'RRT':
      return runRRT(grid, merged);
    case 'RRT_STAR':
      return runRRTStar(grid, merged);
    default:
      return {
        planner: id,
        status: RESULT_STATUS.ERROR,
        pathFound: false,
        reason: `Planner "${id}" has no registered implementation.`,
        path: [],
        pathLength: 0,
        pathCost: 0,
        nodesExpanded: 0,
        nodesGenerated: 0,
        peakFrontier: 0,
        planningTimeMs: 0,
        visited: [],
        frontier: [],
        treeEdges: [],
        metadata: { kind: 'unknown' },
      };
  }
}
