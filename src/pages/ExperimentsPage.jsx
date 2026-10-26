import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { resultsApi } from '../services/api.js';
import {
  buildOccupancyGrid,
  runPlanner,
  PLANNER_IDS,
  PLANNER_REGISTRY,
} from '../engine/grid/index.js';
import { SCENARIOS, instantiateScenario } from '../engine/grid/scenarios.js';
import {
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileJson,
  Trash2,
  Play,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
} from 'lucide-react';

export function ExperimentsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plannerFilter, setPlannerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scenarioFilter, setScenarioFilter] = useState('ALL');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [runningBatch, setRunningBatch] = useState(false);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const list = await resultsApi.list();
      setRuns(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  // Run an automated benchmark suite across all 6 algorithms on a selected scenario
  const handleRunSuite = async (targetScenarioId = 'multiple-routes') => {
    setRunningBatch(true);
    try {
      const env = instantiateScenario(targetScenarioId);
      if (!env) return;
      const grid = buildOccupancyGrid(env);

      for (const plannerId of PLANNER_IDS) {
        const meta = PLANNER_REGISTRY[plannerId];
        const res = runPlanner({
          grid,
          planner: plannerId,
          options: {
            connectivity: 8,
            heuristic: meta.supportsHeuristic ? 'octile' : 'none',
            seed: 101,
            maxIterations: plannerId.startsWith('RRT') ? 6000 : 200000,
          },
        });

        await resultsApi.record({
          scenarioId: targetScenarioId,
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
      await loadRuns();
    } finally {
      setRunningBatch(false);
    }
  };

  const handleClearAll = async () => {
    await Promise.all(runs.map((r) => resultsApi.delete(r.runId || r.id)));
    setRuns([]);
  };

  const handleDeleteOne = async (id) => {
    await resultsApi.delete(id);
    setRuns((prev) => prev.filter((r) => (r.id || r.runId) !== id));
  };

  const filteredRuns = useMemo(() => {
    return runs
      .filter((r) => {
        if (plannerFilter !== 'ALL' && r.planner !== plannerFilter) return false;
        if (statusFilter !== 'ALL' && r.resultStatus !== statusFilter) return false;
        if (scenarioFilter !== 'ALL' && r.scenarioId !== scenarioFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === 'timestamp') {
          va = new Date(va || 0).getTime();
          vb = new Date(vb || 0).getTime();
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [runs, plannerFilter, statusFilter, scenarioFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportCsv = () => {
    const csv = resultsApi.exportToCsvString(filteredRuns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `robopath-experiments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(filteredRuns, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `robopath-experiments-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const uniqueScenarios = useMemo(() => {
    const set = new Set(runs.map((r) => r.scenarioId).filter(Boolean));
    return Array.from(set);
  }, [runs]);

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300">
            <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reproducible Experiment Log</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-white">
            Experiments & Run History
          </h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            Every simulation executed in the 3D or 2D workspace is logged with its exact planner,
            heuristic, movement mode, termination status, and measured performance telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={runningBatch}
            onClick={() => handleRunSuite('multiple-routes')}
            className="btn btn-primary btn-sm text-xs shadow-glow-cyan"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{runningBatch ? 'Running 6-Planner Suite...' : 'Run 6-Planner Benchmark Suite'}</span>
          </button>

          <button
            type="button"
            disabled={filteredRuns.length === 0}
            onClick={handleExportCsv}
            className="btn btn-secondary btn-sm text-xs text-emerald-300 border-emerald-500/30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            disabled={filteredRuns.length === 0}
            onClick={handleExportJson}
            className="btn btn-secondary btn-sm text-xs text-cyan-300 border-cyan-500/30"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          {runs.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="btn btn-secondary btn-sm text-xs text-red-300 border-red-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-400 font-mono">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filter Runs:</span>
          </span>

          <select
            value={plannerFilter}
            onChange={(e) => setPlannerFilter(e.target.value)}
            className="text-xs font-mono"
          >
            <option value="ALL">All Planners (6)</option>
            {PLANNER_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="PATH_FOUND">PATH_FOUND</option>
            <option value="NO_PATH">NO_PATH (Unreachable)</option>
            <option value="SEARCH_LIMIT_REACHED">SEARCH_LIMIT_REACHED</option>
          </select>

          <select
            value={scenarioFilter}
            onChange={(e) => setScenarioFilter(e.target.value)}
            className="text-xs font-mono"
          >
            <option value="ALL">All Scenarios</option>
            {uniqueScenarios.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-400 font-mono">
          Showing <span className="text-white font-bold">{filteredRuns.length}</span> of{' '}
          <span className="text-white font-bold">{runs.length}</span> recorded runs
        </div>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="p-12 rounded-2xl glass-panel text-center text-xs text-slate-400 font-mono">
          Loading experiment telemetry...
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="p-12 rounded-3xl glass-panel border border-[var(--border-subtle)] text-center space-y-4">
          <p className="text-sm text-slate-300 font-medium">
            No simulation runs recorded yet matching your current filters.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Run a simulation in the 3D or 2D workspace, or click &ldquo;Run 6-Planner Benchmark Suite&rdquo;
            above to populate experimental data immediately.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleRunSuite('multiple-routes')}
              className="btn btn-primary btn-sm text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate 6-Planner Benchmark Now</span>
            </button>
            <Link to="/simulator" className="btn btn-secondary btn-sm text-xs">
              <span>Open 3D Simulator</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl glass-panel-elevated border border-[var(--border-medium)] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                <th className="py-3.5 px-4">Run ID</th>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => toggleSort('scenarioId')}>
                  <span className="inline-flex items-center gap-1">
                    Scenario <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => toggleSort('planner')}>
                  <span className="inline-flex items-center gap-1">
                    Planner <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3.5 px-4">Heuristic</th>
                <th className="py-3.5 px-4">Movement</th>
                <th className="py-3.5 px-4">Result Status</th>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => toggleSort('pathLength')}>
                  <span className="inline-flex items-center gap-1">
                    Path Length <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer"
                  onClick={() => toggleSort('nodesExpanded')}
                >
                  <span className="inline-flex items-center gap-1">
                    States / Nodes <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer"
                  onClick={() => toggleSort('planningTimeMs')}
                >
                  <span className="inline-flex items-center gap-1">
                    Time (ms) <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => toggleSort('timestamp')}>
                  <span className="inline-flex items-center gap-1">
                    Timestamp <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRuns.map((run) => {
                const id = run.id || run.runId;
                return (
                  <tr key={id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400">{String(run.runId || id).slice(0, 12)}</td>
                    <td className="py-3 px-4 text-white font-sans font-medium">
                      {run.scenarioId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-cyan text-[10px]">{run.planner}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{run.heuristic || 'none'}</td>
                    <td className="py-3 px-4 text-slate-300">{run.movementMode || '8-dir'}</td>
                    <td className="py-3 px-4">
                      {run.resultStatus === 'PATH_FOUND' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PATH_FOUND
                        </span>
                      ) : run.resultStatus === 'SEARCH_LIMIT_REACHED' ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          SEARCH_LIMIT_REACHED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          {run.resultStatus || 'NO_PATH'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-emerald-300 font-bold">
                      {run.pathFound ? `${Number(run.pathLength || 0).toFixed(2)} m` : '—'}
                    </td>
                    <td className="py-3 px-4 text-amber-300">{run.nodesExpanded ?? 0}</td>
                    <td className="py-3 px-4 text-indigo-300">
                      {Number(run.planningTimeMs || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {run.timestamp ? new Date(run.timestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(id)}
                        className="text-slate-500 hover:text-red-400"
                        title="Delete run record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ExperimentsPage;
