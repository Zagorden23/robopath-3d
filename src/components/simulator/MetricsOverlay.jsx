import React from 'react';
import { Activity, Gauge, Clock, ShieldCheck, Ruler, Route } from 'lucide-react';

export function MetricsOverlay({ metrics = {}, algorithm = 'ASTAR', isFeasible = true }) {
  const {
    pathLength = 0,
    nodesExpanded = 0,
    planTimeMs = 0,
    traversalCost = 0,
    minClearance = 0,
  } = metrics;

  return (
    <div className="absolute top-4 right-4 z-20 pointer-events-none flex flex-col gap-2">
      <div className="glass-panel-elevated p-3 px-4 rounded-xl border border-[var(--border-subtle)] shadow-xl pointer-events-auto flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="badge badge-cyan text-[10px] font-bold">{algorithm}</span>
          {isFeasible ? (
            <span className="badge badge-green text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Collision-Free</span>
            </span>
          ) : (
            <span className="badge badge-amber text-[10px]">Infeasible</span>
          )}
        </div>

        <div className="w-px h-4 bg-[var(--border-subtle)]" />

        <div className="flex items-center gap-4">
          <div title="Total computed path length in meters">
            <span className="text-[var(--text-muted)] text-[10px] block">Length</span>
            <span className="text-white font-bold">{Number(pathLength || 0).toFixed(2)}m</span>
          </div>

          <div title="Total search nodes extracted from frontier">
            <span className="text-[var(--text-muted)] text-[10px] block">Expanded</span>
            <span className="text-cyan-300 font-bold">{nodesExpanded || 0}</span>
          </div>

          <div title="Actual planning execution time">
            <span className="text-[var(--text-muted)] text-[10px] block">Plan Time</span>
            <span className="text-indigo-300 font-bold">{Number(planTimeMs || 0).toFixed(1)}ms</span>
          </div>

          <div title="Total cost including weighted terrain">
            <span className="text-[var(--text-muted)] text-[10px] block">Cost</span>
            <span className="text-emerald-400 font-bold">{Number(traversalCost || pathLength || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetricsOverlay;
