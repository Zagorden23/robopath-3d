import { describe, it, expect } from 'vitest';
import { executeMotionPlan } from '../../src/engine/planners/index.js';
import { compareAlgorithms } from '../../src/engine/comparison.js';
import { DEMO_SCENARIOS } from '../../src/engine/presets.js';

describe('Unified Motion Planner & Dispatcher', () => {
  const demoA = DEMO_SCENARIOS[0];

  it('successfully computes an A* path on Demo A', () => {
    const result = executeMotionPlan({
      environment: demoA.environment,
      robotConfig: demoA.robotConfig,
      algorithmConfig: { algorithm: 'ASTAR', allowDiagonal: true },
    });

    expect(result.success).toBe(true);
    expect(result.algorithm).toBe('ASTAR');
    expect(result.path.length).toBeGreaterThan(2);
    expect(result.pathValidation.isValid).toBe(true);
    expect(result.pathValidation.minClearance).toBeGreaterThanOrEqual(0);
    expect(result.nodesExpanded).toBeGreaterThan(0);
  });

  it('successfully computes a Dijkstra path on Demo A', () => {
    const result = executeMotionPlan({
      environment: demoA.environment,
      robotConfig: demoA.robotConfig,
      algorithmConfig: { algorithm: 'DIJKSTRA', allowDiagonal: true },
    });

    expect(result.success).toBe(true);
    expect(result.algorithm).toBe('DIJKSTRA');
    expect(result.path.length).toBeGreaterThan(2);
    expect(result.pathValidation.isValid).toBe(true);
  });

  it('successfully computes a BFS path on Demo A', () => {
    const result = executeMotionPlan({
      environment: demoA.environment,
      robotConfig: demoA.robotConfig,
      algorithmConfig: { algorithm: 'BFS', allowDiagonal: false },
    });

    expect(result.success).toBe(true);
    expect(result.algorithm).toBe('BFS');
    expect(result.path.length).toBeGreaterThan(2);
    expect(result.hopCount).toBeGreaterThan(0);
  });

  it('successfully executes RRT search on Demo A', () => {
    const result = executeMotionPlan({
      environment: demoA.environment,
      robotConfig: demoA.robotConfig,
      algorithmConfig: {
        algorithm: 'RRT',
        rrtMaxIterations: 1000,
        rrtStepSize: 1.2,
        rrtGoalBias: 0.2,
      },
    });

    expect(result.algorithm).toBe('RRT');
    expect(result.treeEdges.length).toBeGreaterThan(0);
    expect(result.nodesExpanded).toBeGreaterThan(0);
  });

  it('correctly catches blocked start configuration', () => {
    const blockedEnv = {
      ...demoA.environment,
      start: { x: -0.5, z: -1.0 }, // Directly inside Central Partition Wall
    };

    const result = executeMotionPlan({
      environment: blockedEnv,
      robotConfig: demoA.robotConfig,
      algorithmConfig: { algorithm: 'ASTAR' },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('START_BLOCKED');
    expect(result.endpointValidation.valid).toBe(false);
  });

  it('runs multi-algorithm comparison benchmark', () => {
    const comparison = compareAlgorithms({
      environment: demoA.environment,
      robotConfig: demoA.robotConfig,
      algorithms: ['BFS', 'DIJKSTRA', 'ASTAR'],
    });

    expect(comparison.results.length).toBe(3);
    const astar = comparison.results.find((r) => r.algorithm === 'ASTAR');
    const dijkstra = comparison.results.find((r) => r.algorithm === 'DIJKSTRA');

    expect(astar.success).toBe(true);
    expect(dijkstra.success).toBe(true);
    expect(astar.nodesExpanded).toBeLessThanOrEqual(dijkstra.nodesExpanded);
    expect(comparison.summaryNarrative).toBeTruthy();
  });
});
