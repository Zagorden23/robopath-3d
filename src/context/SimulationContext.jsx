import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  buildOccupancyGrid,
  runPlanner,
  PLANNER_IDS,
  PLANNER_REGISTRY,
  HEURISTIC_LABELS,
  createEnvironmentState,
  setCellBlocked,
  setRegionBlocked,
  clearObstacles,
  generateRandomObstacles,
  generateMaze,
  setStart,
  setGoal,
  swapEndpoints,
  randomizeEndpoints,
  resizeEnvironment,
  createHistory,
  commit,
  undo,
  redo,
} from '../engine/grid/index.js';
import { SCENARIOS, instantiateScenario } from '../engine/grid/scenarios.js';
import { resultsApi, scenariosApi } from '../services/api.js';

const STORAGE_KEY = 'robopath_unified_sim_state_v2';

// Map the 3D demonstration preset IDs onto the canonical grid scenarios.
// The IDs on the left are the real `DEMO_SCENARIOS` ids in engine/presets.js,
// and the IDs on the right are the real scenario ids in engine/grid/scenarios.js.
// An unknown id falls through unchanged and is then looked up in the scenario
// registry, so a stale link resolves to nothing instead of throwing.
const DEMO_TO_SCENARIO_MAP = {
  'demo-a-dijkstra-vs-astar': 'random-obstacles',
  'demo-b-bfs-vs-dijkstra': 'multiple-routes',
  'demo-c-rrt-continuous': 'narrow-corridor',
  'demo-d-feasibility': 'unreachable-goal',
  'demo-e-motion-constraints': 'dense-obstacles',
};

/**
 * Convert grid cell coordinates (row, col) to 3D world coordinates (x, z)
 * so that top-down 3D matches the 2D grid orientation (row 0 = North/-Z, col 0 = West/-X).
 */
export function cellToWorld(row, col, rows, cols, cellSize = 0.75) {
  const x = (col - (cols - 1) / 2) * cellSize;
  const z = (row - (rows - 1) / 2) * cellSize;
  return { x, z };
}

/**
 * Convert 3D world coordinates (x, z) back to nearest grid cell (row, col).
 */
export function worldToCell(x, z, rows, cols, cellSize = 0.75) {
  const col = Math.round(x / cellSize + (cols - 1) / 2);
  const row = Math.round(z / cellSize + (rows - 1) / 2);
  return {
    row: Math.max(0, Math.min(rows - 1, row)),
    col: Math.max(0, Math.min(cols - 1, col)),
  };
}

const ALGORITHM_FORMULAS = {
  BFS: {
    title: 'Breadth-First Search (FIFO Layer Expansion)',
    latex: 'd(v) = d(u) + 1,\\quad Q_{\\text{FIFO}} \\leftarrow \\text{neighbors}(u)',
    summary:
      'Explores unweighted grid cells level-by-level in concentric wavefronts. Guarantees minimum hop count without using a distance heuristic.',
  },
  DIJKSTRA: {
    title: "Dijkstra's Uniform-Cost Search",
    latex: 'g(v) = \\min\\big(g(v),\\; g(u) + c(u, v)\\big)',
    summary:
      'Expands the lowest cumulative traversal cost g(n) from the priority queue. Guarantees the shortest path across 4-dir and 8-dir movements.',
  },
  ASTAR: {
    title: 'A* (A-Star) Heuristic Search',
    latex: 'f(n) = g(n) + h(n)',
    summary:
      'Balances accumulated path cost g(n) with an admissible goal heuristic h(n) to focus expansion toward the goal while preserving optimality.',
  },
  GREEDY: {
    title: 'Greedy Best-First Search',
    latex: 'f(n) = h(n)',
    summary:
      'Prioritizes frontier states strictly by estimated heuristic distance h(n) to the goal for rapid directional search.',
  },
  RRT: {
    title: 'Rapidly-Exploring Random Tree (RRT)',
    latex: 'q_{\\text{new}} = q_{\\text{near}} + \\eta \\frac{q_{\\text{rand}} - q_{\\text{near}}}{\\|q_{\\text{rand}} - q_{\\text{near}}\\|}',
    summary:
      'Incrementally grows a space-filling tree by sampling random coordinates and extending collision-free branches toward unexplored space.',
  },
  RRT_STAR: {
    title: 'Asymptotically Optimal RRT* (Rewiring)',
    latex: 'c(q_{\\text{new}}) = \\min_{q \\in X_{\\text{near}}} \\big(c(q) + \\|q - q_{\\text{new}}\\|_2\\big)',
    summary:
      'Selects the lowest-cost parent within a local neighborhood radius and rewires existing tree branches to converge toward shorter paths.',
  },
};

const SimulationContext = createContext(null);

function loadInitialSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.env &&
      Number.isInteger(parsed.env.rows) &&
      Number.isInteger(parsed.env.cols) &&
      Array.isArray(parsed.env.blocked) &&
      parsed.env.blocked.length === parsed.env.rows * parsed.env.cols
    ) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function SimulationProvider({ children }) {
  const saved = useMemo(() => loadInitialSavedState(), []);

  const [scenarioId, setScenarioId] = useState(saved?.scenarioId || 'random-obstacles');
  const [history, setHistory] = useState(() => {
    const initialEnv =
      saved?.env ||
      instantiateScenario('random-obstacles') ||
      createEnvironmentState({ rows: 18, cols: 22, cellSize: 0.75 });
    return createHistory({ ...initialEnv, cellSize: initialEnv.cellSize || 0.75 });
  });

  const env = history.present;

  // Shared editor & planner state
  const [activeTool, setActiveTool] = useState('draw'); // 'draw' | 'erase' | 'region' | 'start' | 'goal' | 'navigate'
  const [regionStart, setRegionStart] = useState(null);
  const [selectedPlanner, setSelectedPlanner] = useState(saved?.selectedPlanner || 'ASTAR');
  const [heuristic, setHeuristic] = useState(saved?.heuristic || 'octile');
  const [connectivity, setConnectivity] = useState(saved?.connectivity || 8);
  const [randomDensity, setRandomDensity] = useState(saved?.randomDensity || 0.22);
  const [seed, setSeed] = useState(saved?.seed || 42);

  // Dynamic obstacle state
  const [dynamicActive, setDynamicActive] = useState(false);
  const [dynamicObstacleCell, setDynamicObstacleCell] = useState(null);
  const [replanCount, setReplanCount] = useState(0);

  // 3D Scene & Visual settings
  const [cameraMode, setCameraMode] = useState('isometric');
  const [wallHeight, setWallHeight] = useState(saved?.wallHeight || 0.85);
  const [surfaceTheme, setSurfaceTheme] = useState(saved?.surfaceTheme || 'lemon-ivory');
  const [robotModel, setRobotModel] = useState('differential');
  const [toggles, setToggles] = useState({
    showGrid: true,
    showObstacles: true,
    showPath: true,
    showExplored: true,
    showFrontier: true,
    showTree: true,
    showWaypoints: true,
    showAxes: false,
  });

  // Playback & results state
  const [planResult, setPlanResult] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [searchProgress, setSearchProgress] = useState(1); // 0..1
  const [robotProgress, setRobotProgress] = useState(0); // 0..1 continuous along path
  const [saveFeedback, setSaveFeedback] = useState('');

  const plannerMeta = PLANNER_REGISTRY[selectedPlanner] || PLANNER_REGISTRY.ASTAR;

  // Persist synchronized state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scenarioId,
          env,
          selectedPlanner,
          heuristic,
          connectivity,
          randomDensity,
          seed,
          wallHeight,
          surfaceTheme,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    scenarioId,
    env,
    selectedPlanner,
    heuristic,
    connectivity,
    randomDensity,
    seed,
    wallHeight,
    surfaceTheme,
  ]);

  const applyEnvChange = useCallback((nextEnv) => {
    const normalized = { ...nextEnv, cellSize: nextEnv.cellSize || 0.75 };
    setHistory((prev) => commit(prev, normalized));
  }, []);

  const executePlan = useCallback(
    (targetEnv = env, isReplan = false, overridePlanner = null) => {
      try {
        const activePlannerId = overridePlanner || selectedPlanner;
        const meta = PLANNER_REGISTRY[activePlannerId] || PLANNER_REGISTRY.ASTAR;
        const grid = buildOccupancyGrid(targetEnv);
        const res = runPlanner({
          grid,
          planner: activePlannerId,
          options: {
            connectivity: meta.supportsMovementMode ? connectivity : 8,
            heuristic: meta.supportsHeuristic ? heuristic : 'none',
            seed,
            maxIterations: activePlannerId.startsWith('RRT') ? 5500 : 200000,
          },
        });

        setPlanResult(res);
        setSearchProgress(0);
        setRobotProgress(0);
        setIsPlaying(true);

        resultsApi.record({
          scenarioId: targetEnv.scenarioId || scenarioId || 'custom-arena',
          scenarioName: targetEnv.name || 'Unified Robotics Arena',
          planner: activePlannerId,
          heuristic: meta.supportsHeuristic ? heuristic : 'none',
          movementMode: meta.supportsMovementMode ? `${connectivity}-dir` : 'continuous',
          pathFound: Boolean(res.pathFound),
          resultStatus: res.status || (res.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
          pathLength: Number(((res.pathLength || 0) * (targetEnv.cellSize || 0.75)).toFixed(3)),
          pathCost: Number((res.pathCost || 0).toFixed(3)),
          nodesExpanded: res.nodesExpanded || 0,
          nodesGenerated: res.nodesGenerated || 0,
          planningTimeMs: Number((res.planningTimeMs || 0).toFixed(3)),
        });

        if (isReplan) {
          setReplanCount((c) => c + 1);
        }
        return res;
      } catch (err) {
        console.error('Unified Planner execution error:', err);
        return null;
      }
    },
    [env, selectedPlanner, connectivity, heuristic, seed, scenarioId]
  );

  // Re-run planner automatically when algorithm, heuristic, connectivity, or scenario changes
  useEffect(() => {
    executePlan(env, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanner, heuristic, connectivity]);

  // Progressive animation loop (search wavefront first, then robot navigation)
  useEffect(() => {
    if (!isPlaying || !planResult) return undefined;

    const intervalMs = 30;
    const timer = setInterval(() => {
      setSearchProgress((prevSearch) => {
        if (prevSearch < 1) {
          const nextSearch = Math.min(1, prevSearch + 0.045 * playbackSpeed);
          return nextSearch;
        }
        // Once search wavefront reaches 100%, advance robot along path
        setRobotProgress((prevRobot) => {
          const pathLen = planResult.path?.length || 0;
          if (pathLen <= 1) {
            setIsPlaying(false);
            return 0;
          }
          const stepDelta = (0.45 * playbackSpeed) / Math.max(1, pathLen - 1);
          const nextRobot = prevRobot + stepDelta;
          if (nextRobot >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return nextRobot;
        });
        return 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, planResult, playbackSpeed]);

  // Dynamic moving obstacle sweep
  useEffect(() => {
    if (!dynamicActive) {
      setDynamicObstacleCell(null);
      return undefined;
    }

    let step = 2;
    let dir = 1;
    const midRow = Math.floor(env.rows / 2);

    const timer = setInterval(() => {
      step += dir;
      if (step >= env.cols - 3) dir = -1;
      if (step <= 2) dir = 1;

      const candidate = { row: midRow, col: step };
      if (
        (candidate.row === env.start.row && candidate.col === env.start.col) ||
        (candidate.row === env.goal.row && candidate.col === env.goal.col)
      ) {
        return;
      }

      setDynamicObstacleCell(candidate);

      if (planResult?.pathFound && Array.isArray(planResult.path)) {
        const hitsPath = planResult.path.some(
          (p) => Math.round(p.row) === candidate.row && Math.round(p.col) === candidate.col
        );
        if (hitsPath) {
          const tempEnv = setCellBlocked(env, candidate.row, candidate.col, true);
          executePlan(tempEnv, true);
        }
      }
    }, 700);

    return () => clearInterval(timer);
  }, [dynamicActive, env, planResult, executePlan]);

  // Interactive cell editing handler (used by both 2D grid cells and 3D floor raycast)
  const interactWithCell = useCallback(
    (row, col, isClick = false, autoRun = true) => {
      if (row < 0 || row >= env.rows || col < 0 || col >= env.cols) return;
      let nextEnv = null;

      if (activeTool === 'draw') {
        nextEnv = setCellBlocked(env, row, col, true);
      } else if (activeTool === 'erase') {
        nextEnv = setCellBlocked(env, row, col, false);
      } else if (activeTool === 'start' && isClick) {
        nextEnv = setStart(env, row, col);
      } else if (activeTool === 'goal' && isClick) {
        nextEnv = setGoal(env, row, col);
      } else if (activeTool === 'region' && isClick) {
        if (!regionStart) {
          setRegionStart({ row, col });
          return;
        }
        nextEnv = setRegionBlocked(env, regionStart.row, regionStart.col, row, col, true);
        setRegionStart(null);
      }

      if (nextEnv && nextEnv !== env) {
        applyEnvChange(nextEnv);
        if (autoRun && isClick && (activeTool === 'start' || activeTool === 'goal' || activeTool === 'region')) {
          executePlan(nextEnv, false);
        }
      }
    },
    [activeTool, env, regionStart, applyEnvChange, executePlan]
  );

  const selectScenario = useCallback(
    (rawId) => {
      const resolvedId = DEMO_TO_SCENARIO_MAP[rawId] || rawId;
      const nextEnv = instantiateScenario(resolvedId);
      if (nextEnv) {
        const normalized = { ...nextEnv, cellSize: nextEnv.cellSize || 0.75 };
        setScenarioId(resolvedId);
        setHistory(createHistory(normalized));
        setDynamicActive(resolvedId === 'dynamic-obstacles');
        setReplanCount(0);
        executePlan(normalized, false);
      }
    },
    [executePlan]
  );

  const loadCustomEnvironment = useCallback(
    (gridState, algorithmConfig = null) => {
      if (!gridState || !gridState.rows || !gridState.cols) return;
      const normalized = {
        ...gridState,
        cellSize: gridState.cellSize || 0.75,
      };
      setScenarioId(gridState.scenarioId || 'custom');
      setHistory(createHistory(normalized));
      if (algorithmConfig?.algorithm && PLANNER_IDS.includes(algorithmConfig.algorithm)) {
        setSelectedPlanner(algorithmConfig.algorithm);
      }
      executePlan(normalized, false, algorithmConfig?.algorithm);
    },
    [executePlan]
  );

  const undoEnv = useCallback(() => {
    setHistory((h) => {
      const next = undo(h);
      return next;
    });
  }, []);

  const redoEnv = useCallback(() => {
    setHistory((h) => {
      const next = redo(h);
      return next;
    });
  }, []);

  const resizeGrid = useCallback(
    (rows, cols) => {
      const next = resizeEnvironment(env, rows, cols);
      applyEnvChange(next);
      executePlan(next, false);
    },
    [env, applyEnvChange, executePlan]
  );

  const generateMazeEnv = useCallback(() => {
    const next = generateMaze(env, Date.now() % 10000);
    applyEnvChange(next);
    executePlan(next, false);
  }, [env, applyEnvChange, executePlan]);

  const generateRandomWalls = useCallback(
    (density = randomDensity) => {
      const next = generateRandomObstacles(clearObstacles(env), density, Date.now() % 10000);
      applyEnvChange(next);
      executePlan(next, false);
    },
    [env, randomDensity, applyEnvChange, executePlan]
  );

  const clearAllWalls = useCallback(() => {
    const next = clearObstacles(env);
    applyEnvChange(next);
    executePlan(next, false);
  }, [env, applyEnvChange, executePlan]);

  const swapStartGoal = useCallback(() => {
    const next = swapEndpoints(env);
    applyEnvChange(next);
    executePlan(next, false);
  }, [env, applyEnvChange, executePlan]);

  const randomizeStartGoal = useCallback(() => {
    const next = randomizeEndpoints(env, Date.now() % 10000);
    applyEnvChange(next);
    executePlan(next, false);
  }, [env, applyEnvChange, executePlan]);

  const saveCurrentEnvironment = useCallback(async () => {
    try {
      await scenariosApi.create({
        name: `${env.name || 'Unified Robotics Arena'} (${env.rows}×${env.cols})`,
        description: `Synchronized 2D/3D Arena saved with ${selectedPlanner}`,
        gridState: env,
        algorithmConfig: {
          algorithm: selectedPlanner,
          heuristic: plannerMeta.supportsHeuristic ? heuristic.toLowerCase() : 'none',
          allowDiagonal: connectivity === 8,
        },
      });
      setSaveFeedback('Environment saved to workspace!');
      setTimeout(() => setSaveFeedback(''), 3200);
    } catch {
      setSaveFeedback('Saved to local workspace.');
      setTimeout(() => setSaveFeedback(''), 3200);
    }
  }, [env, selectedPlanner, plannerMeta, heuristic, connectivity]);

  // Derived discrete step index for 2D cell highlight
  const robotStepIndex = useMemo(() => {
    const len = planResult?.path?.length || 0;
    if (len <= 1) return 0;
    return Math.min(len - 1, Math.round(robotProgress * (len - 1)));
  }, [planResult, robotProgress]);

  const setRobotStepIndex = useCallback(
    (idxOrUpdater) => {
      const len = planResult?.path?.length || 1;
      const currentIdx = Math.min(len - 1, Math.round(robotProgress * Math.max(1, len - 1)));
      const nextIdx = typeof idxOrUpdater === 'function' ? idxOrUpdater(currentIdx) : idxOrUpdater;
      const clamped = Math.max(0, Math.min(len - 1, nextIdx));
      setRobotProgress(len > 1 ? clamped / (len - 1) : 0);
    },
    [planResult, robotProgress]
  );

  // Derived 3D world coordinates for path, visited, frontier, tree, and robot pose
  const cellSize = env.cellSize || 0.75;

  const worldStart = useMemo(
    () => cellToWorld(env.start.row, env.start.col, env.rows, env.cols, cellSize),
    [env.start, env.rows, env.cols, cellSize]
  );

  const worldGoal = useMemo(
    () => cellToWorld(env.goal.row, env.goal.col, env.rows, env.cols, cellSize),
    [env.goal, env.rows, env.cols, cellSize]
  );

  const worldPath = useMemo(() => {
    if (!planResult?.path || planResult.path.length === 0) return [];
    return planResult.path.map((pt) => ({
      ...cellToWorld(pt.row, pt.col, env.rows, env.cols, cellSize),
      row: pt.row,
      col: pt.col,
    }));
  }, [planResult, env.rows, env.cols, cellSize]);

  const visibleVisitedWorld = useMemo(() => {
    if (!planResult?.visited || planResult.visited.length === 0) return [];
    const count = Math.ceil(planResult.visited.length * searchProgress);
    const slice = planResult.visited.slice(0, count);
    return slice.map((c) => ({
      ...cellToWorld(c.row, c.col, env.rows, env.cols, cellSize),
      row: c.row,
      col: c.col,
    }));
  }, [planResult, searchProgress, env.rows, env.cols, cellSize]);

  const visibleTreeWorld = useMemo(() => {
    if (!planResult?.tree || planResult.tree.length === 0) return [];
    const count = Math.ceil(planResult.tree.length * searchProgress);
    return planResult.tree.slice(0, count).map((edge) => {
      const from = cellToWorld(edge.fromRow, edge.fromCol, env.rows, env.cols, cellSize);
      const to = cellToWorld(edge.toRow, edge.toCol, env.rows, env.cols, cellSize);
      return {
        fromX: from.x,
        fromZ: from.z,
        toX: to.x,
        toZ: to.z,
      };
    });
  }, [planResult, searchProgress, env.rows, env.cols, cellSize]);

  // Smoothly interpolated 3D Robot Pose along worldPath
  const robotPose3D = useMemo(() => {
    if (!worldPath || worldPath.length === 0) {
      return {
        x: worldStart.x,
        z: worldStart.z,
        theta: 0,
        v: 0,
        row: env.start.row,
        col: env.start.col,
      };
    }
    if (worldPath.length === 1) {
      return {
        x: worldPath[0].x,
        z: worldPath[0].z,
        theta: 0,
        v: 0,
        row: worldPath[0].row,
        col: worldPath[0].col,
      };
    }

    const scaled = robotProgress * (worldPath.length - 1);
    const idx = Math.min(worldPath.length - 2, Math.floor(scaled));
    const frac = scaled - idx;
    const p1 = worldPath[idx];
    const p2 = worldPath[idx + 1];
    const x = p1.x + (p2.x - p1.x) * frac;
    const z = p1.z + (p2.z - p1.z) * frac;
    const theta = Math.atan2(p2.z - p1.z, p2.x - p1.x);

    return {
      x,
      z,
      theta,
      v: isPlaying && searchProgress >= 1 ? 1.2 * playbackSpeed : 0,
      row: p1.row + (p2.row - p1.row) * frac,
      col: p1.col + (p2.col - p1.col) * frac,
    };
  }, [worldPath, worldStart, robotProgress, isPlaying, searchProgress, playbackSpeed, env.start]);

  // Synchronized educational explanation & mathematical telemetry
  const currentExplanation = useMemo(() => {
    const formulaInfo = ALGORITHM_FORMULAS[selectedPlanner] || ALGORITHM_FORMULAS.ASTAR;
    const totalVisited = planResult?.visited?.length || 0;
    const expandedSoFar = Math.min(totalVisited, Math.ceil(totalVisited * searchProgress));
    const pathLenMeters = ((planResult?.pathLength || 0) * cellSize).toFixed(2);
    const gVal = (robotProgress * (planResult?.pathCost || 0)).toFixed(2);
    const hVal = Math.hypot(
      env.goal.row - (robotPose3D.row ?? env.start.row),
      env.goal.col - (robotPose3D.col ?? env.start.col)
    ).toFixed(2);
    const fVal = (Number(gVal) + (plannerMeta.supportsHeuristic ? Number(hVal) : 0)).toFixed(2);

    let phaseTitle = 'Ready to Plan';
    let narration = formulaInfo.summary;

    if (planResult) {
      if (searchProgress < 1) {
        phaseTitle = `Search Expansion (${Math.round(searchProgress * 100)}%)`;
        narration = `${plannerMeta.label} has evaluated ${expandedSoFar} of ${totalVisited} states from (${env.start.row}, ${env.start.col}) toward (${env.goal.row}, ${env.goal.col}).`;
      } else if (!planResult.pathFound) {
        phaseTitle = planResult.status || 'No Collision-Free Path';
        narration =
          planResult.reason ||
          'All reachable configurations were exhausted without connecting Start to Goal.';
      } else if (robotProgress < 1) {
        phaseTitle = `Robot Trajectory Execution (${Math.round(robotProgress * 100)}%)`;
        narration = `Following verified ${planResult.path.length}-waypoint path (${pathLenMeters} m). Current grid cell: (${Math.round(robotPose3D.row)}, ${Math.round(robotPose3D.col)}).`;
      } else {
        phaseTitle = 'Goal Reached — Navigation Complete';
        narration = `Robot arrived at Goal (${env.goal.row}, ${env.goal.col}). Total length: ${pathLenMeters} m across ${planResult.nodesExpanded} expanded states in ${planResult.planningTimeMs.toFixed(2)} ms.`;
      }
    }

    return {
      ...formulaInfo,
      phaseTitle,
      narration,
      expandedSoFar,
      totalVisited,
      gVal,
      hVal,
      fVal,
      pathLenMeters,
    };
  }, [
    selectedPlanner,
    planResult,
    searchProgress,
    robotProgress,
    cellSize,
    env.start,
    env.goal,
    robotPose3D,
    plannerMeta,
  ]);

  // Export CSV of current run metrics + path waypoints
  const exportCurrentTelemetryCsv = useCallback(() => {
    if (!planResult) return;
    const headers = [
      'Scenario',
      'GridSize',
      'Planner',
      'Heuristic',
      'MovementMode',
      'Status',
      'PathLengthMeters',
      'PathCost',
      'StatesExpanded',
      'PlanningTimeMs',
      'Waypoints',
    ];
    const row = [
      `"${(env.name || scenarioId).replace(/"/g, '""')}"`,
      `${env.rows}x${env.cols}`,
      selectedPlanner,
      plannerMeta.supportsHeuristic ? heuristic : 'none',
      plannerMeta.supportsMovementMode ? `${connectivity}-dir` : 'continuous',
      planResult.status || (planResult.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
      ((planResult.pathLength || 0) * cellSize).toFixed(3),
      (planResult.pathCost || 0).toFixed(3),
      planResult.nodesExpanded || 0,
      (planResult.planningTimeMs || 0).toFixed(3),
      planResult.path?.length || 0,
    ];

    const waypointLines = ['\nWaypointIndex,Row,Col,WorldX,WorldZ'];
    worldPath.forEach((pt, idx) => {
      waypointLines.push(`${idx},${pt.row.toFixed(2)},${pt.col.toFixed(2)},${pt.x.toFixed(3)},${pt.z.toFixed(3)}`);
    });

    const csvContent = [headers.join(','), row.join(','), ...waypointLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robopath-${selectedPlanner.toLowerCase()}-${env.rows}x${env.cols}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [planResult, env, scenarioId, selectedPlanner, plannerMeta, heuristic, connectivity, cellSize, worldPath]);

  const exportCurrentTelemetryJson = useCallback(() => {
    if (!planResult) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      scenario: {
        id: scenarioId,
        name: env.name,
        rows: env.rows,
        cols: env.cols,
        cellSize,
        start: env.start,
        goal: env.goal,
      },
      plannerConfig: {
        planner: selectedPlanner,
        heuristic: plannerMeta.supportsHeuristic ? heuristic : 'none',
        movementMode: plannerMeta.supportsMovementMode ? `${connectivity}-dir` : 'continuous',
      },
      telemetry: {
        status: planResult.status,
        pathFound: planResult.pathFound,
        pathLengthCells: planResult.pathLength,
        pathLengthMeters: Number(((planResult.pathLength || 0) * cellSize).toFixed(3)),
        pathCost: planResult.pathCost,
        nodesExpanded: planResult.nodesExpanded,
        nodesGenerated: planResult.nodesGenerated,
        planningTimeMs: planResult.planningTimeMs,
      },
      waypoints: worldPath,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robopath-${selectedPlanner.toLowerCase()}-${env.rows}x${env.cols}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [planResult, scenarioId, env, cellSize, selectedPlanner, plannerMeta, heuristic, connectivity, worldPath]);

  const value = {
    env,
    history,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoEnv,
    redoEnv,
    scenarioId,
    selectScenario,
    loadCustomEnvironment,
    applyEnvChange,
    interactWithCell,
    resizeGrid,
    generateMazeEnv,
    generateRandomWalls,
    clearAllWalls,
    swapStartGoal,
    randomizeStartGoal,
    saveCurrentEnvironment,
    saveFeedback,
    activeTool,
    setActiveTool,
    regionStart,
    setRegionStart,
    selectedPlanner,
    setSelectedPlanner,
    heuristic,
    setHeuristic,
    connectivity,
    setConnectivity,
    randomDensity,
    setRandomDensity,
    seed,
    setSeed,
    plannerMeta,
    dynamicActive,
    setDynamicActive,
    dynamicObstacleCell,
    replanCount,
    cameraMode,
    setCameraMode,
    wallHeight,
    setWallHeight,
    surfaceTheme,
    setSurfaceTheme,
    robotModel,
    setRobotModel,
    toggles,
    setToggles,
    planResult,
    executePlan,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    searchProgress,
    setSearchProgress,
    robotProgress,
    setRobotProgress,
    robotStepIndex,
    setRobotStepIndex,
    worldStart,
    worldGoal,
    worldPath,
    visibleVisitedWorld,
    visibleTreeWorld,
    robotPose3D,
    currentExplanation,
    exportCurrentTelemetryCsv,
    exportCurrentTelemetryJson,
    SCENARIOS,
    PLANNER_IDS,
    PLANNER_REGISTRY,
    HEURISTIC_LABELS,
  };

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used inside a SimulationProvider');
  }
  return ctx;
}
