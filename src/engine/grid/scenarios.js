/**
 * Predefined experimental scenarios.
 *
 * Every scenario is a plain grid environment state, so each one can be
 * edited, saved, exported and reloaded exactly like a user-built map.
 * `resetTo` stores the pristine configuration so a scenario can always be
 * restored to its original state.
 */

import {
  createEnvironmentState,
  generateMaze,
  generateRandomObstacles,
  setRegionBlocked,
} from './editor.js';

function base(rows, cols, cellSize = 0.5) {
  return createEnvironmentState({
    rows,
    cols,
    cellSize,
    start: { row: 1, col: 1 },
    goal: { row: rows - 2, col: cols - 2 },
    name: 'Scenario',
  });
}

function withObstacles(state, cells) {
  const next = { ...state, blocked: [...state.blocked] };
  for (const [row, col] of cells) {
    next.blocked[row * next.cols + col] = true;
  }
  next.blocked[next.start.row * next.cols + next.start.col] = false;
  next.blocked[next.goal.row * next.cols + next.goal.col] = false;
  return next;
}

/**
 * Wall the goal into a sealed one-cell chamber: every orthogonal neighbour
 * is blocked while the goal cell itself stays free. The goal is genuinely
 * unreachable without the goal cell ever being an obstacle.
 */
function sealGoalInChamber(state, goal) {
  const next = { ...state, blocked: [...state.blocked] };
  const walls = [
    [goal.row - 1, goal.col],
    [goal.row + 1, goal.col],
    [goal.row, goal.col - 1],
    [goal.row, goal.col + 1],
  ];
  for (const [row, col] of walls) {
    if (row < 0 || row >= next.rows || col < 0 || col >= next.cols) continue;
    next.blocked[row * next.cols + col] = true;
  }
  next.goal = { ...goal };
  next.blocked[goal.row * next.cols + goal.col] = false;
  next.blocked[next.start.row * next.cols + next.start.col] = false;
  return next;
}

/**
 * @typedef {object} ScenarioDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} difficulty
 * @property {object} environment
 * @property {object} resetTo    pristine environment for the "restore" action
 */

/** @type {ScenarioDefinition[]} */
export const SCENARIOS = [
  {
    id: 'empty',
    name: 'Empty Environment',
    description:
      'A completely open arena with no obstacles. Useful for verifying that a planner returns the direct route and for measuring baseline search effort.',
    difficulty: 'Baseline',
    environment: base(16, 16),
    resetTo: base(16, 16),
  },
  {
    id: 'random-obstacles',
    name: 'Random Obstacle Field',
    description:
      'A scattered field of obstacles at a moderate density. Routes exist but the planner must weave between blocked cells.',
    difficulty: 'Easy',
    environment: generateRandomObstacles(base(18, 18), 0.18, 4242),
    resetTo: generateRandomObstacles(base(18, 18), 0.18, 4242),
  },
  {
    id: 'maze',
    name: 'Maze Navigation',
    description:
      'A perfect maze generated with randomised depth-first search. Exactly one route connects the start to the goal.',
    difficulty: 'Medium',
    environment: generateMaze(base(21, 21), 99),
    resetTo: generateMaze(base(21, 21), 99),
  },
  {
    id: 'narrow-corridor',
    name: 'Narrow Corridor',
    description:
      'Two long walls leave a single one-cell-wide passage. Any planner that ignores corner-cutting or diagonal cost will fail to find it.',
    difficulty: 'Medium',
    environment: withObstacles(base(16, 20), [
      ...Array.from({ length: 13 }, (_, i) => [3 + i, 6]),
      ...Array.from({ length: 13 }, (_, i) => [3 + i, 13]),
    ]),
    resetTo: withObstacles(base(16, 20), [
      ...Array.from({ length: 13 }, (_, i) => [3 + i, 6]),
      ...Array.from({ length: 13 }, (_, i) => [3 + i, 13]),
    ]),
  },
  {
    id: 'dense-obstacles',
    name: 'Dense Obstacle Environment',
    description:
      'A heavily obstructed arena. Only a careful route survives, and sampling planners may struggle to connect within their iteration budget.',
    difficulty: 'Hard',
    environment: generateRandomObstacles(base(20, 20), 0.35, 31337),
    resetTo: generateRandomObstacles(base(20, 20), 0.35, 31337),
  },
  {
    id: 'multiple-routes',
    name: 'Multiple Possible Routes',
    description:
      'Three separated corridors of differing length connect the start to the goal. Cost-aware planners pick the cheapest; BFS picks the fewest steps.',
    difficulty: 'Medium',
    environment: withObstacles(base(18, 22), [
      // Vertical wall with a gap at the top.
      ...Array.from({ length: 15 }, (_, i) => [1 + i, 7]),
      // Vertical wall with a gap in the middle.
      ...Array.from({ length: 7 }, (_, i) => [1 + i, 14]),
      ...Array.from({ length: 7 }, (_, i) => [10 + i, 14]),
    ]),
    resetTo: withObstacles(base(18, 22), [
      ...Array.from({ length: 15 }, (_, i) => [1 + i, 7]),
      ...Array.from({ length: 7 }, (_, i) => [1 + i, 14]),
      ...Array.from({ length: 7 }, (_, i) => [10 + i, 14]),
    ]),
  },
  {
    id: 'unreachable-goal',
    name: 'Unreachable Goal',
    description:
      'The goal sits inside a fully sealed one-cell chamber. Exhaustive planners will prove no route exists; sampling planners will only report that their iteration budget ran out.',
    difficulty: 'Diagnostic',
    environment: sealGoalInChamber(base(16, 16), { row: 12, col: 12 }),
    resetTo: sealGoalInChamber(base(16, 16), { row: 12, col: 12 }),
  },
  {
    id: 'dynamic-obstacles',
    name: 'Dynamic Obstacle Environment',
    description:
      'An open field with a moving barrier sweeping across the middle. Run the plan, then activate dynamic obstacles to watch the route being invalidated and replanned.',
    difficulty: 'Advanced',
    environment: base(16, 20),
    resetTo: base(16, 20),
  },
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

/**
 * Materialise a scenario into a fresh editable environment state.
 */
export function instantiateScenario(id) {
  const scenario = getScenario(id);
  if (!scenario) return null;
  return {
    ...createEnvironmentState(scenario.environment),
    name: scenario.name,
    scenarioId: scenario.id,
  };
}
