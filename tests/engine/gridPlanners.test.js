import { describe, it, expect } from 'vitest';
import {
  buildOccupancyGrid,
  validateEndpoints,
  runPlanner,
  getPlanner,
  listPlanners,
  comparePlanners,
  buildComparisonTable,
  RESULT_STATUS,
} from '../../src/engine/grid/index.js';
import {
  createEnvironmentState,
  setCellBlocked,
  setRegionBlocked,
  clearObstacles,
  generateRandomObstacles,
  generateMaze,
  swapEndpoints,
  randomizeEndpoints,
  resizeEnvironment,
  createHistory,
  commit,
  undo,
  redo,
} from '../../src/engine/grid/editor.js';
import { SCENARIOS, instantiateScenario } from '../../src/engine/grid/scenarios.js';

function gridFrom(state) {
  return buildOccupancyGrid(state);
}

function env(overrides = {}) {
  return createEnvironmentState({
    rows: 10,
    cols: 10,
    cellSize: 1,
    start: { row: 0, col: 0 },
    goal: { row: 9, col: 9 },
    ...overrides,
  });
}

describe('Planner registry', () => {
  it('exposes exactly the six required planners', () => {
    expect(listPlanners().map((p) => p.id)).toEqual([
      'BFS',
      'DIJKSTRA',
      'ASTAR',
      'GREEDY',
      'RRT',
      'RRT_STAR',
    ]);
  });

  it('marks heuristics as unavailable for planners that do not use them', () => {
    expect(getPlanner('BFS').supportsHeuristic).toBe(false);
    expect(getPlanner('DIJKSTRA').supportsHeuristic).toBe(false);
    expect(getPlanner('RRT').supportsHeuristic).toBe(false);
    expect(getPlanner('RRT_STAR').supportsHeuristic).toBe(false);
    expect(getPlanner('ASTAR').supportsHeuristic).toBe(true);
    expect(getPlanner('GREEDY').supportsHeuristic).toBe(true);
  });

  it('marks movement mode as unavailable for sampling planners', () => {
    expect(getPlanner('RRT').supportsMovementMode).toBe(false);
    expect(getPlanner('RRT_STAR').supportsMovementMode).toBe(false);
    expect(getPlanner('ASTAR').supportsMovementMode).toBe(true);
  });

  it('returns an ERROR result for an unknown planner instead of throwing', () => {
    const result = runPlanner({ grid: gridFrom(env()), planner: 'NOT_A_PLANNER' });
    expect(result.status).toBe(RESULT_STATUS.ERROR);
    expect(result.pathFound).toBe(false);
  });
});

describe('Path reconstruction and endpoint validation', () => {
  it('reconstructs a contiguous path from start to goal', () => {
    const grid = gridFrom(env());
    const result = runPlanner({ grid, planner: 'ASTAR' });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(result.path.length).toBeGreaterThan(1);
    expect(result.path[0]).toMatchObject({ row: 0, col: 0 });
    expect(result.path[result.path.length - 1]).toMatchObject({ row: 9, col: 9 });

    // Every consecutive pair must be a legal single-cell step: either
    // orthogonal (row+col delta of 1) or diagonal (both deltas of 1).
    for (let i = 1; i < result.path.length; i += 1) {
      const dr = Math.abs(result.path[i].row - result.path[i - 1].row);
      const dc = Math.abs(result.path[i].col - result.path[i - 1].col);
      expect(dr).toBeLessThanOrEqual(1);
      expect(dc).toBeLessThanOrEqual(1);
      expect(dr + dc).toBeGreaterThanOrEqual(1);
    }
  });

  it('never routes through a blocked cell', () => {
    const state = setRegionBlocked(env(), 0, 0, 9, 4, true);
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'DIJKSTRA' });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    for (const cell of result.path) {
      expect(grid.blocked[cell.index]).toBe(0);
    }
  });

  it('reports an invalid start position', () => {
    const state = setCellBlocked(env(), 0, 0, true);
    state.start = { row: 0, col: 0 };
    state.blocked[0] = true;

    const grid = gridFrom(state);
    const validation = validateEndpoints(grid);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0].target).toBe('start');
  });

  it('reports an invalid goal position', () => {
    const state = env();
    state.goal = { row: 5, col: 5 };
    state.blocked[5 * 10 + 5] = true;

    const grid = gridFrom(state);
    const validation = validateEndpoints(grid);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.target === 'goal')).toBe(true);
  });

  it('treats start equal to goal as a trivially successful plan', () => {
    const state = env();
    state.goal = { ...state.start };
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'BFS' });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(result.path.length).toBe(1);
    expect(result.pathLength).toBe(0);
  });
});

describe('Exhaustive planners: unreachable goals', () => {
  it('BFS proves no path exists when the goal is sealed', () => {
    const state = env();
    // Seal the goal in a 3x3 chamber with a single blocked ring.
    for (let r = 7; r <= 9; r += 1) {
      for (let c = 7; c <= 9; c += 1) {
        if (r === 8 && c === 8) continue;
        state.blocked[r * 10 + c] = true;
      }
    }
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'BFS' });

    expect(result.status).toBe(RESULT_STATUS.NO_PATH);
    expect(result.pathFound).toBe(false);
    expect(result.reason).toMatch(/exhausted/i);
  });

  it('Dijkstra and A* also prove no path exists', () => {
    const state = env();
    for (let r = 0; r <= 9; r += 1) {
      state.blocked[r * 10 + 5] = true;
    }
    const grid = gridFrom(state);

    for (const planner of ['DIJKSTRA', 'ASTAR', 'GREEDY']) {
      const result = runPlanner({ grid, planner });
      expect(result.status).toBe(RESULT_STATUS.NO_PATH);
    }
  });

  it('distinguishes a sampling planner limit from a proven absence of a route', () => {
    const state = env();
    for (let r = 0; r <= 9; r += 1) {
      state.blocked[r * 10 + 5] = true;
    }
    const grid = gridFrom(state);

    const rrt = runPlanner({ grid, planner: 'RRT', options: { maxIterations: 300, seed: 5 } });
    expect(rrt.status).toBe(RESULT_STATUS.SEARCH_LIMIT_REACHED);
    expect(rrt.status).not.toBe(RESULT_STATUS.NO_PATH);
    expect(rrt.reason).toMatch(/does not prove/i);
  });
});

describe('Movement model and corner-crossing constraints', () => {
  it('finds a diagonal route with 8-connected movement', () => {
    const grid = gridFrom(env());
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    // A 10x10 grid needs at least 10 cells of movement (9 diagonal steps).
    expect(result.path.length).toBe(10);
  });

  it('requires more steps with 4-connected movement', () => {
    const grid = gridFrom(env());
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 4 } });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(result.path.length).toBe(19);
  });

  it('forbids squeezing diagonally between two blocked corner cells', () => {
    const state = env();
    // Block the two orthogonal cells that a diagonal move from (0,0) to
    // (1,1) would have to squeeze between. The diagonal must be refused.
    state.blocked[0 * 10 + 1] = true;
    state.blocked[1 * 10 + 0] = true;

    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });

    // The start cell is now only reachable via its two blocked neighbours,
    // so no route exists — the important part is that the planner never
    // reports a path that cuts the corner.
    expect(result.status).toBe(RESULT_STATUS.NO_PATH);
    expect(result.pathFound).toBe(false);
  });

  it('refuses a diagonal step when only one corner neighbour is blocked', () => {
    const state = env();
    // (0,1) is blocked. A diagonal move from (0,0) to (1,1) would cut
    // through it, so the planner must route orthogonally instead.
    state.blocked[0 * 10 + 1] = true;

    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    const first = result.path[1];
    expect(first.row === 1 && first.col === 1).toBe(false);
    // The route must begin by going down, not diagonally.
    expect(first.row).toBe(1);
    expect(first.col).toBe(0);
  });

  it('prices diagonal steps at sqrt(2) and orthogonal steps at 1', () => {
    const grid = gridFrom(env());
    const diagonal = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });
    const orthogonal = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 4 } });

    // 9 diagonal steps * sqrt(2) vs 18 orthogonal steps * 1.
    expect(diagonal.pathCost).toBeCloseTo(9 * Math.SQRT2, 6);
    expect(orthogonal.pathCost).toBeCloseTo(18, 6);
    expect(diagonal.pathLength).toBeCloseTo(9 * Math.SQRT2 * grid.cellSize, 6);
  });

  it('applies the no-corner-cutting rule consistently in the neighbour set', () => {
    const state = env();
    state.blocked[0 * 10 + 1] = true;
    const grid = gridFrom(state);

    const result = runPlanner({ grid, planner: 'BFS', options: { connectivity: 8 } });
    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    // The blocked cell must never appear in the reconstructed path.
    expect(result.path.some((c) => c.row === 0 && c.col === 1)).toBe(false);
  });
});

describe('Shortest-path guarantees', () => {
  it('BFS returns the fewest-edge route', () => {
    const grid = gridFrom(env());
    const result = runPlanner({ grid, planner: 'BFS', options: { connectivity: 4 } });
    expect(result.path.length - 1).toBe(18);
  });

  it('Dijkstra returns a minimum-cost route under terrain weights', () => {
    // A map with two distinct corridors:
    //  - the short corridor crosses the expensive band (few edges, high cost)
    //  - the long corridor stays on cheap terrain (more edges, low cost)
    // BFS minimises edges and takes the short expensive corridor; Dijkstra
    // minimises cost and takes the long cheap one.
    const rows = 9;
    const cols = 9;
    const blocked = new Array(rows * cols).fill(false);
    const weights = new Array(rows * cols).fill(1);

    // A vertical wall at column 4 with two gaps: a short but expensive gap
    // at row 1 and a distant cheap gap at row 8.
    for (let r = 0; r < rows; r += 1) {
      if (r !== 1 && r !== 8) blocked[r * cols + 4] = true;
    }
    // The gap itself is expensive terrain.
    weights[1 * cols + 4] = 50;

    const grid = buildOccupancyGrid({
      rows,
      cols,
      cellSize: 1,
      blocked,
      weights,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 8 },
    });

    const bfs = runPlanner({ grid, planner: 'BFS', options: { connectivity: 4 } });
    const dijkstra = runPlanner({ grid, planner: 'DIJKSTRA', options: { connectivity: 4 } });

    expect(bfs.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(dijkstra.status).toBe(RESULT_STATUS.PATH_FOUND);

    // BFS minimises the edge count: it takes the short corridor through the
    // expensive gap, paying a high traversal cost for it.
    expect(bfs.objectiveValue).toBe(10);
    expect(bfs.pathCost).toBeGreaterThan(50);

    // Dijkstra minimises traversal cost: it detours around the wall and
    // returns a route that is longer in edges but cheaper overall.
    expect(dijkstra.objectiveValue).toBeLessThan(bfs.pathCost);
    expect(dijkstra.pathCost).toBeLessThanOrEqual(bfs.pathCost);
    expect(dijkstra.path.length).toBeGreaterThan(bfs.path.length);
  });

  it('A* matches Dijkstra cost exactly and expands no more cells', () => {
    const state = env();
    for (let r = 3; r <= 7; r += 1) {
      for (let c = 4; c <= 5; c += 1) {
        if (r === 5) continue;
        state.blocked[r * 10 + c] = true;
      }
    }
    const grid = gridFrom(state);

    const dijkstra = runPlanner({ grid, planner: 'DIJKSTRA', options: { connectivity: 8 } });
    const astar = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });

    expect(astar.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(dijkstra.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(astar.pathCost).toBeCloseTo(dijkstra.pathCost, 6);
    expect(astar.nodesExpanded).toBeLessThanOrEqual(dijkstra.nodesExpanded);
  });

  it('Greedy Best-First does not guarantee the optimal route', () => {
    // A layout where the greedy heuristic is deliberately misled.
    const state = env();
    for (let c = 0; c < 8; c += 1) {
      state.blocked[4 * 10 + c] = true;
    }
    const grid = gridFrom(state);

    const greedy = runPlanner({ grid, planner: 'GREEDY', options: { connectivity: 8 } });
    const astar = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });

    expect(greedy.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(astar.status).toBe(RESULT_STATUS.PATH_FOUND);
    // Greedy is allowed to be worse; the test asserts the documented
    // non-guarantee rather than assuming equality.
    expect(greedy.pathCost).toBeGreaterThanOrEqual(astar.pathCost - 1e-9);
  });
});

describe('Sampling planners', () => {
  it('RRT finds a feasible route in an open environment', () => {
    const grid = gridFrom(env());
    const result = runPlanner({
      grid,
      planner: 'RRT',
      options: { seed: 42, maxIterations: 4000, goalBias: 0.2 },
    });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(result.path.length).toBeGreaterThan(1);
    expect(result.nodesGenerated).toBeGreaterThan(0);
  });

  it('RRT is deterministic for a given seed', () => {
    const grid = gridFrom(env());
    const options = { seed: 7, maxIterations: 1500 };
    const a = runPlanner({ grid, planner: 'RRT', options });
    const b = runPlanner({ grid, planner: 'RRT', options });

    expect(a.path.map((p) => `${p.row},${p.col}`)).toEqual(
      b.path.map((p) => `${p.row},${p.col}`)
    );
    expect(a.nodesGenerated).toBe(b.nodesGenerated);
  });

  it('RRT* is implemented separately from RRT and reports tree nodes', () => {
    const grid = gridFrom(env());
    const result = runPlanner({
      grid,
      planner: 'RRT_STAR',
      options: { seed: 11, maxIterations: 2000 },
    });

    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    expect(result.nodesGenerated).toBeGreaterThan(0);
    expect(result.metadata.rewireRadius).not.toBeNull();
  });

  it('RRT and RRT* differ in tree structure because RRT* rewires its sub-tree', () => {
    const grid = gridFrom(env());
    const options = { seed: 21, maxIterations: 1200 };
    const rrt = runPlanner({ grid, planner: 'RRT', options });
    const rrtStar = runPlanner({ grid, planner: 'RRT_STAR', options });

    // RRT* rewires edges toward cheaper parents, so it must record rewired
    // edges while plain RRT must not.
    const rrtRewired = rrt.treeEdges.filter((e) => e.rewired).length;
    const rrtStarRewired = rrtStar.treeEdges.filter((e) => e.rewired).length;

    expect(rrtRewired).toBe(0);
    expect(rrtStarRewired).toBeGreaterThan(0);

    // The rewiring must not break the route: it still reaches the goal and
    // every consecutive pair of route cells is adjacent.
    expect(rrtStar.status).toBe(RESULT_STATUS.PATH_FOUND);
    for (let i = 1; i < rrtStar.path.length; i += 1) {
      const dr = Math.abs(rrtStar.path[i].row - rrtStar.path[i - 1].row);
      const dc = Math.abs(rrtStar.path[i].col - rrtStar.path[i - 1].col);
      expect(dr).toBeLessThanOrEqual(1);
      expect(dc).toBeLessThanOrEqual(1);
    }
  });
});

describe('Cancellation and iteration limits', () => {
  it('reports CANCELLED when the search is aborted mid-flight', () => {
    const grid = gridFrom(env({ rows: 40, cols: 40 }));
    let calls = 0;
    const result = runPlanner({
      grid,
      planner: 'ASTAR',
      options: {
        connectivity: 4,
        isCancelled: () => {
          calls += 1;
          return calls > 5;
        },
      },
    });

    expect(result.status).toBe(RESULT_STATUS.CANCELLED);
    expect(result.pathFound).toBe(false);
  });

  it('reports SEARCH_LIMIT_REACHED when the expansion budget is exhausted', () => {
    const grid = gridFrom(env({ rows: 30, cols: 30 }));
    const result = runPlanner({
      grid,
      planner: 'ASTAR',
      options: { connectivity: 4, maxIterations: 12 },
    });

    expect(result.status).toBe(RESULT_STATUS.SEARCH_LIMIT_REACHED);
    expect(result.reason).toMatch(/limit/i);
  });
});

describe('Environment editor', () => {
  it('paints and erases cells', () => {
    let state = env();
    state = setCellBlocked(state, 2, 2, true);
    expect(state.blocked[2 * 10 + 2]).toBe(true);

    state = setCellBlocked(state, 2, 2, false);
    expect(state.blocked[2 * 10 + 2]).toBe(false);
  });

  it('clears every obstacle', () => {
    let state = generateRandomObstacles(env(), 0.3, 5);
    state = clearObstacles(state);
    expect(state.blocked.some(Boolean)).toBe(false);
  });

  it('generates a maze whose start and goal are free', () => {
    const state = generateMaze(createEnvironmentState({ rows: 21, cols: 21 }), 3);
    expect(state.blocked[state.start.row * state.cols + state.start.col]).toBe(false);
    expect(state.blocked[state.goal.row * state.cols + state.goal.col]).toBe(false);
    expect(state.blocked.some(Boolean)).toBe(true);
  });

  it('never allows an endpoint to rest inside an obstacle', () => {
    let state = env();
    state = setCellBlocked(state, 0, 0, true);
    expect(state.blocked[state.start.row * state.cols + state.start.col]).toBe(false);
  });

  it('swaps and randomizes endpoints', () => {
    const state = env();
    const swapped = swapEndpoints(state);
    expect(swapped.start).toEqual(state.goal);
    expect(swapped.goal).toEqual(state.start);

    const randomized = randomizeEndpoints(state, 9);
    expect(randomized.start).not.toEqual(randomized.goal);
    expect(randomized.blocked[randomized.start.row * state.cols + randomized.start.col]).toBe(false);
  });

  it('resizes while preserving the obstacle layout', () => {
    let state = env();
    state = setCellBlocked(state, 1, 1, true);
    const resized = resizeEnvironment(state, 15, 15);
    expect(resized.rows).toBe(15);
    expect(resized.blocked[1 * 15 + 1]).toBe(true);
  });

  it('supports undo and redo of environment edits', () => {
    let history = createHistory(env());
    const painted = setCellBlocked(history.present, 4, 4, true);
    history = commit(history, painted);
    expect(history.present.blocked[4 * 10 + 4]).toBe(true);

    history = undo(history);
    expect(history.present.blocked[4 * 10 + 4]).toBe(false);

    history = redo(history);
    expect(history.present.blocked[4 * 10 + 4]).toBe(true);
  });
});

describe('Comparison mode', () => {
  it('runs every planner against the same environment', () => {
    const state = env();
    const comparison = comparePlanners({
      environment: state,
      planners: ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'],
      options: { movementMode: 'eight', heuristic: 'octile', seed: 4 },
    });

    expect(comparison.results).toHaveLength(6);
    for (const result of comparison.results) {
      expect(result.applicable).toBe(true);
    }

    // The exhaustive planners must agree on cost.
    const costs = comparison.results
      .filter((r) => ['BFS', 'DIJKSTRA', 'ASTAR'].includes(r.planner))
      .map((r) => r.pathCost);
    expect(new Set(costs.map((c) => c.toFixed(6))).size).toBe(1);
  });

  it('produces a sortable table with honest labels', () => {
    const comparison = comparePlanners({ environment: env(), planners: ['ASTAR', 'RRT'] });
    const table = buildComparisonTable(comparison);
    expect(table).toHaveLength(2);
    expect(table[0]).toHaveProperty('effortLabel');
    expect(table[0]).toHaveProperty('status');
  });

  it('does not claim an optimal route for sampling planners', () => {
    const comparison = comparePlanners({ environment: env(), planners: ['RRT'] });
    expect(comparison.results[0].optimality).toMatch(/feasible/i);
  });
});

describe('Predefined scenarios', () => {
  it('exposes the eight required scenarios', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'empty',
        'random-obstacles',
        'maze',
        'narrow-corridor',
        'dense-obstacles',
        'multiple-routes',
        'unreachable-goal',
        'dynamic-obstacles',
      ])
    );
  });

  it('materialises each scenario into an editable environment', () => {
    for (const scenario of SCENARIOS) {
      const state = instantiateScenario(scenario.id);
      expect(state).not.toBeNull();
      expect(state.rows).toBeGreaterThan(0);
      expect(state.blocked.length).toBe(state.rows * state.cols);
    }
  });

  it('makes the unreachable-goal scenario genuinely unreachable', () => {
    const state = instantiateScenario('unreachable-goal');
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'BFS', options: { connectivity: 4 } });
    expect(result.status).toBe(RESULT_STATUS.NO_PATH);
  });

  it('makes the maze scenario solvable', () => {
    const state = instantiateScenario('maze');
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 4 } });
    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
  });

  it('makes the narrow-corridor scenario solvable only by respecting the corridor', () => {
    const state = instantiateScenario('narrow-corridor');
    const grid = gridFrom(state);
    const result = runPlanner({ grid, planner: 'ASTAR', options: { connectivity: 8 } });
    expect(result.status).toBe(RESULT_STATUS.PATH_FOUND);
    for (const cell of result.path) {
      expect(grid.blocked[cell.index]).toBe(0);
    }
  });
});
