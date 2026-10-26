import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext.jsx';
import SimulatorScene from '../components/scene/SimulatorScene.jsx';
import KatexMath from '../components/common/KatexMath.jsx';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  StepBack,
  Undo2,
  Redo2,
  Trash2,
  Shuffle,
  Grid as GridIcon,
  Compass,
  Sliders,
  Eye,
  Save,
  Download,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Zap,
  BrainCircuit,
  Columns,
  Box,
  MousePointer,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';

export function SimulatorPage() {
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);

  const {
    env,
    canUndo,
    canRedo,
    undoEnv,
    redoEnv,
    scenarioId,
    selectScenario,
    loadCustomEnvironment,
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
  } = useSimulation();

  // Workspace UI state
  const [leftTab, setLeftTab] = useState('environment'); // 'environment' | 'planner' | 'appearance'
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'split'
  const [isDragging2D, setIsDragging2D] = useState(false);

  // Sync URL query parameters on initial load (?scenario=..., ?demo=..., ?algorithm=...)
  useEffect(() => {
    const qScenario = searchParams.get('scenario') || searchParams.get('demo');
    const qAlgo = searchParams.get('algorithm');

    if (qAlgo && PLANNER_IDS.includes(qAlgo.toUpperCase())) {
      setSelectedPlanner(qAlgo.toUpperCase());
    }
    if (qScenario) {
      selectScenario(qScenario);
    }

    // Check if user loaded a saved scenario from ScenariosPage
    try {
      const pendingRaw = sessionStorage.getItem('robopath_active_scenario');
      if (pendingRaw) {
        sessionStorage.removeItem('robopath_active_scenario');
        const parsed = JSON.parse(pendingRaw);
        if (parsed?.gridState) {
          loadCustomEnvironment(parsed.gridState, parsed.algorithmConfig);
        }
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLayer = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportSnapshot = () => {
    const canvasEl = document.querySelector('canvas');
    if (!canvasEl) return;
    try {
      const dataUrl = canvasEl.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `robopath-3d-${selectedPlanner.toLowerCase()}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Snapshot export failed:', err);
    }
  };

  // Combined timeline progress (0..0.5 is search expansion, 0.5..1.0 is robot movement)
  const combinedTimeline = useMemo(() => {
    if (searchProgress < 1) return searchProgress * 0.5;
    return 0.5 + robotProgress * 0.5;
  }, [searchProgress, robotProgress]);

  const handleTimelineScrub = (val) => {
    setIsPlaying(false);
    const num = Number(val);
    if (num <= 0.5) {
      setSearchProgress(num * 2);
      setRobotProgress(0);
    } else {
      setSearchProgress(1);
      setRobotProgress((num - 0.5) * 2);
    }
  };

  // Lookup sets for the synchronized Split 2D view
  const visitedSet2D = useMemo(() => {
    const set = new Set();
    if (!planResult?.visited) return set;
    const count = Math.ceil(planResult.visited.length * searchProgress);
    for (let i = 0; i < count; i++) {
      const c = planResult.visited[i];
      if (c) set.add(`${Math.round(c.row)},${Math.round(c.col)}`);
    }
    return set;
  }, [planResult, searchProgress]);

  const pathSet2D = useMemo(() => {
    const set = new Set();
    if (!planResult?.path) return set;
    for (const c of planResult.path) {
      if (c) set.add(`${Math.round(c.row)},${Math.round(c.col)}`);
    }
    return set;
  }, [planResult]);

  const cellSize = env.cellSize || 0.75;
  const pathLengthMeters = ((planResult?.pathLength || 0) * cellSize).toFixed(2);

  return (
    <div className="flex-1 flex flex-col min-h-0 lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden overflow-x-hidden bg-[var(--bg-darkest)]">
      {/* 1. TOP WORKSPACE CONTROL BAR (Clean, Non-Overlapping) */}
      <div className="shrink-0 px-4 py-2.5 bg-[#fbf7e8] border-b border-[var(--border-medium)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan text-[11px] font-bold">
              3D + 2D Synchronized Engine
            </span>
            <h1 className="font-heading font-bold text-base md:text-lg text-[#0f1e36]">
              {env.name || 'Interactive Robotics Arena'}
            </h1>
          </div>
          <span className="text-xs font-mono text-[#52677c] bg-[#f2ebd2] px-2.5 py-0.5 rounded-md border border-teal-800/15">
            {env.rows} × {env.cols} Grid ({cellSize}m cell) • {plannerMeta.shortLabel}
          </span>
        </div>

        {/* Center Camera & View Mode Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3D vs Split 3D+2D View Mode */}
          <div className="inline-flex items-center rounded-lg bg-[#f0ead2] p-0.5 border border-teal-800/20">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === '3d'
                  ? 'bg-[#0d9488] text-white shadow-sm'
                  : 'text-[#2d4258] hover:text-[#0f1e36]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-[#0d9488] text-white shadow-sm'
                  : 'text-[#2d4258] hover:text-[#0f1e36]'
              }`}
              title="View and edit 3D and 2D arenas side by side in real time"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split 3D + 2D</span>
            </button>
            <Link
              to="/simulator-2d"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#2d4258] hover:text-[#0f1e36]"
            >
              <GridIcon className="w-3.5 h-3.5 text-teal-700" />
              <span>2D Lab</span>
            </Link>
          </div>

          {/* Camera Preset Pills */}
          <div className="hidden xl:inline-flex items-center gap-1 bg-[#f0ead2] p-0.5 rounded-lg border border-teal-800/20 text-[11px] font-mono">
            {[
              { id: 'isometric', label: 'Iso' },
              { id: 'perspective', label: 'Persp' },
              { id: 'top', label: 'Top-Down' },
              { id: 'front', label: 'Front' },
              { id: 'side', label: 'Side' },
              { id: 'follow', label: 'Follow' },
            ].map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraMode(cam.id)}
                className={`px-2 py-1 rounded transition-all ${
                  cameraMode === cam.id
                    ? 'bg-[#ffffff] text-[#0f766e] font-bold shadow-xs border border-teal-600/30'
                    : 'text-[#52677c] hover:text-[#0f1e36]'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Save & Export Actions */}
        <div className="flex items-center gap-1.5">
          {saveFeedback && (
            <span className="text-xs font-mono text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
              {saveFeedback}
            </span>
          )}
          <button
            type="button"
            onClick={saveCurrentEnvironment}
            className="btn btn-secondary btn-sm text-xs"
            title="Save current environment to workspace"
          >
            <Save className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Save Arena</span>
          </button>
          <button
            type="button"
            onClick={exportCurrentTelemetryCsv}
            className="btn btn-secondary btn-sm text-xs"
            title="Export current run metrics and waypoints as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            type="button"
            onClick={exportCurrentTelemetryJson}
            className="btn btn-secondary btn-sm text-xs"
            title="Export current run telemetry and path as JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-sky-700" />
            <span className="hidden sm:inline">JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportSnapshot}
            className="btn btn-secondary btn-sm text-xs"
            title="Capture 3D PNG screenshot"
          >
            <Camera className="w-3.5 h-3.5 text-amber-700" />
          </button>
        </div>
      </div>

      {/* 2. MAIN 3-COLUMN WORKSPACE (Zero Overlapping Panels) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* LEFT COLUMN: Environment Editor, Planner Controls, & 3D Appearance */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-[#fbf7e8] border-b lg:border-b-0 lg:border-r border-[var(--border-medium)] flex flex-col min-h-0 max-h-[58vh] lg:max-h-none">
          {/* Left Panel Category Tabs */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-[#f2ebd2] border-b border-[var(--border-subtle)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLeftTab('environment')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                leftTab === 'environment'
                  ? 'bg-[#ffffff] text-[#0f766e] shadow-xs border border-teal-600/25'
                  : 'text-[#52677c] hover:text-[#0f1e36]'
              }`}
            >
              <GridIcon className="w-3.5 h-3.5" />
              <span>Environment</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('planner')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                leftTab === 'planner'
                  ? 'bg-[#ffffff] text-[#0f766e] shadow-xs border border-teal-600/25'
                  : 'text-[#52677c] hover:text-[#0f1e36]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Planner</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('appearance')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                leftTab === 'appearance'
                  ? 'bg-[#ffffff] text-[#0f766e] shadow-xs border border-teal-600/25'
                  : 'text-[#52677c] hover:text-[#0f1e36]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>3D Scene</span>
            </button>
          </div>

          {/* Scrollable Left Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {leftTab === 'environment' && (
              <>
                {/* Predefined Scenarios */}
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-[#0f1e36]">
                      Scenario Preset (8)
                    </span>
                    <span className="badge badge-amber text-[10px]">Synced</span>
                  </div>
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

                  {/* Grid Dimensions */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] text-[#52677c] mb-1">
                        <span>Rows</span>
                        <span className="font-mono font-bold text-[#0f1e36]">{env.rows}</span>
                      </div>
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
                      <div className="flex justify-between text-[11px] text-[#52677c] mb-1">
                        <span>Cols</span>
                        <span className="font-mono font-bold text-[#0f1e36]">{env.cols}</span>
                      </div>
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

                {/* Interactive 3D & 2D Floor Tools */}
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-[#0f1e36] flex items-center gap-1.5">
                      <MousePointer className="w-3.5 h-3.5 text-teal-700" />
                      <span>3D / 2D Arena Cursor Mode</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!canUndo}
                        onClick={undoEnv}
                        title="Undo edit"
                        className="p-1.5 rounded-md bg-[#f2ebd2] hover:bg-[#e6dec0] disabled:opacity-40 text-[#0f1e36]"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canRedo}
                        onClick={redoEnv}
                        title="Redo edit"
                        className="p-1.5 rounded-md bg-[#f2ebd2] hover:bg-[#e6dec0] disabled:opacity-40 text-[#0f1e36]"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'navigate', label: 'Orbit / Pan 3D' },
                      { id: 'draw', label: 'Draw 3D Wall' },
                      { id: 'erase', label: 'Erase Wall' },
                      { id: 'region', label: 'Rect Region' },
                      { id: 'start', label: 'Move Start (S)' },
                      { id: 'goal', label: 'Move Goal (G)' },
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          setActiveTool(tool.id);
                          setRegionStart(null);
                        }}
                        className={`py-1.5 px-2.5 rounded-lg font-medium text-left transition-all border ${
                          activeTool === tool.id
                            ? 'bg-teal-600/15 text-[#0f766e] border-teal-600/45 font-semibold'
                            : 'bg-[#fbf7e8] text-[#2d4258] border-transparent hover:border-teal-700/25'
                        }`}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#52677c] leading-relaxed">
                    {activeTool === 'navigate'
                      ? 'Drag on the 3D scene to orbit/pan, or select an edit tool above to paint obstacles and move Start/Goal directly on the 3D floor.'
                      : `Click or drag cells directly on the 3D floor (or Split 2D grid) to apply "${activeTool.toUpperCase()}".`}
                  </p>
                </div>

                {/* Procedural Map Generators */}
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-2.5 shadow-2xs">
                  <span className="font-heading font-bold text-[#0f1e36] block">
                    Quick Arena Generators
                  </span>

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

                  <div className="grid grid-cols-2 gap-1.5">
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
              </>
            )}

            {leftTab === 'planner' && (
              <>
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-3 shadow-2xs">
                  <span className="font-heading font-bold text-[#0f1e36] block">
                    Motion Planning Algorithm (6)
                  </span>

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

                  {/* Contextual Heuristic Selector */}
                  {plannerMeta.supportsHeuristic ? (
                    <div>
                      <label className="block text-[11px] text-[#52677c] mb-1">
                        Heuristic Distance Function h(n)
                      </label>
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
                      <span className="font-bold text-[#0f766e]">{plannerMeta.shortLabel}</span> expands states without a goal heuristic function.
                    </div>
                  )}

                  {/* Contextual Movement Mode */}
                  {plannerMeta.supportsMovementMode ? (
                    <div>
                      <label className="block text-[11px] text-[#52677c] mb-1">
                        Neighbor Movement Mode
                      </label>
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
                          4-Dir (Cardinal)
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
                          8-Dir (Diagonal)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)] text-[11px] text-[#2d4258]">
                      Sampling planner grows continuous collision-checked tree branches across free space.
                    </div>
                  )}

                  {/* Robot Kinematic Model */}
                  <div>
                    <label className="block text-[11px] text-[#52677c] mb-1">
                      3D Robot Chassis Kinematics
                    </label>
                    <select
                      value={robotModel}
                      onChange={(e) => setRobotModel(e.target.value)}
                      className="w-full text-xs font-mono"
                    >
                      <option value="differential">Differential Drive (2-Wheel + LIDAR)</option>
                      <option value="omnidirectional">Omnidirectional Holonomic</option>
                    </select>
                  </div>

                  {/* Dynamic Moving Obstacle Replanning */}
                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-[#0f1e36] flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        <span>Dynamic Moving Obstacle</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={dynamicActive}
                        onChange={(e) => setDynamicActive(e.target.checked)}
                        className="w-4 h-4 rounded accent-teal-600"
                      />
                    </label>
                    {dynamicActive && (
                      <p className="text-[11px] text-amber-700 font-mono mt-1">
                        Sweeping obstacle active • Replans: {replanCount}
                      </p>
                    )}
                  </div>
                </div>

                {/* Optimality Summary */}
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-1.5 shadow-2xs">
                  <span className="text-[10px] font-mono uppercase text-teal-700 font-bold">
                    Guarantee • {plannerMeta.optimality}
                  </span>
                  <p className="text-[11px] text-[#2d4258] leading-relaxed">
                    {plannerMeta.description}
                  </p>
                </div>
              </>
            )}

            {leftTab === 'appearance' && (
              <>
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-3 shadow-2xs">
                  <span className="font-heading font-bold text-[#0f1e36] block">
                    3D Laboratory Surface Theme
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { id: 'lemon-ivory', label: 'Warm Lemon-Cream & Teal (Default)' },
                      { id: 'warm-sand', label: 'Warm Ivory & Amber Sandstone' },
                      { id: 'blueprint-day', label: 'Daylight Engineering Blueprint' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSurfaceTheme(theme.id)}
                        className={`w-full py-2 px-3 rounded-lg text-left font-medium border transition-all ${
                          surfaceTheme === theme.id
                            ? 'bg-teal-600/15 text-[#0f766e] border-teal-600/45 font-semibold'
                            : 'bg-[#fbf7e8] text-[#2d4258] border-transparent'
                        }`}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex justify-between text-[11px] text-[#52677c] mb-1">
                      <span>3D Wall Extrusion Height</span>
                      <span className="font-mono font-bold text-[#0f1e36]">
                        {wallHeight.toFixed(2)} m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.35}
                      max={2.0}
                      step={0.05}
                      value={wallHeight}
                      onChange={(e) => setWallHeight(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* 3D Layer Visibility Toggles */}
                <div className="p-3.5 rounded-xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-2 shadow-2xs">
                  <span className="font-heading font-bold text-[#0f1e36] block">
                    3D Visualization Layers
                  </span>
                  {[
                    { key: 'showGrid', label: 'Floor Grid Lines' },
                    { key: 'showObstacles', label: '3D Extruded Obstacles' },
                    { key: 'showExplored', label: 'Explored Search Wavefront' },
                    { key: 'showTree', label: 'RRT / RRT* Sampling Tree' },
                    { key: 'showPath', label: 'Planned Path Ribbon' },
                    { key: 'showWaypoints', label: 'Path Waypoint Spheres' },
                    { key: 'showAxes', label: 'World XYZ Coordinate Axes' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between py-1 cursor-pointer text-[#2d4258] hover:text-[#0f1e36]"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={toggles[item.key] !== false}
                        onChange={() => handleToggleLayer(item.key)}
                        className="w-4 h-4 rounded accent-teal-600"
                      />
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Primary Run Button Always Accessible at Bottom of Left Panel */}
            <button
              type="button"
              onClick={() => executePlan(env, false)}
              className="btn btn-primary w-full justify-center py-2.5 text-xs font-bold shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Run {plannerMeta.shortLabel} Simulation</span>
            </button>
          </div>
        </aside>

        {/* CENTER COLUMN: 3D Viewport (and Split 2D Grid) + Docked Bottom Playback Bar */}
        <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--bg-darkest)] overflow-hidden">
          {/* Viewport Area */}
          <div className="flex-1 min-h-0 flex flex-col xl:flex-row relative overflow-y-auto xl:overflow-hidden">
            {/* Primary 3D Canvas Container */}
            <div className="relative w-full h-[420px] lg:h-auto lg:flex-1 lg:min-h-[300px] xl:min-h-0 min-w-0">
              <SimulatorScene
                gridEnv={env}
                robotConfig={{ model: robotModel }}
                robotPose={robotPose3D}
                startWorld={worldStart}
                goalWorld={worldGoal}
                path={searchProgress >= 0.95 ? worldPath : []}
                visited={visibleVisitedWorld}
                tree={visibleTreeWorld}
                algorithm={selectedPlanner}
                wallHeight={wallHeight}
                surfaceTheme={surfaceTheme}
                activeTool={activeTool}
                regionStart={regionStart}
                dynamicObstacleCell={dynamicObstacleCell}
                onCellInteract={(r, c, isClick) => interactWithCell(r, c, isClick, true)}
                onFinishDrag={() => executePlan(env, false)}
                toggles={toggles}
                cameraMode={cameraMode}
                canvasRef={canvasRef}
              />
            </div>

            {/* Optional Synchronized Split 2D Interactive Grid */}
            {viewMode === 'split' && (
              <div
                className="w-full xl:w-[44%] h-[320px] xl:h-auto shrink-0 bg-[#fbf7e8] border-t xl:border-t-0 xl:border-l border-[var(--border-medium)] p-3 flex flex-col items-center justify-center overflow-auto select-none"
                onMouseLeave={() => {
                  if (isDragging2D) {
                    setIsDragging2D(false);
                    executePlan(env, false);
                  }
                }}
                onMouseUp={() => {
                  if (isDragging2D) {
                    setIsDragging2D(false);
                    executePlan(env, false);
                  }
                }}
              >
                <div className="w-full flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-heading font-bold text-[#0f1e36] flex items-center gap-1.5">
                    <GridIcon className="w-3.5 h-3.5 text-teal-700" />
                    <span>Live Synchronized 2D Occupancy Grid</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#52677c]">
                    Click/Drag to edit both 2D & 3D
                  </span>
                </div>

                <div
                  className="grid bg-[#ede6ce] p-1.5 rounded-xl border border-teal-800/20 shadow-inner overflow-auto max-w-full"
                  style={{
                    gridTemplateColumns: `repeat(${env.cols}, minmax(12px, 19px))`,
                    gap: '1.5px',
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
                      const isPath = pathSet2D.has(key);
                      const isVisited = visitedSet2D.has(key);
                      const isRobot =
                        Math.round(robotPose3D.row) === r &&
                        Math.round(robotPose3D.col) === c;

                      let cellStyle = 'bg-[#fcf9ec] hover:bg-[#e5dec2]';
                      if (isWall) cellStyle = 'bg-[#1f4e5f]';
                      else if (isDyn) cellStyle = 'bg-red-600 animate-pulse';
                      else if (isStart) cellStyle = 'bg-emerald-600';
                      else if (isGoal) cellStyle = 'bg-amber-500';
                      else if (isPath && searchProgress >= 0.95) cellStyle = 'bg-teal-500';
                      else if (isVisited) cellStyle = 'bg-sky-500/35';

                      return (
                        <div
                          key={key}
                          onMouseDown={() => {
                            if (activeTool === 'navigate') {
                              setActiveTool('draw');
                            }
                            setIsDragging2D(true);
                            interactWithCell(r, c, true, true);
                          }}
                          onMouseEnter={() => {
                            if (isDragging2D && (activeTool === 'draw' || activeTool === 'erase')) {
                              interactWithCell(r, c, false, false);
                            }
                          }}
                          className={`aspect-square rounded-[2px] cursor-pointer flex items-center justify-center ${cellStyle}`}
                          title={`Cell (${r}, ${c})`}
                        >
                          {isRobot && (
                            <span className="w-2 h-2 rounded-full bg-white ring-2 ring-teal-900" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Docked Playback & Timeline Scrubber Bar */}
          <div className="shrink-0 px-4 py-2.5 bg-[#fbf7e8] border-t border-[var(--border-medium)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (combinedTimeline >= 0.99) {
                    setSearchProgress(0);
                    setRobotProgress(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying((p) => !p);
                  }
                }}
                className="btn btn-primary btn-sm text-xs px-3"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSearchProgress(1);
                  setRobotStepIndex((idx) => Math.max(0, idx - 1));
                }}
                className="btn btn-secondary btn-sm text-xs px-2"
                title="Step backward along path"
              >
                <StepBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSearchProgress(1);
                  setRobotStepIndex((idx) =>
                    Math.min((planResult?.path?.length || 1) - 1, idx + 1)
                  );
                }}
                className="btn btn-secondary btn-sm text-xs px-2"
                title="Step forward along path"
              >
                <StepForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchProgress(0);
                  setRobotProgress(0);
                  setIsPlaying(true);
                }}
                className="btn btn-secondary btn-sm text-xs px-2.5"
                title="Replay search expansion and robot navigation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Replay</span>
              </button>
            </div>

            {/* Interactive Timeline Progress Scrubber */}
            <div className="flex-1 min-w-[160px] max-w-md flex items-center gap-2.5 font-mono text-[11px]">
              <span className="text-[#52677c] whitespace-nowrap">
                {searchProgress < 1
                  ? `Search ${Math.round(searchProgress * 100)}%`
                  : `Step ${robotStepIndex + 1}/${ Math.max(1, planResult?.path?.length || 1)}`}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={combinedTimeline}
                onChange={(e) => handleTimelineScrub(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Speed Controls & Legend */}
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-[#52677c]">Speed:</span>
                {[0.5, 1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded transition-all ${
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
        </section>

        {/* RIGHT COLUMN: Docked Telemetry Metrics & Live Mathematical Intelligence */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 min-h-0 max-h-[60vh] lg:max-h-none bg-[#fbf7e8] border-t lg:border-t-0 lg:border-l border-[var(--border-medium)] overflow-y-auto p-4 space-y-4 text-xs">
          {/* Card 1: Measured Simulation Telemetry */}
          <div className="p-4 rounded-2xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-sm text-[#0f1e36]">
                Measured Run Telemetry
              </h2>
              <span className="badge badge-cyan text-[10px]">{selectedPlanner}</span>
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
                        ? 'Collision-free path verified from Start to Goal.'
                        : 'Goal could not be reached within search constraints.')}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-2.5 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Path Length</span>
                <span className="text-sm font-bold text-[#047857]">
                  {planResult?.pathFound ? `${pathLengthMeters} m` : '—'}
                </span>
                <span className="text-[10px] text-[#52677c] block">
                  {planResult?.pathFound ? `${planResult.pathLength.toFixed(2)} cells` : 'No route'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Traversal Cost</span>
                <span className="text-sm font-bold text-[#0f766e]">
                  {planResult?.pathFound ? planResult.pathCost.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-[#52677c] block">
                  {plannerMeta.supportsMovementMode ? `${connectivity}-dir` : 'Continuous'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">{plannerMeta.effortLabel}</span>
                <span className="text-sm font-bold text-[#b45309]">
                  {planResult?.nodesExpanded ?? 0}
                </span>
                <span className="text-[10px] text-[#52677c] block">
                  Generated: {planResult?.nodesGenerated ?? 0}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Planning Time</span>
                <span className="text-sm font-bold text-[#0369a1]">
                  {(planResult?.planningTimeMs || 0).toFixed(2)} ms
                </span>
                <span className="text-[10px] text-[#52677c] block">
                  Waypoints: {planResult?.path?.length || 0}
                </span>
              </div>
            </div>

            {/* Robot Pose & Grid Coordinates */}
            <div className="p-2.5 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)] font-mono text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#52677c]">Start / Goal Cells:</span>
                <span className="font-bold text-[#0f1e36]">
                  ({env.start.row},{env.start.col}) → ({env.goal.row},{env.goal.col})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52677c]">Robot 3D Pose:</span>
                <span className="font-bold text-[#0f766e]">
                  x:{robotPose3D.x.toFixed(1)}m, z:{robotPose3D.z.toFixed(1)}m, θ:
                  {((robotPose3D.theta * 180) / Math.PI).toFixed(0)}°
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Docked Live Intelligence & Mathematical Narration */}
          <div className="p-4 rounded-2xl bg-[#ffffff] border border-[var(--border-subtle)] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-600/15 border border-teal-600/30 flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xs text-[#0f1e36]">
                    RoboPath Live Intelligence
                  </h3>
                  <p className="text-[10px] font-mono text-teal-700">
                    Synchronized Math & Decision Narrator
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#fbf7e8] border border-[var(--border-subtle)] space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-[#b45309]">
                {currentExplanation.phaseTitle}
              </span>
              <p className="text-xs text-[#0f1e36] leading-relaxed">
                {currentExplanation.narration}
              </p>
            </div>

            {/* Governing Equation */}
            <div className="p-3 rounded-xl bg-[#f4efda] border border-teal-800/20 overflow-x-auto">
              <span className="text-[10px] font-mono uppercase text-[#52677c] block mb-1">
                {currentExplanation.title}
              </span>
              <KatexMath math={currentExplanation.latex} block={true} />
            </div>

            {/* Live Cost Decomposition */}
            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              <div className="p-2 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Cost g(n)</span>
                <span className="text-xs font-bold text-[#047857]">
                  {currentExplanation.gVal}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Heuristic h(n)</span>
                <span className="text-xs font-bold text-[#b45309]">
                  {plannerMeta.supportsHeuristic ? currentExplanation.hVal : '0.00'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-[#fbf7e8] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[#52677c] block">Priority f(n)</span>
                <span className="text-xs font-bold text-[#0f766e]">
                  {currentExplanation.fVal}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SimulatorPage;
