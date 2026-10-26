import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Settings,
  Sliders,
  Eye,
  Layers,
  Save,
  CheckCircle2,
  Sparkles,
  Bot,
} from 'lucide-react';

export function SettingsPage() {
  const { user, updateUser } = useAuth();
  const currentPrefs = user?.preferences || {};

  const [defaultAlgorithm, setDefaultAlgorithm] = useState(
    currentPrefs.defaultAlgorithm || 'ASTAR'
  );
  const [defaultRobotModel, setDefaultRobotModel] = useState(
    currentPrefs.defaultRobotModel || 'differential'
  );
  const [explanationLayout, setExplanationLayout] = useState(
    currentPrefs.explanationLayout || 'floating'
  );
  const [renderQuality, setRenderQuality] = useState(
    currentPrefs.renderQuality || 'high'
  );
  const [reducedMotion, setReducedMotion] = useState(
    Boolean(currentPrefs.reducedMotion)
  );
  const [showGridByDefault, setShowGridByDefault] = useState(
    currentPrefs.showGridByDefault !== false
  );
  const [showExploredByDefault, setShowExploredByDefault] = useState(
    currentPrefs.showExploredByDefault !== false
  );
  const [showCSpaceByDefault, setShowCSpaceByDefault] = useState(
    currentPrefs.showCSpaceByDefault !== false
  );

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUser({
        preferences: {
          defaultAlgorithm,
          defaultRobotModel,
          explanationLayout,
          renderQuality,
          reducedMotion,
          showGridByDefault,
          showExploredByDefault,
          showCSpaceByDefault,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-8 max-w-3xl">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300 mb-2">
          <Settings className="w-3.5 h-3.5 text-cyan-400" />
          <span>Application Settings</span>
        </div>
        <h1 className="text-3xl font-heading font-extrabold text-white tracking-tight">
          Simulator & Display Settings
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Customize your default robotics planning configuration and 3D rendering pipeline.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Settings saved and updated in persistent account session.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Planning Defaults */}
        <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-subtle)] space-y-4 text-xs">
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Default Planning Parameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Default Planning Algorithm
              </label>
              <select
                value={defaultAlgorithm}
                onChange={(e) => setDefaultAlgorithm(e.target.value)}
                className="w-full font-mono"
              >
                <option value="ASTAR">A* Heuristic Search</option>
                <option value="DIJKSTRA">Dijkstra's Algorithm</option>
                <option value="BFS">Breadth-First Search (BFS)</option>
                <option value="RRT">Continuous-Space RRT</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Default Kinematic Robot Model
              </label>
              <select
                value={defaultRobotModel}
                onChange={(e) => setDefaultRobotModel(e.target.value)}
                className="w-full font-mono"
              >
                <option value="differential">Differential-Drive Mobile Robot</option>
                <option value="holonomic">Holonomic Omnidirectional Robot</option>
                <option value="point">Point-Mass Geometric Robot</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3D Scene & Intelligence Panel Defaults */}
        <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-subtle)] space-y-4 text-xs">
          <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>3D Viewport & Intelligence Panel</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Live Intelligence Panel Layout
              </label>
              <select
                value={explanationLayout}
                onChange={(e) => setExplanationLayout(e.target.value)}
                className="w-full font-mono"
              >
                <option value="floating">Floating Draggable Window</option>
                <option value="dock-right">Docked to Right Side</option>
                <option value="dock-bottom">Bottom Timeline Panel</option>
                <option value="expanded">Expanded Full Learning Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                3D Rendering Quality
              </label>
              <select
                value={renderQuality}
                onChange={(e) => setRenderQuality(e.target.value)}
                className="w-full font-mono"
              >
                <option value="high">High (2048px Shadows & Antialiasing)</option>
                <option value="balanced">Balanced</option>
                <option value="performance">Performance Mode (Low GPU)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 space-y-2 border-t border-[var(--border-subtle)]">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-0"
              />
              <span>Prefer Reduced Motion (Smooth damping & camera deceleration)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showGridByDefault}
                onChange={(e) => setShowGridByDefault(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-0"
              />
              <span>Display 3D Floor Grid by Default</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showExploredByDefault}
                onChange={(e) => setShowExploredByDefault(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-0"
              />
              <span>Display Explored Nodes & Search Frontier by Default</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn btn-primary btn-sm text-xs">
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsPage;
