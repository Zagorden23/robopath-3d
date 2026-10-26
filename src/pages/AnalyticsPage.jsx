import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { resultsApi } from '../services/api.js';
import {
  buildOccupancyGrid,
  runPlanner,
  PLANNER_IDS,
  PLANNER_REGISTRY,
} from '../engine/grid/index.js';
import { instantiateScenario } from '../engine/grid/scenarios.js';
import {
  BarChart3,
  Play,
  Sparkles,
  CheckCircle2,
  Clock,
  Cpu,
  Route,
  ClipboardList,
} from 'lucide-react';

export function AnalyticsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const list = await resultsApi.list();
      setRuns(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  // Generate multi-scenario benchmark data if the user wants instant comparative charts
  const handleGenerateMultiScenarioBenchmark = async () => {
    setSeeding(true);
    try {
      const targetScenarios = ['empty', 'random-obstacles', 'maze', 'multiple-routes', 'unreachable-goal'];
      for (const scId of targetScenarios) {
        const env = instantiateScenario(scId);
        if (!env) continue;
        const grid = buildOccupancyGrid(env);
        for (const plannerId of PLANNER_IDS) {
          const meta = PLANNER_REGISTRY[plannerId];
          const res = runPlanner({
            grid,
            planner: plannerId,
            options: {
              connectivity: 8,
              heuristic: meta.supportsHeuristic ? 'octile' : 'none',
              seed: 77,
              maxIterations: plannerId.startsWith('RRT') ? 6000 : 200000,
            },
          });

          await resultsApi.record({
            scenarioId: scId,
            scenarioName: env.name,
            planner: plannerId,
            heuristic: meta.supportsHeuristic ? 'octile' : 'none',
            movementMode: meta.supportsMovementMode ? '8-dir' : 'continuous',
            pathFound: Boolean(res.pathFound),
            resultStatus: res.status || (res.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
            pathLength: Number((res.pathLength || 0).toFixed(3)),
            pathCost: Number((res.pathCost || 0).toFixed(3)),
            nodesExpanded: res.nodesExpanded || 0,
            nodesGenerated: res.nodesGenerated || 0,
            planningTimeMs: Number((res.planningTimeMs || 0).toFixed(3)),
          });
        }
      }
      await loadRuns();
    } finally {
      setSeeding(false);
    }
  };

  // 1. Aggregate metrics by planner (excluding failed runs from pathLength average!)
  const plannerMetrics = useMemo(() => {
    return PLANNER_IDS.map((plannerId) => {
      const meta = PLANNER_REGISTRY[plannerId];
      const matching = runs.filter((r) => r.planner === plannerId);
      const successful = matching.filter(
        (r) => r.pathFound && r.resultStatus === 'PATH_FOUND' && Number(r.pathLength) > 0
      );
      const failedCount = matching.length - successful.length;

      const avgPathLength =
        successful.length > 0
          ? Number(
              (
                successful.reduce((acc, r) => acc + Number(r.pathLength || 0), 0) /
                successful.length
              ).toFixed(2)
            )
          : 0;

      const avgPlanningTimeMs =
        matching.length > 0
          ? Number(
              (
                matching.reduce((acc, r) => acc + Number(r.planningTimeMs || 0), 0) /
                matching.length
              ).toFixed(2)
            )
          : 0;

      const avgEffort =
        matching.length > 0
          ? Math.round(
              matching.reduce((acc, r) => acc + Number(r.nodesExpanded || 0), 0) / matching.length
            )
          : 0;

      return {
        planner: plannerId,
        label: meta.shortLabel,
        family: meta.family,
        effortType: meta.family === 'sampling' ? 'Tree Nodes' : 'Grid Cells',
        totalRuns: matching.length,
        successCount: successful.length,
        failedCount,
        avgPathLength,
        avgPlanningTimeMs,
        gridStatesExpanded: meta.family === 'graph' ? avgEffort : 0,
        treeNodesGenerated: meta.family === 'sampling' ? avgEffort : 0,
      };
    });
  }, [runs]);

  // 2. Success Rate by Scenario
  const scenarioSuccessMetrics = useMemo(() => {
    const groups = new Map();
    for (const r of runs) {
      const key = r.scenarioId || 'custom';
      if (!groups.has(key)) {
        groups.set(key, { scenarioId: key, total: 0, success: 0, noPath: 0, limitReached: 0 });
      }
      const g = groups.get(key);
      g.total += 1;
      if (r.pathFound || r.resultStatus === 'PATH_FOUND') g.success += 1;
      else if (r.resultStatus === 'SEARCH_LIMIT_REACHED') g.limitReached += 1;
      else g.noPath += 1;
    }

    return Array.from(groups.values()).map((g) => ({
      ...g,
      successRate: g.total > 0 ? Number(((g.success / g.total) * 100).toFixed(1)) : 0,
    }));
  }, [runs]);

  // 3. Trial-by-trial timeline (most recent 20 runs)
  const recentTrials = useMemo(() => {
    return [...runs]
      .slice(0, 20)
      .reverse()
      .map((r, idx) => ({
        trial: `#${idx + 1} (${r.planner})`,
        pathLength: r.pathFound ? Number(r.pathLength || 0) : null,
        planningTimeMs: Number(r.planningTimeMs || 0),
        nodesExpanded: Number(r.nodesExpanded || 0),
      }));
  }, [runs]);

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Quantitative Performance Analytics</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-white">
            Analytics & Algorithm Performance
          </h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            All charts are computed directly from recorded simulation runs. Failed or unreachable runs
            are never averaged as zero-length paths; success and failure counts are reported explicitly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={seeding}
            onClick={handleGenerateMultiScenarioBenchmark}
            className="btn btn-primary btn-sm text-xs shadow-glow-cyan"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {seeding ? 'Executing 30-Run Benchmark...' : 'Run Multi-Scenario Benchmark (5 Maps × 6 Planners)'}
            </span>
          </button>
          <Link to="/experiments" className="btn btn-secondary btn-sm text-xs">
            <ClipboardList className="w-3.5 h-3.5" />
            <span>View Raw Run Table</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-12 rounded-2xl glass-panel text-center text-xs text-slate-400 font-mono">
          Computing analytics from experiment store...
        </div>
      ) : runs.length === 0 ? (
        <div className="p-12 rounded-3xl glass-panel border border-[var(--border-subtle)] text-center space-y-4">
          <p className="text-sm text-white font-semibold">
            No simulation runs have been recorded yet.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click below to run all 6 algorithms across 5 standard scenarios (Empty, Random Obstacles,
            Maze, Multiple Routes, and Unreachable Goal) and populate live charts.
          </p>
          <button
            type="button"
            onClick={handleGenerateMultiScenarioBenchmark}
            className="btn btn-primary btn-md text-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Execute 30-Run Multi-Scenario Benchmark</span>
          </button>
        </div>
      ) : (
        <>
          {/* Summary Table of Planner Success/Fail Counts + Avg Successful Path Length */}
          <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-medium)] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-white">
                Planner Summary (Successful Path Length vs. Failure Counts)
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Total Recorded Runs: {runs.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {plannerMetrics.map((pm) => (
                <div
                  key={pm.planner}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-white text-sm">{pm.label}</span>
                    <span className="badge badge-cyan text-[9px]">{pm.effortType}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Success / Fail:</span>
                      <span>
                        <span className="text-emerald-400 font-bold">{pm.successCount}</span>
                        {' / '}
                        <span className="text-rose-400 font-bold">{pm.failedCount}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Valid Path:</span>
                      <span className="text-cyan-300 font-bold">
                        {pm.successCount > 0 ? `${pm.avgPathLength} m` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Time:</span>
                      <span className="text-indigo-300">{pm.avgPlanningTimeMs} ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Average Successful Path Length by Planner */}
            <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-4">
              <div>
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <Route className="w-4 h-4 text-emerald-400" />
                  <span>Average Successful Path Length by Planner (m)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Computed strictly over PATH_FOUND runs (failed runs excluded).
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plannerMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="avgPathLength"
                      name="Avg Successful Path Length (m)"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Average Planning Time by Planner */}
            <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-4">
              <div>
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Average Planning Time by Planner (ms)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Measured wall-clock execution duration per run.
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plannerMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="avgPlanningTimeMs"
                      name="Avg Planning Time (ms)"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Search Effort (Grid Cells Expanded vs Sampling Tree Nodes) */}
            <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-4">
              <div>
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Search Effort: Grid States vs. Sampling-Tree Nodes</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Distinguishes discrete grid cells expanded (BFS, Dijkstra, A*, Greedy) from tree nodes generated (RRT, RRT*).
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={plannerMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="gridStatesExpanded"
                      name="Grid Cells Expanded"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="treeNodesGenerated"
                      name="Sampling Tree Nodes"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Success Rate by Scenario */}
            <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-4">
              <div>
                <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Success Rate by Scenario (%)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Percentage of runs finding a valid collision-free path per environment preset.
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioSuccessMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="scenarioId" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="successRate"
                      name="Success Rate (%)"
                      fill="#38bdf8"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 5: Trial-by-Trial Variability */}
          <div className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] space-y-4">
            <div>
              <h3 className="font-heading font-bold text-white text-base">
                Performance Across Recent Trials (Path Length & Planning Time)
              </h3>
              <p className="text-[11px] text-slate-400">
                Tracks run-to-run variability across your 20 most recent experiments.
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentTrials}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="trial" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pathLength"
                    name="Path Length (m)"
                    stroke="#10b981"
                    strokeWidth={2}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="planningTimeMs"
                    name="Planning Time (ms)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsPage;
