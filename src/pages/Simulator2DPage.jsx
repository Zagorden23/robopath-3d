import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext.jsx';
import KatexMath from '../components/common/KatexMath.jsx';
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
  Shuffle,
  Grid as GridIcon,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Save,
  Sliders,
  ArrowLeftRight,
  Zap,
  StepForward,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';

export function Simulator2DPage() {
  const [searchParams] = useSearchParams();
  const [isDragging, setIsDragging] = useState(false);

  const {
    env,
    canUndo,
    canRedo,
    undoEnv,
    redoEnv,
    scenarioId,
    selectScenario,
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
    setRegionStart,
    selectedPlanner,
    setSelectedPlanner,
    heuristic,
    setHeuristic,
    connectivity,
    setConnectivity,
    randomDensity,
    setRandomDensity,
    plannerMeta,
    dynamicActive,
    setDynamicActive,
    dynamicObstacleCell,
    replanCount,
    planResult,
    executePlan,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    searchProgress,
    setSearchProgress,
    setRobotProgress,
    robotStepIndex,
    setRobotStepIndex,
    currentExplanation,
    exportCurrentTelemetryCsv,
    exportCurrentTelemetryJson,
    SCENARIOS,
    PLANNER_IDS,
    PLANNER_REGISTRY,
    HEURISTIC_LABELS,
  } = useSimulation();

  // If activeTool was 'navigate' from 3D view, default to 'draw' on 2D grid
  useEffect(() => {
    if (activeTool === 'navigate') {
      setActiveTool('draw');
    }
    const qScenario = searchParams.get('scenario');
    if (qScenario && qScenario !== scenarioId) {
      selectScenario(qScenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build fast lookup sets for rendering visited, frontier, and path cells
  const visitedSet = useMemo(() => {
    const set = new Set();
    if (!planResult?.visited) return set;
    const count = Math.ceil(planResult.visited.length * searchProgress);
    for (let i = 0; i < count; i++) {
      const cell = planResult.visited[i];
      if (cell) set.add(`${Math.round(cell.row)},${Math.round(cell.col)}`);
    }
    return set;
  }, [planResult, searchProgress]);

  const frontierSet = useMemo(() => {
    const set = new Set();
    if (!planResult?.frontier) return set;
    for (const cell of planResult.frontier) {
      if (cell) set.add(`${Math.round(cell.row)},${Math.round(cell.col)}`);
    }
    return set;
  }, [planResult]);

  const pathSet = useMemo(() => {
    const set = new Set();
    if (!planResult?.path) return set;
    for (const cell of planResult.path) {
      if (cell) set.add(`${Math.round(cell.row)},${Math.round(cell.col)}`);
    }
    return set;
  }, [planResult]);

  const currentRobotCell = useMemo(() => {
    if (!planResult?.path || planResult.path.length === 0) return env.start;
    const idx = Math.min(robotStepIndex, planResult.path.length - 1);
    return planResult.path[idx] || env.start;
  }, [planResult, robotStepIndex, env.start]);

  const cellSize = env.cellSize || 0.75;
  const pathLengthMeters = ((planResult?.pathLength || 0) * cellSize).toFixed(2);

  return (
    <div className="flex-1 container px-4 md:px-6 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl glass-panel-elevated border border-[var(--border-medium)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan text-[10px]">
              2D Occupancy Grid • Synchronized with 3D Lab
            </span>
            <span className="text-xs text-[#52677c] font-mono">
              {env.rows} × {env.cols} Cells ({cellSize}m resolution)
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#0f1e36]">
            Interactive 2D Robot Motion Planning Lab
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveFeedback && (
            <span className="text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md font-mono">
              {saveFeedback}
            </span>
          )}
          <button
            type="button"
            onClick={saveCurrentEnvironment}
            className="btn btn-secondary btn-sm text-xs"
          >
            <Save className="w-3.5 h-3.5 text-teal-700" />
            <span>Save Environment</span>
          </button>
          <button
            type="button"
            onClick={exportCurrentTelemetryCsv}
            className="btn btn-secondary btn-sm text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={exportCurrentTelemetryJson}
            className="btn btn-secondary btn-sm text-xs"
          >
            <FileJson className="w-3.5 h-3.5 text-sky-700" />
            <span>Export JSON</span>
          </button>

          <Link
            to="/simulator"
            className="btn btn-primary btn-sm text-xs"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>View Same Arena in 3D Simulator</span>
          </Link>
        </div>
      </div>

      {/* Main 3-Column 2D Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Environment & Planner Controls */}
        <div className="lg:col-span-3 space-y-4">
          {/* Scenario Selector */}
          <div className="p-4 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-3 text-xs">
            <h3 className="font-heading font-bold text-[#0f1e36] text-sm flex items-center gap-2">
              <GridIcon className="w-4 h-4 text-teal-700" />
              <span>Predefined Scenarios (8)</span>
            </h3>
            <select
              value={scenarioId}
              onChange={(e) => selectScenario(e.target.value)}
              className="w-full text-xs font-mono"
            >
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} ({sc.difficulty})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-[#52677c] mb-1">
                  Rows ({env.rows})
                </label>
                <input
                  type="range"
                  min={8}
                  max={36}
                  value={env.rows}
                  onChange={(e) => resizeGrid(Number(e.target.value), env.cols)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#52677c] mb-1">
                  Cols ({env.cols})
                </label>
                <input
                  type="range"
                  min={8}
                  max={36}
                  value={env.cols}
                  onChange={(e) => resizeGrid(env.rows, Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Drawing & Map Generation Tools */}
          <div className="p-4 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-[#0f1e36] text-sm">Grid Editor Tools</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={undoEnv}
                  title="Undo"
                  className="p-1.5 rounded bg-[#f2ebd2] hover:bg-[#e6dec0] disabled:opacity-40 text-[#0f1e36]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={redoEnv}
                  title="Redo"
                  className="p-1.5 rounded bg-[#f2ebd2] hover:bg-[#e6dec0] disabled:opacity-40 text-[#0f1e36]"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'draw', label: 'Draw Wall' },
                { id: 'erase', label: 'Erase Wall' },
                { id: 'region', label: 'Rect Region' },
                { id: 'start', label: 'Place Start' },
                { id: 'goal', label: 'Place Goal' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(t.id);
                    setRegionStart(null);
                  }}
                  className={`py-1.5 px-2.5 rounded-lg font-medium text-left transition-all border ${
                    activeTool === t.id
                      ? 'bg-teal-600/15 text-[#0f766e] border-teal-600/45 font-semibold'
                      : 'bg-[#fbf7e8] text-[#2d4258] border-transparent hover:border-teal-700/25'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[#52677c] mb-1">
                <span>Random Wall Density</span>
                <span className="font-mono font-bold text-[#0f1e36]">
                  {Math.round(randomDensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.08}
                max={0.42}
                step={0.02}
                value={randomDensity}
                onChange={(e) => setRandomDensity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={generateMazeEnv}
                className="btn btn-secondary btn-sm text-[11px] justify-center"
              >
                Generate Maze
              </button>
              <button
                type="button"
                onClick={() => generateRandomWalls(randomDensity)}
                className="btn btn-secondary btn-sm text-[11px] justify-center"
              >
                Random Walls
              </button>
              <button
                type="button"
                onClick={swapStartGoal}
                className="btn btn-secondary btn-sm text-[11px] justify-center"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Swap S/G</span>
              </button>
              <button
                type="button"
                onClick={randomizeStartGoal}
                className="btn btn-secondary btn-sm text-[11px] justify-center"
              >
                <Shuffle className="w-3 h-3" />
                <span>Random S/G</span>
              </button>
            </div>

            <button
              type="button"
              onClick={clearAllWalls}
              className="w-full py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 hover:bg-red-500/20 flex items-center justify-center gap-1.5 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Obstacles</span>
            </button>
          </div>

          {/* Planner & Contextual Options */}
          <div className="p-4 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-3 text-xs">
            <h3 className="font-heading font-bold text-[#0f1e36] text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-700" />
              <span>Algorithm & Heuristics</span>
            </h3>

            <div>
              <label className="block text-[#52677c] mb-1">Path Planner (6 Supported)</label>
              <select
                value={selectedPlanner}
                onChange={(e) => setSelectedPlanner(e.target.value)}
                className="w-full font-mono text-xs"
              >
                {PLANNER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PLANNER_REGISTRY[id].label} ({PLANNER_REGISTRY[id].shortLabel})
                  </option>
                ))}
              </select>
            </div>

            {/* Contextual Heuristic Selector */}
            {plannerMeta.supportsHeuristic ? (
              <div>
                <label className="block text-[#52677c] mb-1">Heuristic Function h(n)</label>
                <select
                  value={heuristic}
                  onChange={(e) => setHeuristic(e.target.value)}
                  className="w-full font-mono text-xs"
                >
                  {Object.entries(HEURISTIC_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)] text-[11px] text-[#2d4258]">
                <span className="text-[#0f766e] font-semibold">{plannerMeta.shortLabel}</span> does not use a heuristic distance function.
              </div>
            )}

            {/* Contextual Movement Mode */}
            {plannerMeta.supportsMovementMode ? (
              <div>
                <label className="block text-[#52677c] mb-1">Grid Connectivity</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectivity(4)}
                    className={`py-1.5 rounded-lg font-mono text-xs border ${
                      connectivity === 4
                        ? 'bg-teal-600/15 text-[#0f766e] border-teal-600/45 font-bold'
                        : 'bg-[#fbf7e8] text-[#52677c] border-transparent'
                    }`}
                  >
                    4-Direction
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectivity(8)}
                    className={`py-1.5 rounded-lg font-mono text-xs border ${
                      connectivity === 8
                        ? 'bg-teal-600/15 text-[#0f766e] border-teal-600/45 font-bold'
                        : 'bg-[#fbf7e8] text-[#52677c] border-transparent'
                    }`}
                  >
                    8-Direction
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)] text-[11px] text-[#2d4258]">
                Sampling planner grows continuous collision-checked tree edges.
              </div>
            )}

            {/* Dynamic Moving Obstacles Toggle */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#0f1e36] font-medium flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dynamic Obstacle Replanning</span>
                </span>
                <input
                  type="checkbox"
                  checked={dynamicActive}
                  onChange={(e) => setDynamicActive(e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600"
                />
              </label>
              {dynamicActive && (
                <p className="text-[10px] text-amber-700 font-mono mt-1">
                  Active — Replans triggered: {replanCount}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => executePlan(env, false)}
              className="btn btn-primary w-full justify-center py-2 text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run {plannerMeta.shortLabel} Planner</span>
            </button>
          </div>
        </div>

        {/* CENTER PANEL: Interactive 2D Grid Canvas */}
        <div className="lg:col-span-6 space-y-4">
          <div
            className="p-5 rounded-3xl glass-panel-elevated border border-[var(--border-medium)] flex flex-col items-center justify-center space-y-4 select-none"
            onMouseLeave={() => {
              if (isDragging) {
                setIsDragging(false);
                executePlan(env, false);
              }
            }}
            onMouseUp={() => {
              if (isDragging) {
                setIsDragging(false);
                executePlan(env, false);
              }
            }}
          >
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-[#2d4258]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> Start
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Goal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#1f4e5f] inline-block" /> Obstacle
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-sky-500/40 inline-block" /> Visited
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-indigo-500/50 inline-block" /> Frontier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Final Path
              </span>
            </div>

            {/* 2D Interactive Grid */}
            <div
              className="grid bg-[#e9e1c5] p-2.5 rounded-2xl border border-teal-800/20 shadow-inner overflow-auto max-w-full"
              style={{
                gridTemplateColumns: `repeat(${env.cols}, minmax(16px, 24px))`,
                gap: '2px',
              }}
            >
              {Array.from({ length: env.rows }).map((_, r) =>
                Array.from({ length: env.cols }).map((__, c) => {
                  const idx = r * env.cols + c;
                  const isStart = env.start.row === r && env.start.col === c;
                  const isGoal = env.goal.row === r && env.goal.col === c;
                  const isWall = env.blocked[idx];
                  const isDyn =
                    dynamicObstacleCell &&
                    dynamicObstacleCell.row === r &&
                    dynamicObstacleCell.col === c;
                  const key = `${r},${c}`;
                  const isPath = pathSet.has(key);
                  const isVisited = visitedSet.has(key);
                  const isFrontier = frontierSet.has(key);
                  const isRobot =
                    Math.round(currentRobotCell.row) === r &&
                    Math.round(currentRobotCell.col) === c;

                  let bg = 'bg-[#fcf9ec] hover:bg-[#efe8ce]';
                  if (isWall) bg = 'bg-[#1f4e5f] border border-teal-900/40';
                  else if (isDyn) bg = 'bg-red-600 animate-pulse';
                  else if (isStart) bg = 'bg-emerald-600 shadow-xs';
                  else if (isGoal) bg = 'bg-amber-500 shadow-xs';
                  else if (isPath && searchProgress >= 0.95) bg = 'bg-teal-500';
                  else if (isFrontier) bg = 'bg-indigo-500/45';
                  else if (isVisited) bg = 'bg-sky-500/35';

                  return (
                    <div
                      key={key}
                      onMouseDown={() => {
                        setIsDragging(true);
                        interactWithCell(r, c, true, true);
                      }}
                      onMouseEnter={() => {
                        if (isDragging && (activeTool === 'draw' || activeTool === 'erase')) {
                          interactWithCell(r, c, false, false);
                        }
                      }}
                      className={`aspect-square rounded-[3px] transition-colors cursor-pointer relative flex items-center justify-center ${bg}`}
                      title={`Cell (${r}, ${c})`}
                    >
                      {isRobot && (
                        <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-teal-900 shadow" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Playback Controls */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)] text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="btn btn-primary btn-sm text-xs"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setSearchProgress(1);
                    setRobotStepIndex((prev) =>
                      Math.min((planResult?.path?.length || 1) - 1, prev + 1)
                    );
                  }}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  <StepForward className="w-3.5 h-3.5" />
                  <span>Step</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchProgress(0);
                    setRobotProgress(0);
                    setIsPlaying(true);
                  }}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replay</span>
                </button>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-[#52677c]">Speed:</span>
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-1 rounded ${
                      playbackSpeed === spd
                        ? 'bg-[#0d9488] text-white font-bold'
                        : 'text-[#52677c] hover:text-[#0f1e36]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Live Telemetry & Mathematical Explanation */}
        <div className="lg:col-span-3 space-y-4">
          <div className="p-5 rounded-2xl glass-panel-elevated border border-[var(--border-medium)] space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-[#0f1e36] text-sm">
                Measured Run Telemetry
              </h3>
              <span className="badge badge-cyan text-[10px]">{plannerMeta.shortLabel}</span>
            </div>

            {planResult && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  planResult.pathFound
                    ? 'bg-emerald-500/12 border-emerald-600/35 text-[#065f46]'
                    : 'bg-amber-500/15 border-amber-600/40 text-[#92400e]'
                }`}
              >
                {planResult.pathFound ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold font-mono text-[11px] uppercase">
                    {planResult.status}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {planResult.reason ||
                      (planResult.pathFound
                        ? 'Collision-free path verified from start to goal.'
                        : 'No route connected within search constraints.')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2.5 font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[#52677c]">Path Status</span>
                <span className="text-[#0f1e36] font-bold">
                  {planResult?.pathFound ? 'PATH_FOUND' : planResult?.status || 'IDLE'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[#52677c]">Path Length</span>
                <span className="text-[#047857] font-bold">
                  {planResult?.pathFound
                    ? `${pathLengthMeters} m (${planResult.pathLength.toFixed(2)} cells)`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[#52677c]">Traversal Cost</span>
                <span className="text-[#0f766e] font-bold">
                  {planResult?.pathFound ? planResult.pathCost.toFixed(2) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[#52677c]">{plannerMeta.effortLabel}</span>
                <span className="text-[#b45309] font-bold">
                  {planResult?.nodesExpanded ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[#52677c]">Planning Time</span>
                <span className="text-[#0369a1] font-bold">
                  {(planResult?.planningTimeMs || 0).toFixed(2)} ms
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#52677c]">Waypoints</span>
                <span className="text-[#0f1e36] font-bold">
                  {planResult?.path?.length || 0}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f4efda] border border-teal-800/20 overflow-x-auto">
              <span className="text-[10px] font-mono uppercase text-[#52677c] block mb-1">
                {currentExplanation.title}
              </span>
              <KatexMath math={currentExplanation.latex} block={true} />
            </div>

            <div className="p-3 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#0f766e] font-bold">
                Optimality Guarantee
              </span>
              <p className="text-[11px] text-[#0f1e36] font-medium">{plannerMeta.optimality}</p>
              <p className="text-[11px] text-[#52677c] leading-relaxed pt-1">
                {plannerMeta.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Simulator2DPage;
