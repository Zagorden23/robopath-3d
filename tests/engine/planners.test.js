import { describe, it, expect } from 'vitest';
import { createEnvironment } from '../../src/engine/environment.js';
import { buildOccupancyGrid, OFFSETS_4 } from '../../src/engine/grid.js';
import { bfsSearch, dijkstraSearch, astarSearch } from '../../src/engine/search.js';
import { createCollisionWorld } from '../../src/engine/collision.js';
import { executePlanRun, DEFAULT_PLANNING, resolveRunConfig } from '../../src/engine/plan.js';
import { rrtSearch } from '../../src/engine/rrt.js';
import { mergeCollinear } from '../../src/engine/plan.js';

const CS = 0.5;

function gridFor(env, radius = 0.3, margin = 0.08) {
  return buildOccupancyGrid(env, { robotRadius: radius, safetyMargin: margin });
}

function scenario(envOverrides, robotOverrides = {}, planningOverrides = {}) {
  return {
    name: 'Test scenario',
    env: { width: 12, height: 8, cellSize: CS, obstacles: [], weightZones: [], ...envOverrides },
    robot: { model: 'differential', radius: 0.35, startPose: { x: 0.5, y: 0.5, theta: 0 }, goalPose: { x: 1.5, y: 1.5, theta: null }, ...robotOverrides },
    planning: { ...DEFAULT_PLANNING, ...planningOverrides },
    motion: { speedFactor: 0.7 },
  };
}

describe('Priority queue', () => {
  it('dequeues in priority order and reports peak frontier', async () => {
    const { PriorityQueue } = await import('../../src/engine/PriorityQueue.js');
    const pq = new PriorityQueue();
    pq.enqueue('a', 3);
    pq.enqueue('b', 1);
    pq.enqueue('c', 2);
    expect(pq.dequeue()).toBe('b');
    expect(pq.dequeue()).toBe('c');
    expect(pq.dequeue()).toBe('a');
    expect(pq.maxSizeReached).toBe(3);
  });
});

describe('Occupancy grid', () => {
  it('blocks cells whose clearance is below robot radius + margin', () => {
    const env = createEnvironment({ width: 12, height: 8, cellSize: CS, obstacles: [{ type: 'box', x: 6, y: 4, width: 2, depth: 2, height: 1 }] });
    const grid = gridFor(env, 0.3, 0.08);
    // cell centers inside or near the 2x2 box at (6,4)
    const near = env.worldToCell(6.5, 4.5);
    const far = env.worldToCell(1.5, 1.5);
    expect(grid.blocked[grid.index(near.ix, near.iy)]).toBe(1);
    expect(grid.blocked[grid.index(far.ix, far.iy)]).toBe(0);
  });
});

describe('BFS on deterministic maps', () => {
  it('finds the minimum-edge path on a 5x5 unweighted grid', () => {
    const env = createEnvironment({ width: 2.5, height: 2.5, cellSize: CS, name: 'maze' });
    const grid = gridFor(env, 0.01, 0.0001);
    const start = env.worldToCell(0.25, 0.25); // cell (0,0)
    const goal = env.worldToCell(2.25, 2.25);  // cell (4,4)
    const r = bfsSearch(grid, start, goal, { connectivity: 4 });
    expect(r.found).toBe(true);
    expect(r.cells).toHaveLength(9); // 8 moves
    expect(r.visited[0]).toMatchObject({ ix: 0, iy: 0 });
    // BFS depth values increase by 1 per edge
    expect(r.visited[r.visited.length - 1].g).toBe(8);
  });

  it('goes around a central obstacle with the expected edge count', () => {
    const env = createEnvironment({
      width: 2.5, height: 2.5, cellSize: CS,
      obstacles: [{ type: 'box', x: 1.25, y: 1.25, width: 0.9, depth: 0.9, height: 1 }],
    });
    const grid = gridFor(env, 0.3, 0.001);
    const start = env.worldToCell(0.25, 1.25);
    const goal = env.worldToCell(2.25, 1.25);
    const r = bfsSearch(grid, start, goal, { connectivity: 4 });
    expect(r.found).toBe(true);
    expect(r.cells).toHaveLength(9); // 9 -> detour around the 3x3 inflated block
  });

  it('reports no_path when a full wall separates start and goal', () => {
    const env = createEnvironment({
      width: 2.5, height: 2.5, cellSize: CS,
      obstacles: [{ type: 'box', x: 1.25, y: 1.25, width: 0.5, depth: 2.5, height: 1 }],
    });
    const grid = gridFor(env, 0.01, 0.0001);
    const start = env.worldToCell(0.25, 1.25);
    const goal = env.worldToCell(2.25, 1.25);
    const r = bfsSearch(grid, start, goal, { connectivity: 4 });
    expect(r.found).toBe(false);
    expect(r.reason).toBe('no_path');
  });
});

describe('Dijkstra and A* on weighted terrain', () => {
  it('dijkstra prefers the cheap bypass over the short busy crossing', () => {
    const env = createEnvironment({
      width: 12, height: 6, cellSize: CS, obstacles: [],
      weightZones: [{ x: 4, y: 0, width: 4, depth: 3, multiplier: 4 }],
    });
    const grid = gridFor(env, 0.1, 0.001);
    const start = env.worldToCell(0.25, 0.75);
    const goal = env.worldToCell(11.75, 0.75);
    const d = dijkstraSearch(grid, start, goal, { connectivity: 4 });
    const b = bfsSearch(grid, start, goal, { connectivity: 4 });
    expect(d.found).toBe(true);
    expect(b.found).toBe(true);
    expect(d.pathCost).toBeLessThan(b.pathCost + 1e-9);
    expect(d.cells[d.cells.length - 1]).toEqual(expect.objectContaining({ ix: 23, iy: 1 }));
  });

  it('A* with an admissible heuristic returns the optimal cost and expands fewer nodes than Dijkstra', () => {
    const env = createEnvironment({
      width: 12, height: 8, cellSize: CS,
      obstacles: [
        { type: 'box', x: 4, y: 1.25, width: 1, depth: 2.5, height: 1 },  // wall right: low half only
        { type: 'box', x: 8, y: 6.625, width: 1, depth: 2.75, height: 1 }, // wall right: upper half only
      ],
    });
    const grid = gridFor(env, 0.25, 0.02);
    const start = env.worldToCell(0.25, 7.75);
    const goal = env.worldToCell(11.75, 0.25);
    const dij = dijkstraSearch(grid, start, goal, { connectivity: 8 });
    const astar = astarSearch(grid, start, goal, { connectivity: 8, heuristicName: 'octile' });
    expect(astar.found).toBe(true);
    expect(dij.found).toBe(true);
    expect(astar.pathCost).toBeCloseTo(dij.pathCost, 6);
    expect(astar.nodesExpanded).toBeLessThan(dij.nodesExpanded);
    const goalCount = astar.visited.filter((n) => n.ix === goal.ix && n.iy === goal.iy).length;
    expect(goalCount).toBe(1);
  });

  it('reports goal_blocked when the goal cell is inflated into an obstacle', () => {
    const env = createEnvironment({
      width: 6, height: 6, cellSize: CS,
      obstacles: [{ type: 'cylinder', x: 5.5, y: 5.5, radius: 0.2, height: 1 }],
    });
    const grid = gridFor(env, 0.35, 0.1); // mask radius 0.45 > distance to obstacle
    const start = env.worldToCell(0.25, 0.25);
    const goal = env.worldToCell(5.75, 5.75);
    const r = dijkstraSearch(grid, start, goal, { connectivity: 4 });
    expect(r.reason).toBe('goal_blocked');
  });
});

describe('RRT sampling planner', () => {
  it('finds a collision-free feasibility route and is deterministic per seed', () => {
    const env = createEnvironment({
      width: 10, height: 8, cellSize: 1,
      obstacles: [{ type: 'box', x: 5, y: 4, width: 1.4, depth: 3.5, height: 1 }],
    });
    const collision = createCollisionWorld(env, { robotRadius: 0.3, safetyMargin: 0.05 });
    const opts = { stepSize: 0.6, goalBias: 0.05, maxIterations: 9000, goalRadius: 0.3, seed: 42 };
    const a = rrtSearch({ env, collision, start: { x: 0.4, y: 0.4 }, goal: { x: 9.4, y: 7.4 }, options: opts });
    const b = rrtSearch({ env, collision, start: { x: 0.4, y: 0.4 }, goal: { x: 9.4, y: 7.4 }, options: opts });
    expect(a.found).toBe(true);
    expect(b.found).toBe(true);
    expect(a.path).toEqual(b.path);
    // Collision-free: sampled 2 cm along each edge
    for (let i = 1; i < a.path.length; i += 1) {
      const chk = collision.segmentCheck(a.path[i - 1].x, a.path[i - 1].y, a.path[i].x, a.path[i].y, 0.3 + 0.05, 0.02);
      expect(chk.ok).toBe(true);
    }
    expect(a.metrics.samplesTaken).toBeGreaterThan(0);
  });

  it('returns no_path when the goal chamber is sealed', () => {
    const env = createEnvironment({
      width: 10, height: 8, cellSize: 1,
      obstacles: [{ type: 'box', x: 8.5, y: 4, width: 1.5, depth: 6.5, height: 1 }],
    });
    const collision = createCollisionWorld(env, { robotRadius: 0.3, safetyMargin: 0.05 });
    const r = rrtSearch({
      env, collision, start: { x: 0.5, y: 1 }, goal: { x: 9.2, y: 1 },
      options: { stepSize: 0.5, maxIterations: 4000, goalRadius: 0.25, seed: 3 },
    });
    expect(r.found).toBe(false);
    expect(r.reason).toBe('no_path');
  });
});

describe('Scenario execution and validation', () => {
  it('detects start / goal in obstacle before planning', () => {
    const env = { width: 8, height: 6, cellSize: CS, obstacles: [{ type: 'box', x: 2, y: 2, width: 1, depth: 1, height: 1 }] };
    const blockedStart = scenario(env, { startPose: { x: 2, y: 2, theta: 0 }, goalPose: { x: 6, y: 1, theta: null } });
    const r1 = executePlanRun(blockedStart, {}, 0);
    expect(r1.status).toBe('start_in_obstacle');

    const blockedGoal = scenario(env, { startPose: { x: 1, y: 1, theta: 0 }, goalPose: { x: 2, y: 2.4, theta: null } });
    const r2 = executePlanRun(blockedGoal, {}, 0);
    expect(r2.status).toBe('goal_in_obstacle');
  });

  it('validates that the computed path is collision-free with the real footprint', () => {
    const s = scenario({
      width: 10, height: 6, cellSize: CS,
      obstacles: [{ type: 'box', x: 5, y: 3, width: 1.5, depth: 4, height: 1 }], // wall: y 1..5, x 4.25..5.75
    }, { radius: 0.35, startPose: { x: 0.5, y: 0.5, theta: 0 }, goalPose: { x: 9, y: 0.75, theta: null } },
    { algorithm: 'astar', connectivity: 8, safetyMargin: 0.08, heuristic: 'octile' });
    const r = executePlanRun(s, {}, 0);
    expect(r.found).toBe(true);
    expect(r.validation.ok).toBe(true);
    expect(r.validation.minClearance).toBeGreaterThanOrEqual(0.34);
    expect(r.pathLength).toBeGreaterThan(0);
    expect(r.analysis.directLine.clear).toBe(false);
  });

  it('naive point-plan validation fails in a corridor narrower than the robot', () => {
    const gap = 0.72; // gap between the two blocking boxes
    const env = {
      width: 12, height: 8, cellSize: 0.5,
      obstacles: [
        { type: 'box', x: 6, y: 2.29, width: 1, depth: 3.58, height: 1 },
        { type: 'box', x: 6, y: 5.71, width: 1, depth: 3.58, height: 1 },
      ],
      weightZones: [],
    };
    const s = scenario(env, { radius: 0.35, startPose: { x: 0.4, y: 4, theta: 0 }, goalPose: { x: 11.6, y: 4, theta: null } }, { connectivity: 8, safetyMargin: 0.02, ignoreFootprint: true, algorithm: 'astar', heuristic: 'octile' });
    const r = executePlanRun(s, {}, 0);
    expect(r.found).toBe(true); // naive plan threads the gap
    expect(r.validation.ok).toBe(false); // but validation rejects it
    expect(r.validation.clearance).toBeLessThan(0.35);
    expect(r.analysis).toBeDefined();
  });

  it('with footprint inflation the same passage is masked and the goal is unreachable nearby', () => {
    const env = createEnvironment({
      width: 12, height: 8, cellSize: CS,
      obstacles: [
        { type: 'box', x: 6, y: 2.2, width: 1, depth: 3.6, height: 1 },
        { type: 'box', x: 6, y: 5.8, width: 1, depth: 3.6, height: 1 },
      ],
    });
    const s = scenario(envObToRaw(env), { radius: 0.35 }, { connectivity: 8, safetyMargin: 0.08, algorithm: 'astar' });
    s.robot.startPose = { x: 0.4, y: 4, theta: 0 };
    s.robot.goalPose = { x: 11.6, y: 4, theta: null };
    const r = executePlanRun(s, {}, 0);
    // the middle is blocked; there is no bypass -> unreachable is acceptable outcome
    if (r.found) {
      expect(r.validation.ok).toBe(true);
      expect(r.pathLength).toBeGreaterThan(15); // long way around
    } else {
      expect(['no_path', 'start_blocked']).toContain(r.reason);
    }
  });

  it('merged path keeps behavior deterministic under equal inputs', () => {
    const s = scenario({ width: 8, height: 6, cellSize: CS, obstacles: [{ type: 'cylinder', x: 4, y: 3, radius: 0.8, height: 1 }] });
    const a = executePlanRun(s, {}, 0);
    const b = executePlanRun(s, {}, 0);
    expect(a.path).toEqual(b.path);
    expect(a.nodesExpanded).toBe(b.nodesExpanded);
    expect(() => mergeCollinear([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).not.toThrow();
    expect(mergeCollinear([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toHaveLength(2);
  });

  it('resolveRunConfig auto-heuristics respect connectivity', () => {
    expect(resolveRunConfig(scenario({}), { planning: { heuristic: 'auto', connectivity: 4 } }).planning.heuristic).toBe('manhattan');
    expect(resolveRunConfig(scenario({}), { planning: { heuristic: 'auto', connectivity: 8 } }).planning.heuristic).toBe('octile');
    expect(resolveRunConfig(scenario({}), { planning: { heuristic: 'manhattan', connectivity: 8 } }).planning.heuristic).toBe('octile');
  });
});

function envObToRaw(env) {
  return { width: env.width, height: env.height, cellSize: env.cellSize, obstacles: env.obstacles, weightZones: env.weightZones };
}

