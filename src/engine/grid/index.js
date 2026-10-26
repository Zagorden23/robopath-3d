/**
 * Public entry point for the unified grid planning engine.
 *
 * Both the 2D simulator and the 3D simulator import from this module, which
 * guarantees that the two views execute exactly the same planning logic and
 * report exactly the same metrics.
 */

export {
  buildOccupancyGrid,
  validateEndpoints,
  gridToSpec,
  MIN_DIMENSION,
  MAX_DIMENSION,
} from './grid.js';

export {
  RESULT_STATUS,
  EXHAUSTIVE_STATUSES,
  isTerminalSuccess,
  makeResult,
  exhaustedStatus,
} from './result.js';

export {
  PLANNER_IDS,
  PLANNER_REGISTRY,
  getPlanner,
  listPlanners,
  runPlanner,
} from './registry.js';

export {
  HEURISTIC_NAMES,
  HEURISTIC_LABELS,
  heuristicValue,
  heuristicCost,
  resolveHeuristic,
} from './heuristics.js';

export {
  MOVEMENT_MODES,
  resolveConnectivity,
  neighbors,
  stepCost,
  cellPathCost,
  cellPathLengthMetres,
} from './movement.js';

export * from './editor.js';

export { comparePlanners, buildComparisonTable } from './comparison.js';
