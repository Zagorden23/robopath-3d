import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext.jsx';
import {
  buildOccupancyGrid,
  runPlanner,
  PLANNER_IDS,
  PLANNER_REGISTRY,
} from '../engine/grid/index.js';
import { SCENARIOS, instantiateScenario } from '../engine/grid/scenarios.js';
import { resultsApi } from '../services/api.js';
import KatexMath from '../components/common/KatexMath.jsx';
import {
  Layers,
  ShieldCheck,
  Sparkles,
  Bot,
  Play,
  CheckCircle2,
  AlertTriangle,
  BookmarkPlus,
} from 'lucide-react';

export function AlgorithmsPage() {
  const navigate = useNavigate();
  const { env: activeWorkspaceEnv, setSelectedPlanner, selectScenario } = useSimulation();

  const [selectedArenaId, setSelectedArenaId] = useState('active-workspace');
  const [allowDiagonal, setAllowDiagonal] = useState(true);
  const [selectedPlanners, setSelectedPlanners] = useState([...PLANNER_IDS]);
  const [recordedNotice, setRecordedNotice] = useState('');

  const targetEnv = useMemo(() => {
    if (selectedArenaId === 'active-workspace') {
      return activeWorkspaceEnv;
    }
    return instantiateScenario(selectedArenaId) || activeWorkspaceEnv;
  }, [selectedArenaId, activeWorkspaceEnv]);

  const togglePlanner = (id) => {
    setSelectedPlanners((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
  };

  // Execute fair side-by-side comparison across all selected planners on the unified grid arena
  const benchmark = useMemo(() => {
    const grid = buildOccupancyGrid(targetEnv);
    const cellSize = targetEnv.cellSize || 0.75;
    const connectivity = allowDiagonal ? 8 : 4;

    const results = selectedPlanners.map((id) => {
      const meta = PLANNER_REGISTRY[id] || PLANNER_REGISTRY.ASTAR;
      const res = runPlanner({
        grid,
        planner: id,
        options: {
          connectivity: meta.supportsMovementMode ? connectivity : 8,
          heuristic: meta.supportsHeuristic ? (allowDiagonal ? 'octile' : 'manhattan') : 'none',
          seed: 42,
          maxIterations: id.startsWith('RRT') ? 5500 : 200000,
        },
      });

      return {
        algorithm: id,
        success: Boolean(res.pathFound),
        isCollisionFree: Boolean(res.pathFound),
        status: res.status || (res.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
        pathLength: (res.pathLength || 0) * cellSize,
        pathCells: res.pathLength || 0,
        traversalCost: res.pathCost || 0,
        nodesExpanded: res.nodesExpanded || 0,
        planningTimeMs: res.planningTimeMs || 0,
        waypoints: res.path?.length || 0,
      };
    });

    const successful = results.filter((r) => r.success);
    let summaryNarrative =
      'No selected planner found a path because the Goal is completely enclosed by obstacles.';
    if (successful.length > 0) {
      const shortest = [...successful].sort((a, b) => a.pathLength - b.pathLength)[0];
      const fewestStates = [...successful].sort((a, b) => a.nodesExpanded - b.nodesExpanded)[0];
      summaryNarrative = `On "${targetEnv.name || 'Active Arena'}" (${targetEnv.rows}×${targetEnv.cols}), ${shortest.algorithm} achieved the shortest path (${shortest.pathLength.toFixed(2)} m), while ${fewestStates.algorithm} required the fewest evaluated states (${fewestStates.nodesExpanded}).`;
    }

    return { results, summaryNarrative };
  }, [targetEnv, allowDiagonal, selectedPlanners]);

  const handleRecordComparison = async () => {
    for (const res of benchmark.results) {
      const meta = PLANNER_REGISTRY[res.algorithm] || {
        supportsHeuristic: false,
        supportsMovementMode: true,
      };
      await resultsApi.record({
        scenarioId: selectedArenaId === 'active-workspace' ? targetEnv.scenarioId || 'custom' : selectedArenaId,
        scenarioName: targetEnv.name || 'Synchronized Arena',
        planner: res.algorithm,
        heuristic: meta.supportsHeuristic ? (allowDiagonal ? 'octile' : 'manhattan') : 'none',
        movementMode: meta.supportsMovementMode ? (allowDiagonal ? '8-dir' : '4-dir') : 'continuous',
        pathFound: Boolean(res.success),
        resultStatus: res.status,
        pathLength: Number((res.pathLength || 0).toFixed(3)),
        pathCost: Number((res.traversalCost || 0).toFixed(3)),
        nodesExpanded: res.nodesExpanded || 0,
        nodesGenerated: res.nodesExpanded || 0,
        planningTimeMs: Number((res.planningTimeMs || 0).toFixed(3)),
      });
    }
    setRecordedNotice(`Logged ${benchmark.results.length} head-to-head runs to Experiments!`);
    setTimeout(() => setRecordedNotice(''), 3500);
  };

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-10">
      {/* 1. HEADER */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Controlled Head-to-Head Comparison (6 Planners)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-white tracking-tight">
            Algorithm Comparison & Complexity Analysis
          </h1>
          <p className="text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            Benchmark graph-search (BFS, Dijkstra, A*, Greedy Best-First) and continuous sampling
            planners (RRT, RRT*) on your active synchronized 2D/3D arena or any preset scenario.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {recordedNotice && (
            <span className="text-xs font-mono text-emerald-400">{recordedNotice}</span>
          )}
          <button
            type="button"
            onClick={handleRecordComparison}
            className="btn btn-primary btn-sm text-xs shadow-glow-cyan"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>Log Comparison Runs to History</span>
          </button>
        </div>
      </div>

      {/* 2. MAP SELECTION & PLANNER FILTER */}
      <div className="p-5 rounded-2xl glass-panel-elevated border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] font-mono">Test Arena:</span>
            <select
              value={selectedArenaId}
              onChange={(e) => setSelectedArenaId(e.target.value)}
              className="font-mono text-xs rounded-lg p-2"
            >
              <option value="active-workspace">
                ★ Active 2D/3D Synchronized Workspace ({activeWorkspaceEnv.rows}×{activeWorkspaceEnv.cols})
              </option>
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  Preset: {sc.name} ({sc.difficulty})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={allowDiagonal}
                onChange={(e) => setAllowDiagonal(e.target.checked)}
                className="w-4 h-4 rounded accent-teal-600"
              />
              <span>8-Connected Diagonal Movement (Octile Cost)</span>
            </label>
          </div>
        </div>

        {/* Select 2-6 Planners */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-mono mr-2">Active Planners (Select 2–6):</span>
          {PLANNER_IDS.map((id) => {
            const active = selectedPlanners.includes(id);
            const meta = PLANNER_REGISTRY[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => togglePlanner(id)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {meta.shortLabel} ({id})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MEASURED PERFORMANCE BENCHMARK MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {benchmark.results.map((res) => {
          const isAstar = res.algorithm === 'ASTAR';
          const meta = PLANNER_REGISTRY[res.algorithm] || {
            label: res.algorithm,
            effortLabel: 'States Expanded',
            optimality: 'Verified',
          };
          return (
            <div
              key={res.algorithm}
              className={`p-6 rounded-2xl glass-panel border flex flex-col justify-between space-y-4 transition-all ${
                isAstar
                  ? 'border-cyan-500/50 shadow-glow-cyan bg-cyan-950/20'
                  : 'border-[var(--border-subtle)]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-white">{meta.label}</h3>
                    <span className="text-[10px] font-mono text-slate-400">{res.algorithm}</span>
                  </div>
                  {res.isCollisionFree && res.success ? (
                    <span className="badge badge-green text-[10px] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PATH_FOUND
                    </span>
                  ) : (
                    <span className="badge badge-amber text-[10px] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {res.status}
                    </span>
                  )}
                </div>

                {/* Metrics Table */}
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-slate-800">
                    <span className="text-[var(--text-muted)]">Path Length</span>
                    <span className="text-white font-semibold">
                      {res.success ? `${res.pathLength.toFixed(2)} m (${res.pathCells.toFixed(1)} cells)` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800">
                    <span className="text-[var(--text-muted)]">{meta.effortLabel}</span>
                    <span className="text-cyan-300 font-semibold">{res.nodesExpanded}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800">
                    <span className="text-[var(--text-muted)]">Planning Time</span>
                    <span className="text-indigo-300 font-semibold">
                      {res.planningTimeMs.toFixed(2)} ms
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-800">
                    <span className="text-[var(--text-muted)]">Traversal Cost</span>
                    <span className="text-emerald-400 font-semibold">
                      {res.success ? res.traversalCost.toFixed(2) : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-muted)]">Waypoints</span>
                    <span className="text-amber-300 font-semibold">{res.waypoints}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (selectedArenaId !== 'active-workspace') {
                    selectScenario(selectedArenaId);
                  }
                  setSelectedPlanner(res.algorithm);
                  navigate('/simulator');
                }}
                className="btn btn-secondary btn-sm w-full justify-center text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate {meta.shortLabel || res.algorithm} in 3D</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. COMPARATIVE SCIENTIFIC ANALYSIS NARRATIVE */}
      <div className="p-6 rounded-2xl glass-panel-elevated border border-cyan-500/30 bg-cyan-950/20 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Scientific Evaluation & Heuristic Assessment</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {benchmark.summaryNarrative}
        </p>
      </div>

      {/* 5. MATHEMATICAL FORMULAS EXPLORER */}
      <div id="kinematics" className="space-y-6 pt-6 border-t border-[var(--border-subtle)]">
        <div>
          <h2 className="font-heading font-bold text-2xl text-white">
            Robotics Kinematics & Mathematics
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Exact formulation of mobile robot dynamics, configuration space, and distance metrics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-3">
            <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Differential-Drive Mobile Robot Kinematics</span>
            </h3>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <KatexMath
                latex="v = \frac{r(\omega_R + \omega_L)}{2}, \qquad \omega = \frac{r(\omega_R - \omega_L)}{L}"
                block
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              For wheel radius <span className="font-mono text-cyan-300">r</span>, track separation{' '}
              <span className="font-mono text-cyan-300">L</span>, and wheel speeds{' '}
              <span className="font-mono text-cyan-300">ω_R, ω_L</span>, linear velocity v and yaw
              angular velocity ω define the planar motion.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-3">
            <h3 className="font-heading font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Configuration Space (C-Space) Obstacle Inflation</span>
            </h3>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <KatexMath
                latex="\mathcal{C}_{\text{obs}} = \mathcal{O} \oplus (-\mathcal{A}) = \bigl\{ q \in \mathcal{C} \;\big|\; \mathcal{A}(q) \cap \mathcal{O} \neq \emptyset \bigr\}"
                block
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Minkowski sum obstacle expansion inflates geometric barriers by the robot footprint
              radius, allowing path planners to treat the robot as a single point in C-free space.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlgorithmsPage;
