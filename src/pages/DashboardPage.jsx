import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { scenariosApi, resultsApi } from '../services/api.js';
import {
  Compass,
  Play,
  Plus,
  Sliders,
  Layers,
  Bot,
  BookmarkCheck,
  Glasses,
  ArrowRight,
  Grid as GridIcon,
  BarChart3,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import WebXRManager from '../components/scene/WebXRManager.jsx';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [savedScenarios, setSavedScenarios] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [xrModalOpen, setXrModalOpen] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [scList, runList] = await Promise.all([
          scenariosApi.list().catch(() => []),
          resultsApi.list().catch(() => []),
        ]);
        setSavedScenarios(scList || []);
        setRuns(runList || []);
      } catch (err) {
        console.warn('Failed to load dashboard data:', err);
      } finally {
        setLoadingScenarios(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleLaunchDemo = (demoId) => {
    navigate(`/simulator?demo=${demoId}`);
  };

  // Compute live KPIs from actual recorded simulation runs (never fabricated)
  const kpis = useMemo(() => {
    const totalRuns = runs.length;
    const validRuns = runs.filter(
      (r) => r.pathFound && r.resultStatus === 'PATH_FOUND' && Number(r.pathLength) > 0
    );
    const avgValidLength =
      validRuns.length > 0
        ? (
            validRuns.reduce((acc, r) => acc + Number(r.pathLength || 0), 0) / validRuns.length
          ).toFixed(2)
        : '—';
    const avgPlanTime =
      totalRuns > 0
        ? (
            runs.reduce((acc, r) => acc + Number(r.planningTimeMs || 0), 0) / totalRuns
          ).toFixed(2)
        : '—';

    return {
      totalRuns,
      validCount: validRuns.length,
      failedCount: totalRuns - validRuns.length,
      avgValidLength,
      avgPlanTime,
    };
  }, [runs]);

  const exploredConcepts = user?.exploredConcepts || [
    'ASTAR',
    'DIJKSTRA',
    'BFS',
    'GREEDY',
    'RRT',
    'RRT_STAR',
  ];

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-8">
      {/* 1. WELCOME BANNER & PRIMARY ACTIONS */}
      <div className="p-8 rounded-3xl glass-panel-elevated border border-[var(--border-medium)] bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-cyan-950/40 relative overflow-hidden shadow-2xl">
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>RoboPath 3D Technical Workspace Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-white tracking-tight">
            Welcome back, <span className="text-gradient-cyan">{user?.name || 'Researcher'}</span>
          </h1>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Configure 3D or 2D robotics environments, compare all six path-planning algorithms
            (BFS, Dijkstra, A*, Greedy Best-First, RRT, and RRT*), and export verified telemetry.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link to="/simulator" className="btn btn-primary btn-md shadow-glow-cyan">
              <Plus className="w-4 h-4" />
              <span>Launch 3D Simulator</span>
            </Link>

            <Link
              to="/simulator-2d"
              className="btn btn-secondary btn-md text-teal-300 border-teal-500/40"
            >
              <GridIcon className="w-4 h-4" />
              <span>Open 2D Grid Simulator</span>
            </Link>

            <button
              onClick={() => handleLaunchDemo('demo-a-dijkstra-vs-astar')}
              className="btn btn-secondary btn-md text-[var(--accent-cyan)] border-cyan-500/40 hover:border-cyan-400"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Run Interactive Demo A</span>
            </button>
          </div>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
      </div>

      {/* LIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-1">
          <span className="text-xs font-mono text-slate-400">Recorded Experiment Runs</span>
          <p className="text-2xl font-heading font-extrabold text-white">{kpis.totalRuns}</p>
          <p className="text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400">{kpis.validCount} PATH_FOUND</span> •{' '}
            <span className="text-rose-400">{kpis.failedCount} Failed</span>
          </p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-1">
          <span className="text-xs font-mono text-slate-400">Avg Successful Path Length</span>
          <p className="text-2xl font-heading font-extrabold text-emerald-400">
            {kpis.avgValidLength !== '—' ? `${kpis.avgValidLength} m` : 'No runs yet'}
          </p>
          <p className="text-[11px] font-mono text-slate-400">Excludes failed / unreachable runs</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-1">
          <span className="text-xs font-mono text-slate-400">Avg Planning Latency</span>
          <p className="text-2xl font-heading font-extrabold text-cyan-400">
            {kpis.avgPlanTime !== '—' ? `${kpis.avgPlanTime} ms` : 'No runs yet'}
          </p>
          <p className="text-[11px] font-mono text-slate-400">Measured client-side execution</p>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-1">
          <span className="text-xs font-mono text-slate-400">Saved Custom Scenarios</span>
          <p className="text-2xl font-heading font-extrabold text-amber-400">
            {savedScenarios.length}
          </p>
          <p className="text-[11px] font-mono text-slate-400">+ 8 predefined benchmark arenas</p>
        </div>
      </div>

      {/* 2. THE WORKSPACE LABORATORY CARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-xl text-white">Simulation Laboratory Modules</h2>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            8 Interconnected Workspace Views
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card A: 3D Simulator */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[var(--accent-cyan)]">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                A. 3D Motion Planning Simulator
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Configure 3D arenas, camera presets, differential-drive kinematics, and watch the
                Floating Live Intelligence window narrate every decision.
              </p>
            </div>
            <Link
              to="/simulator"
              className="btn btn-secondary btn-sm w-full justify-between text-xs"
            >
              <span>Open 3D Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card B: 2D Grid Simulator */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <GridIcon className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                B. Classic 2D Grid Simulator
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Click-and-drag wall drawing, rectangular regions, maze generator, undo/redo history,
                and dynamic moving obstacles with automatic replanning.
              </p>
            </div>
            <Link
              to="/simulator-2d"
              className="btn btn-secondary btn-sm w-full justify-between text-xs"
            >
              <span>Open 2D Grid Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card C: Algorithm Comparison */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                C. 6-Algorithm Head-to-Head Comparison
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Compare BFS, Dijkstra, A*, Greedy Best-First, RRT, and RRT* side-by-side on the
                exact same environment.
              </p>
            </div>
            <Link
              to="/algorithms"
              className="btn btn-secondary btn-sm w-full justify-between text-xs"
            >
              <span>Compare All 6 Planners</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card D: Experiments & Export */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-sky-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                D. Experiments & CSV/JSON Export
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Inspect sortable, filterable run records with explicit termination statuses and
                export experimental tables to CSV or JSON.
              </p>
            </div>
            <Link
              to="/experiments"
              className="btn btn-secondary btn-sm w-full justify-between text-xs"
            >
              <span>Open Experiment Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card E: Analytics & Performance */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                E. Analytics & Recharts Telemetry
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Visualize average successful path length, planning time, grid states vs. sampling
                tree nodes, and scenario success rates.
              </p>
            </div>
            <Link
              to="/analytics"
              className="btn btn-secondary btn-sm w-full justify-between text-xs"
            >
              <span>View Performance Charts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card F: Saved Environments & WebXR */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-violet-500/40 transition-all flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                F. Saved Environments ({savedScenarios.length})
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Manage custom saved scenarios, explore 8 predefined scenarios, or check WebXR
                spatial hardware compatibility.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/scenarios"
                className="btn btn-secondary btn-sm justify-center text-xs"
              >
                <span>Scenarios</span>
              </Link>
              <button
                onClick={() => setXrModalOpen(true)}
                className="btn btn-secondary btn-sm justify-center text-xs text-violet-300"
              >
                <Glasses className="w-3.5 h-3.5" />
                <span>WebXR</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WebXR Hardware Modal */}
      <WebXRManager isOpen={xrModalOpen} onClose={() => setXrModalOpen(false)} />
    </div>
  );
}

export default DashboardPage;
