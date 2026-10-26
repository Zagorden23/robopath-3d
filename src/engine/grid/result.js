/**
 * Shared result contract for every planner in the registry.
 *
 * `status` is the single authoritative outcome field. It is deliberately
 * explicit so that an exhaustive planner that proved a goal unreachable is
 * never confused with a sampling planner that merely ran out of iterations.
 */

export const RESULT_STATUS = {
  PATH_FOUND: 'PATH_FOUND',
  NO_PATH: 'NO_PATH',
  SEARCH_LIMIT_REACHED: 'SEARCH_LIMIT_REACHED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
};

/**
 * Exhaustive planners (BFS, Dijkstra, A*, Greedy) can prove that no route
 * exists once their frontier is exhausted. Sampling planners (RRT, RRT*)
 * cannot: running out of iterations only means the search budget was spent.
 */
export const EXHAUSTIVE_STATUSES = [RESULT_STATUS.PATH_FOUND, RESULT_STATUS.NO_PATH];

export function isTerminalSuccess(status) {
  return status === RESULT_STATUS.PATH_FOUND;
}

/**
 * Build a planner result object with every field present, so consumers never
 * have to guard against `undefined`.
 */
export function makeResult({
  planner,
  status,
  reason = null,
  path = [],
  pathLength = 0,
  pathCost = 0,
  objectiveValue = null,
  visited = [],
  nodesExpanded = visited.length,
  nodesGenerated = visited.length,
  peakFrontier = 0,
  planningTimeMs = 0,
  frontier = [],
  treeEdges = [],
  metadata = {},
}) {
  return {
    planner,
    status,
    pathFound: status === RESULT_STATUS.PATH_FOUND,
    reason,
    path,
    pathLength,
    pathCost,
    // The value the planner actually minimised. For BFS this is the edge
    // count; for cost-based planners it is the traversal cost. Null when
    // the planner did not reach the goal.
    objectiveValue,
    nodesExpanded,
    nodesGenerated,
    peakFrontier,
    planningTimeMs,
    visited,
    frontier,
    treeEdges,
    metadata,
  };
}

/**
 * The status a planner should report when it stops without finding a path.
 * Exhaustive planners report NO_PATH; sampling planners report
 * SEARCH_LIMIT_REACHED because they never proved the goal unreachable.
 */
export function exhaustedStatus(plannerKind) {
  return plannerKind === 'sampling'
    ? RESULT_STATUS.SEARCH_LIMIT_REACHED
    : RESULT_STATUS.NO_PATH;
}
