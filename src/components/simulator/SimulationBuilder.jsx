import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Shuffle,
  RotateCcw,
  Save,
  Check,
  AlertCircle,
  X,
  Compass,
  Box,
  Layers,
  Bot,
} from 'lucide-react';
import { DEMO_SCENARIOS } from '../../engine/presets.js';

export function SimulationBuilder({
  scenario = {},
  onApply = () => {},
  onSave = null,
  isOpen = false,
  onClose = () => {},
}) {
  const [activeTab, setActiveTab] = useState('environment'); // 'environment' | 'robot' | 'algorithm'
  const [localScenario, setLocalScenario] = useState(scenario);
  const [validationError, setValidationError] = useState('');

  // Sync with prop when opened
  React.useEffect(() => {
    if (scenario) {
      setLocalScenario(JSON.parse(JSON.stringify(scenario)));
    }
  }, [scenario, isOpen]);

  if (!isOpen) return null;

  const env = localScenario.environment || {
    width: 20,
    depth: 20,
    resolution: 0.5,
    start: { x: -6, z: -6 },
    goal: { x: 6, z: 6 },
    obstacles: [],
  };

  const robot = localScenario.robotConfig || {
    model: 'differential',
    footprintRadius: 0.45,
    clearanceMargin: 0.08,
  };

  const algo = localScenario.algorithmConfig || {
    algorithm: 'ASTAR',
    heuristic: 'octile',
    allowDiagonal: true,
  };

  const updateEnv = (updates) => {
    setLocalScenario((prev) => ({
      ...prev,
      environment: { ...prev.environment, ...updates },
    }));
  };

  const updateRobot = (updates) => {
    setLocalScenario((prev) => ({
      ...prev,
      robotConfig: { ...prev.robotConfig, ...updates },
    }));
  };

  const updateAlgo = (updates) => {
    setLocalScenario((prev) => ({
      ...prev,
      algorithmConfig: { ...prev.algorithmConfig, ...updates },
    }));
  };

  // Add a new obstacle
  const handleAddObstacle = () => {
    const newObs = {
      id: `obs-custom-${Date.now()}`,
      label: `Obstacle ${env.obstacles.length + 1}`,
      shape: 'box',
      x: 0,
      z: 0,
      width: 2.0,
      depth: 2.0,
      height: 2.0,
      color: '#38bdf8',
    };
    updateEnv({ obstacles: [...env.obstacles, newObs] });
  };

  // Remove obstacle
  const handleRemoveObstacle = (id) => {
    updateEnv({ obstacles: env.obstacles.filter((o) => o.id !== id) });
  };

  // Generate random obstacles
  const handleGenerateRandom = () => {
    const count = 5 + Math.floor(Math.random() * 4);
    const newObstacles = [];
    for (let i = 0; i < count; i++) {
      const x = Number(((Math.random() - 0.5) * (env.width - 6)).toFixed(1));
      const z = Number(((Math.random() - 0.5) * (env.depth - 6)).toFixed(1));
      // avoid start and goal
      const distStart = Math.hypot(x - env.start.x, z - env.start.z);
      const distGoal = Math.hypot(x - env.goal.x, z - env.goal.z);
      if (distStart > 3 && distGoal > 3) {
        newObstacles.push({
          id: `obs-rnd-${i}-${Date.now()}`,
          label: `Barrier ${i + 1}`,
          shape: Math.random() > 0.4 ? 'box' : 'cylinder',
          x,
          z,
          width: Number((1.5 + Math.random() * 2).toFixed(1)),
          depth: Number((1.5 + Math.random() * 2).toFixed(1)),
          radius: 1.0,
          height: Number((1.5 + Math.random() * 1.5).toFixed(1)),
          color: Math.random() > 0.5 ? '#38bdf8' : '#818cf8',
        });
      }
    }
    updateEnv({ obstacles: newObstacles });
  };

  // Restore preset Demo A
  const handleRestoreExample = () => {
    const demoA = DEMO_SCENARIOS[0];
    setLocalScenario(JSON.parse(JSON.stringify(demoA)));
  };

  // Validate and submit
  const handleApply = () => {
    // Basic bounds validation
    const halfW = env.width / 2;
    const halfD = env.depth / 2;
    if (
      Math.abs(env.start.x) > halfW ||
      Math.abs(env.start.z) > halfD ||
      Math.abs(env.goal.x) > halfW ||
      Math.abs(env.goal.z) > halfD
    ) {
      setValidationError('Start or Goal coordinates are outside environment bounds.');
      return;
    }

    setValidationError('');
    onApply(localScenario);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-3xl glass-panel-elevated rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-glass-elevated)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-[var(--accent-cyan)]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-white">
                Simulation Scenario Builder
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                Configure environment, robot kinematics, and motion planning parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] px-6 bg-slate-900/40">
          <button
            onClick={() => setActiveTab('environment')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'environment'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Environment & Obstacles</span>
          </button>

          <button
            onClick={() => setActiveTab('robot')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'robot'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Robot & Footprint</span>
          </button>

          <button
            onClick={() => setActiveTab('algorithm')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'algorithm'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Planner & Heuristics</span>
          </button>
        </div>

        {/* Validation error notice */}
        {validationError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: ENVIRONMENT & OBSTACLES */}
          {activeTab === 'environment' && (
            <div className="space-y-6">
              {/* Floor Dimensions */}
              <div>
                <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                  Floor Dimensions & Resolution
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                      Width (X Axis, m)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="40"
                      step="2"
                      value={env.width}
                      onChange={(e) => updateEnv({ width: Number(e.target.value) })}
                      className="w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                      Depth (Z Axis, m)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="40"
                      step="2"
                      value={env.depth}
                      onChange={(e) => updateEnv({ depth: Number(e.target.value) })}
                      className="w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                      Grid Resolution (m)
                    </label>
                    <select
                      value={env.resolution}
                      onChange={(e) => updateEnv({ resolution: Number(e.target.value) })}
                      className="w-full font-mono"
                    >
                      <option value="0.25">0.25 m (High Precision)</option>
                      <option value="0.5">0.50 m (Standard)</option>
                      <option value="1.0">1.00 m (Fast Coarse)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Start & Goal Coordinates */}
              <div>
                <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                  Start & Goal Poses
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--border-subtle)] space-y-2">
                    <span className="badge badge-cyan text-[10px]">Start Pose</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] block">X Coordinate</label>
                        <input
                          type="number"
                          step="0.5"
                          value={env.start.x}
                          onChange={(e) =>
                            updateEnv({ start: { ...env.start, x: Number(e.target.value) } })
                          }
                          className="w-full font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] block">Z Coordinate</label>
                        <input
                          type="number"
                          step="0.5"
                          value={env.start.z}
                          onChange={(e) =>
                            updateEnv({ start: { ...env.start, z: Number(e.target.value) } })
                          }
                          className="w-full font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--border-subtle)] space-y-2">
                    <span className="badge badge-green text-[10px]">Goal Pose</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] block">X Coordinate</label>
                        <input
                          type="number"
                          step="0.5"
                          value={env.goal.x}
                          onChange={(e) =>
                            updateEnv({ goal: { ...env.goal, x: Number(e.target.value) } })
                          }
                          className="w-full font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] block">Z Coordinate</label>
                        <input
                          type="number"
                          step="0.5"
                          value={env.goal.z}
                          onChange={(e) =>
                            updateEnv({ goal: { ...env.goal, z: Number(e.target.value) } })
                          }
                          className="w-full font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Obstacles List & Actions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-heading font-semibold text-white text-xs uppercase tracking-wider text-slate-300">
                    Obstacles ({env.obstacles.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateRandom}
                      className="btn btn-secondary btn-sm text-[11px]"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Randomize</span>
                    </button>
                    <button
                      onClick={handleAddObstacle}
                      className="btn btn-primary btn-sm text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Obstacle</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {env.obstacles.map((obs, idx) => (
                    <div
                      key={obs.id}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-mono text-cyan-400 text-xs w-24 truncate">
                        {obs.label || `Obstacle ${idx + 1}`}
                      </span>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span>x: {obs.x}</span>
                        <span>z: {obs.z}</span>
                        <span>
                          {obs.shape === 'cylinder'
                            ? `r: ${obs.radius || 1}`
                            : `${obs.width}×${obs.depth}`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveObstacle(obs.id)}
                        className="p-1 rounded text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ROBOT CONFIGURATION */}
          {activeTab === 'robot' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                  Kinematic Robot Model
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {['differential', 'holonomic', 'point'].map((modelName) => (
                    <button
                      key={modelName}
                      type="button"
                      onClick={() => updateRobot({ model: modelName })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        robot.model === modelName
                          ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/10'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-heading font-semibold capitalize text-white">
                        {modelName} Robot
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        {modelName === 'differential'
                          ? 'Two-wheeled non-holonomic drive with orientation constraints.'
                          : modelName === 'holonomic'
                          ? 'Omnidirectional motion in any planar direction.'
                          : 'Point mass abstraction without geometric clearance.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical Parameters */}
              <div>
                <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                  Geometry & Collision Footprint
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                      Footprint Radius (m)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="1.5"
                      value={robot.footprintRadius}
                      onChange={(e) => updateRobot({ footprintRadius: Number(e.target.value) })}
                      className="w-full font-mono"
                    />
                    <p className="text-[10px] text-[var(--text-dim)] mt-1">
                      Inflates obstacles in C-Space to prevent edge clipping.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                      Safety Clearance Margin (m)
                    </label>
                    <input
                      type="number"
                      step="0.02"
                      min="0"
                      max="0.5"
                      value={robot.clearanceMargin}
                      onChange={(e) => updateRobot({ clearanceMargin: Number(e.target.value) })}
                      className="w-full font-mono"
                    />
                    <p className="text-[10px] text-[var(--text-dim)] mt-1">
                      Buffer added around robot radius during collision check.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ALGORITHM CONFIGURATION */}
          {activeTab === 'algorithm' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                  Planning Algorithm (6 Supported)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'ASTAR', label: 'A* Search', desc: 'Optimal + Heuristic' },
                    { id: 'DIJKSTRA', label: 'Dijkstra', desc: 'Lowest Total Cost' },
                    { id: 'BFS', label: 'BFS', desc: 'Fewest Unweighted Hops' },
                    { id: 'GREEDY', label: 'Greedy Best-First', desc: 'Fast Heuristic Driven' },
                    { id: 'RRT', label: 'RRT', desc: 'Continuous Sampling Tree' },
                    { id: 'RRT_STAR', label: 'RRT*', desc: 'Asymptotically Optimal RRT' },
                  ].map((alg) => (
                    <button
                      key={alg.id}
                      type="button"
                      onClick={() => updateAlgo({ algorithm: alg.id })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        algo.algorithm === alg.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-white font-bold'
                          : 'bg-slate-900/60 border-slate-800 text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      <p className="font-heading text-xs">{alg.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{alg.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contextual Heuristics (ONLY for A* and Greedy Best-First) */}
              {(algo.algorithm === 'ASTAR' || algo.algorithm === 'GREEDY') && (
                <div>
                  <h4 className="font-heading font-semibold text-white text-xs mb-3 uppercase tracking-wider text-slate-300">
                    Heuristic Function h(n)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1">
                        Distance Metric
                      </label>
                      <select
                        value={algo.heuristic || 'octile'}
                        onChange={(e) => updateAlgo({ heuristic: e.target.value })}
                        className="w-full font-mono"
                      >
                        <option value="octile">Octile (Admissible for 8-Connected)</option>
                        <option value="euclidean">Euclidean (Straight-Line Distance)</option>
                        <option value="manhattan">Manhattan (City Block Distance)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Contextual Connectivity (ONLY for Grid Planners) */}
              {['ASTAR', 'DIJKSTRA', 'BFS', 'GREEDY'].includes(algo.algorithm) && (
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={algo.allowDiagonal !== false}
                      onChange={(e) => updateAlgo({ allowDiagonal: e.target.checked })}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-0"
                    />
                    <span className="text-white text-xs">
                      Allow 8-Way Diagonal Transitions (Corner-Cutting Prevented)
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-[var(--border-subtle)] bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={handleRestoreExample}
            className="btn btn-secondary btn-sm text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Demo Scenario</span>
          </button>

          <div className="flex items-center gap-3">
            {onSave && (
              <button
                onClick={() => onSave(localScenario)}
                className="btn btn-secondary btn-sm text-xs text-indigo-300"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Scenario</span>
              </button>
            )}

            <button onClick={handleApply} className="btn btn-primary btn-sm text-xs">
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Plan Simulation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimulationBuilder;
