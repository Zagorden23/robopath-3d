/**
 * Planning orchestrator: turns a scenario (+ optional per-run overrides)
 * into validated, measured plan results. Everything returned is real
 * computed data — the UI and explanation panel render only what is here.
 */
import { createEnvironment } from './environment.js';
import { createCollisionWorld } from './collision.js';
import { buildOccupancyGrid } from './grid.js';
import { bfsSearch, dijkstraSearch, astarSearch } from './search.js';
import { rrtSearch } from './rrt.js';
import { createRobot } from './robot.js';
import { angleDiff, polylineLength } from './geometry.js';

export const ALGORITHMS = {
  bfs: { label: 'BFS', kind: 'grid', description: 'Breadth-first search — fewest edges (unweighted graphs).' },
  dijkstra: { label: 'Dijkstra', kind: 'grid', description: 'Uniform-cost search with a priority queue — fewest cumulative cost.' },
  astar: { label: 'A*', kind: 'grid', description: 'A* — Dijkstra plus an admissible heuristic to focus the search.' },
  rrt: { label: 'RRT', kind: 'continuous', description: 'Rapidly-exploring random tree — sampling-based feasible path.' },
};

export const DEFAULT_PLANNING = {
  algorithm: 'astar',
  connectivity: 8,
  heuristic: 'octile', // 'auto' resolves per connectivity
  safetyMargin: 0.08,
  ignoreFootprint: false, // used only by the feasibility demo to show naive planning
  rrt: {
    stepSize: 0.55,
    goalBias: 0.06,
    maxIterations: 6000,
    goalRadius: 0.35,
  },
};

export const DEFAULT_MOTION = { speedFactor: 0.7 };

/** Merge scenario + per-run override into the effective configuration. */
export function resolveRunConfig(scenario, run = {}) {
  const planning = { ...DEFAULT_PLANNING, ...(scenario.planning || {}), ...(run.planning || {}) };
  planning.heuristic = resolveHeuristicName(planning.connectivity, planning.heuristic);
  return {
    envConfig: { ...(scenario.env || {}), ...(run.env || {}) },
    robotConfig: { ...(scenario.robot || {}), ...(run.robot || {}) },
    planning,
    motion: { ...DEFAULT_MOTION, ...(scenario.motion || {}), ...(run.motion || {}) },
    ignoreFootprint: planning.ignoreFootprint === true,
    algorithm: planning.algorithm,
    label: run.label || ALGORITHMS[planning.algorithm]?.label || planning.algorithm,
  };
}

export function resolveHeuristicName(connectivity, requested) {
  if (requested && requested !== 'auto') {
    // manhattan is only admissible for 4-connected uniform-cost movement
    if (requested === 'manhattan' && connectivity === 8) return 'octile';
    return requested;
  }
  return connectivity === 8 ? 'octile' : 'manhattan';
}

function inErrorResult(kind, message, detail = {}) {
  return {
    status: kind,
    found: false,
    reason: kind,
    message,
    path: [],
    visited: [],
    tree: [],
    nodesExpanded: 0,
    metrics: { planTimeMs: 0 },
    ...detail,
  };
}

/** Execute one planning run end-to-end (validation → plan → validation of path). */
export function executePlanRun(scenario, run = {}, runIndex = 0) {
  const cfg = resolveRunConfig(scenario, run);
  const env = createEnvironment(cfg.envConfig);
  const robot = createRobot(cfg.robotConfig);
  const maskRadius = cfg.ignoreFootprint ? 0 : robot.radius;
  const planningRadius = maskRadius + cfg.planning.safetyMargin;
  const collision = createCollisionWorld(env, { robotRadius: maskRadius, safetyMargin: cfg.planning.safetyMargin });

  const start = { x: robot.startPose.x, y: robot.startPose.y };
  const goal = { x: robot.goalPose.x, y: robot.goalPose.y };

  const base = {
    runIndex,
    algorithm: cfg.algorithm,
    label: cfg.label,
    note: run.note || null,
    env,
    robot,
    planning: cfg.planning,
    start,
    goal,
    createdAt: new Date().toISOString(),
  };

  // --- Environment / pose validation ---------------------------------------
  if (start.x < 0 || start.x > env.width || start.y < 0 || start.y > env.height) {
    return { ...base, ...inErrorResult('out_of_bounds', 'Start pose is outside the environment bounds.') };
  }
  if (goal.x < 0 || goal.x > env.width || goal.y < 0 || goal.y > env.height) {
    return { ...base, ...inErrorResult('out_of_bounds', 'Goal pose is outside the environment bounds.') };
  }
  const startObstacle = collision.isCollidingWith(start.x, start.y);
  if (startObstacle) {
    return { ...base, ...inErrorResult('start_in_obstacle', `Start position lies inside ${env.obstacleLabel(startObstacle)}.`, { obstacleId: startObstacle }) };
  }
  const goalObstacle = collision.isCollidingWith(goal.x, goal.y);
  if (goalObstacle) {
    return { ...base, ...inErrorResult('goal_in_obstacle', `Goal position lies inside ${env.obstacleLabel(goalObstacle)}.`, { obstacleId: goalObstacle }) };
  }

  maskEnvStats(env, collision, maskRadius, cfg.planning.safetyMargin, start, goal);

  // --- Planning --------------------------------------------------------------
  let result;
  const algo = ALGORITHMS[cfg.algorithm];
  const t0 = performance.now();

  if (!algo) {
    return { ...base, ...inErrorResult('bad_algorithm', `Unknown algorithm "${cfg.algorithm}".`) };
  }

  if (algo.kind === 'grid') {
    const grid = buildOccupancyGrid(env, { robotRadius: maskRadius, safetyMargin: cfg.planning.safetyMargin });
    const startCell = env.worldToCell(start.x, start.y);
    const goalCell = env.worldToCell(goal.x, goal.y);
    const connectivity = cfg.algorithm === 'bfs' ? (cfg.planning.connectivity || 4) : (cfg.planning.connectivity || 8);
    const heuristicName = resolveHeuristicName(connectivity, cfg.planning.heuristic);

    result = { ...base, grid, startCell, goalCell, connectivity, heuristicName };

    if (grid.isBlocked(startCell.ix, startCell.iy) && maskRadius > 0) {
      result = { ...result, ...inErrorResult('start_blocked', `The robot footprint (r = ${maskRadius.toFixed(2)} m) does not fit at the start cell — the space is inflated into an obstacle.`, {}) };
      result.gridSummary = gridSummary(grid);
      return result;
    }
    if (grid.isBlocked(goalCell.ix, goalCell.iy) && maskRadius > 0) {
      result = { ...result, ...inErrorResult('goal_blocked', `The robot footprint (r = ${maskRadius.toFixed(2)} m) does not fit at the goal cell — the space is inflated into an obstacle.`, {}) };
      result.gridSummary = gridSummary(grid);
      return result;
    }

    let search;
    if (cfg.algorithm === 'bfs') {
      search = bfsSearch(grid, startCell, goalCell, { connectivity });
    } else if (cfg.algorithm === 'dijkstra') {
      search = dijkstraSearch(grid, startCell, goalCell, { connectivity, costAware: true });
    } else {
      search = astarSearch(grid, startCell, goalCell, { connectivity, heuristicName });
    }

    result = mergeSearchResult(result, search, grid, env);
  } else {
    const rrtOptions = {
      ...cfg.planning.rrt,
      seed: (cfg.planning.rrt.seed ?? 7) + runIndex * 101,
    };
    if (cfg.planning.rrt.seedRandom) rrtOptions.seed = (Math.random() * 1e9) >>> 0;
    const rrtCollision = createCollisionWorld(env, { robotRadius: maskRadius, safetyMargin: cfg.planning.safetyMargin });
    const rrt = rrtSearch({ env, collision: rrtCollision, start, goal, options: rrtOptions });
    result = { ...base, ...rrt, path: rrt.found ? mergeEndpoints(rrt.path, start, goal) : [] };
    result.pathLength = result.found ? polylineLength(result.path) : 0;
    result.visiblePath = result.path;
  }

  // --- Post-plan validation + route analysis ----------------------------------
  if (result.found) {
    result.visiblePath = mergeCollinear(result.path);
    result.pathLength = polylineLength(result.visiblePath);
    result.validation = validatePath(result.visiblePath, collision, {
      radius: maskRadius || robot.radius,
      tolerance: -0.02,
      step: Math.max(0.04, env.cellSize / 4),
    });
    result.analysis = analyzeRoute(result.visiblePath, collision, env, result.validation);
  }

  return result;
}

function maskEnvStats(env, collision, maskRadius, margin, start, goal) {
  // no-op kept for symmetry; stats computed during execution.
}

export function gridSummary(grid) {
  let blockedCount = 0;
  for (let i = 0; i < grid.blocked.length; i += 1) blockedCount += grid.blocked[i];
  return {
    cols: grid.cols,
    rows: grid.rows,
    cellSize: grid.cellSize,
    totalCells: grid.cols * grid.rows,
    blockedCells: blockedCount,
    freeCells: grid.cols * grid.rows - blockedCount,
  };
}

function mergeSearchResult(result, search, grid, env) {
  const { cells } = search;
  const worldPath = cells && cells.length
    ? [result.start, ...cells.map((c) => env.cellCenter(c.ix, c.iy)), result.goal]
    : [];
  return {
    ...result,
    found: search.found,
    reason: search.reason,
    visited: search.visited,
    path: worldPath,
    pathCost: search.pathCost,
    nodesExpanded: search.nodesExpanded,
    peakFrontier: search.peakFrontier,
    metrics: {
      planTimeMs: search.durationMs,
      nodesExpanded: search.nodesExpanded,
      peakFrontier: search.peakFrontier,
      pathCost: search.pathCost,
      gridSummary: gridSummary(grid),
      heuristic: result.heuristicName,
      connectivity: result.connectivity,
    },
  };
}

function mergeEndpoints(path, start, goal) {
  if (!path.length) return [];
  const pts = [...path];
  if (dist2p(pts[0], start) > 1e-4) pts.unshift(start);
  if (dist2p(pts[pts.length - 1], goal) > 1e-4) pts.push(goal);
  return pts;
}

const dist2p = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Drop intermediate points that lie on the same line (keeps corners only). */
export function mergeCollinear(path, angleTolerance = 0.5, minSegment = 0.01) {
  if (path.length <= 2) return [...path];
  const out = [path[0]];
  let lastHeading = null;
  for (let i = 1; i < path.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = path[i];
    const heading = Math.atan2(cur.y - prev.y, cur.x - prev.x);
    const segLen = dist2p(prev, cur);
    if (lastHeading === null || Math.abs(angleDiff(lastHeading, heading)) > angleTolerance || segLen < minSegment) {
      if (segLen > minSegment || i === path.length - 1) {
        out.push(cur);
        lastHeading = heading;
      } else {
        out[out.length - 1] = cur;
      }
      continue;
    }
    out[out.length - 1] = cur;
  }
  if (out.length < 2) return [...path];
  return out;
}

/** Independent re-check of the whole path against real obstacle geometry. */
export function validatePath(path, collision, { radius, tolerance = -0.02, step = 0.05 } = {}) {
  const walkRadius = radius + tolerance;
  let minClearance = Infinity;
  let minPoint = null;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s <= n; s += 1) {
      const t = s / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const clearance = collision.clearanceAt(x, y);
      if (clearance < minClearance) {
        minClearance = clearance;
        minPoint = { x, y, segment: i - 1 };
      }
      if (clearance < walkRadius) {
        return {
          ok: false,
          at: { x, y },
          clearance,
          required: radius,
          segment: i - 1,
          obstacleId: collision.isCollidingWith(x, y),
          minClearance,
        };
      }
    }
  }
  return { ok: true, at: null, minClearance, minPoint, required: radius };
}

/**
 * "Why this route" facts — real geometry, real costs:
 * - is the straight-line shortcut blocked, and by which obstacle?
 * - where does the path turn, and what obstacle forces the turn?
 * - the tightest squeeze along the path (min clearance).
 */
export function analyzeRoute(path, collision, env, validation) {
  const facts = { turns: [], minClearancePoint: null, corridor: true };
  const direct = collision.segmentCheck(path[0].x, path[0].y, path[path.length - 1].x, path[path.length - 1].y, 0.08, radiusFor(collision));
  facts.directLine = {
    clear: direct.ok,
    at: direct.at,
    obstacle: direct.ok ? null : (env.obstacleLabel(collision.isCollidingWith(direct.at.x, direct.at.y))),
  };

  // Heading-change points (turn clusters).
  let prevHeading = null;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const h = Math.atan2(b.y - a.y, b.x - a.x);
    if (prevHeading !== null && Math.abs(angleDiff(prevHeading, h)) > Math.PI / 6) {
      const near = collision.nearestObstacle(a.x, a.y);
      facts.turns.push({
        index: i, at: { ...a }, turnAngle: angleDiff(prevHeading, h),
        obstacleId: near.id, obstacleLabel: near.label, clearance: near.distance,
      });
    }
    prevHeading = h;
  }

  if (validation && Number.isFinite(validation.minClearance)) {
    facts.minClearancePoint = {
      at: validation.minPoint, clearance: validation.minClearance,
      obstacleId: validation.minPoint ? collision.isCollidingWith(validation.minPoint.x, validation.minPoint.y) : null,
    };
  }
  facts.pathLength = polylineLength(path);
  return facts;
}

function radiusFor(collision) {
  return collision.robotRadius + collision.safetyMargin;
}
