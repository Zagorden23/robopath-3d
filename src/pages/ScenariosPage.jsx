import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scenariosApi } from '../services/api.js';
import { SCENARIOS } from '../engine/grid/scenarios.js';
import { DEMO_SCENARIOS } from '../engine/presets.js';
import {
  BookmarkCheck,
  Plus,
  Play,
  Copy,
  Edit2,
  Trash2,
  Grid as GridIcon,
  Compass,
  AlertCircle,
  Check,
  Sparkles,
} from 'lucide-react';

export function ScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const data = await scenariosApi.list();
      setScenarios(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch saved scenarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  const handleDuplicate = async (id) => {
    try {
      await scenariosApi.duplicate(id);
      await fetchScenarios();
    } catch (err) {
      alert(err.message || 'Failed to duplicate scenario.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await scenariosApi.delete(id);
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete scenario.');
    }
  };

  const handleStartRename = (sc) => {
    setEditingId(sc.id);
    setRenameValue(sc.name);
  };

  const handleSaveRename = async (id) => {
    if (!renameValue.trim()) return;
    try {
      await scenariosApi.update(id, { name: renameValue.trim() });
      setEditingId(null);
      await fetchScenarios();
    } catch (err) {
      alert(err.message || 'Failed to rename scenario.');
    }
  };

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300 mb-2">
            <BookmarkCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Saved Environments & Predefined Scenarios</span>
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-white tracking-tight">
            Saved Environments & Scenario Library
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Load, duplicate, rename, or delete your custom arenas, or launch any of the 8 predefined
            experimental scenarios.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <Link to="/simulator-2d" className="btn btn-secondary btn-sm text-xs">
            <GridIcon className="w-4 h-4 text-teal-400" />
            <span>Open 2D Grid Builder</span>
          </Link>
          <Link to="/simulator?custom=true" className="btn btn-primary btn-sm text-xs">
            <Plus className="w-4 h-4" />
            <span>Create 3D Scenario</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. USER SAVED ENVIRONMENTS */}
      <div className="space-y-4">
        <h2 className="font-heading font-bold text-lg text-white">
          Your Saved Custom Environments ({scenarios.length})
        </h2>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400 font-mono glass-panel rounded-2xl">
            Loading saved environments...
          </div>
        ) : scenarios.length === 0 ? (
          <div className="p-8 rounded-2xl glass-panel border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-white text-sm">
                No Custom Saved Scenarios Yet
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Save any customized obstacle arena from the 3D Simulator or 2D Grid Simulator to see
                it here.
              </p>
            </div>
            <Link to="/simulator?custom=true" className="btn btn-primary btn-sm text-xs shrink-0">
              <Plus className="w-4 h-4" />
              <span>Create First Custom Scenario</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((sc) => {
              const isEditing = editingId === sc.id;
              const env = sc.environment || {};
              const robot = sc.robotConfig || {};
              const algo = sc.algorithmConfig || {};

              return (
                <div
                  key={sc.id}
                  className="p-6 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="w-full text-xs font-semibold py-1 px-2"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(sc.id)}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="font-heading font-bold text-white text-base truncate flex-1">
                          {sc.name}
                        </h3>
                      )}

                      <span className="badge badge-cyan text-[10px] uppercase font-mono">
                        {algo.algorithm || 'ASTAR'}
                      </span>
                    </div>

                    {sc.description && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        {sc.description}
                      </p>
                    )}

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--border-subtle)] space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Arena Size:</span>
                        <span className="text-white">
                          {env.width || 20}m × {env.depth || 20}m
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Obstacles:</span>
                        <span className="text-cyan-300">{env.obstacles?.length || 0} barriers</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Robot Model:</span>
                        <span className="text-indigo-300 capitalize">
                          {robot.model || 'differential'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => navigate(`/simulator?scenarioId=${sc.id}`)}
                      className="btn btn-primary btn-sm w-full justify-center text-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Launch in 3D Simulator</span>
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleStartRename(sc)}
                        className="btn btn-secondary btn-sm justify-center text-[11px] text-slate-300"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Rename</span>
                      </button>

                      <button
                        onClick={() => handleDuplicate(sc.id)}
                        className="btn btn-secondary btn-sm justify-center text-[11px] text-slate-300"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Clone</span>
                      </button>

                      <button
                        onClick={() => handleDelete(sc.id)}
                        className="btn btn-secondary btn-sm justify-center text-[11px] text-red-400 hover:border-red-500/40"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. EIGHT PREDEFINED EXPERIMENTAL SCENARIOS */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-lg text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>8 Predefined Experimental Scenarios</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Standardized benchmark maps covering open arenas, mazes, narrow corridors, unreachable
              chambers, and dynamic moving obstacles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SCENARIOS.map((sc) => (
            <div
              key={sc.id}
              className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading font-bold text-white text-sm">{sc.name}</h3>
                  <span className="badge badge-cyan text-[9px]">{sc.difficulty}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {sc.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate(`/simulator-2d?scenario=${sc.id}`)}
                  className="btn btn-secondary btn-sm text-[11px] justify-center"
                >
                  <GridIcon className="w-3 h-3" />
                  <span>Open 2D</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/simulator`)}
                  className="btn btn-primary btn-sm text-[11px] justify-center"
                >
                  <Compass className="w-3 h-3" />
                  <span>Open 3D</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. FIVE 3D LIVE INTELLIGENCE BENCHMARK DEMOS */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
        <h2 className="font-heading font-bold text-lg text-white">
          3D Live Intelligence Demonstrations (Demos A–E)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DEMO_SCENARIOS.map((demo) => (
            <div
              key={demo.id}
              className="p-5 rounded-2xl glass-panel border border-[var(--border-subtle)] flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <span className="badge badge-green text-[10px]">{demo.code}</span>
                <h3 className="font-heading font-bold text-white text-sm">{demo.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {demo.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/simulator?demo=${demo.id}`)}
                className="btn btn-secondary btn-sm text-xs justify-center text-cyan-300"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch {demo.code} in 3D</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScenariosPage;
