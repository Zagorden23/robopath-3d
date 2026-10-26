import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Grid,
  Box,
  Route,
  Activity,
  Milestone,
  Eye,
  Maximize2,
  Camera,
  Compass,
} from 'lucide-react';

export function SimulationToolbar({
  status = 'idle', // 'idle' | 'planning' | 'playing' | 'paused' | 'completed' | 'no_path'
  isPlaying = false,
  currentTime = 0,
  totalDuration = 10000,
  playbackSpeed = 1,
  onPlay = () => {},
  onPause = () => {},
  onReset = () => {},
  onStepForward = () => {},
  onStepBackward = () => {},
  onSpeedChange = () => {},
  onSeek = () => {},
  toggles = {},
  onToggle = () => {},
  cameraMode = 'perspective',
  onCameraModeChange = () => {},
  onScreenshot = () => {},
  onToggleFullscreen = () => {},
}) {
  const speeds = [0.25, 0.5, 1, 2, 4];

  const formatTime = (ms) => {
    const totalSecs = Math.max(0, ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = (totalSecs % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const progressPercent =
    totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2 p-3 glass-panel-elevated rounded-2xl border border-[var(--border-medium)] shadow-2xl backdrop-blur-md">
      {/* Top Timeline Scrubbing Bar */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-[var(--accent-cyan)] min-w-[50px]">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 relative flex items-center group">
          <input
            type="range"
            min="0"
            max={totalDuration || 1000}
            value={currentTime || 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 group-hover:h-2 transition-all"
          />
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)] min-w-[50px] text-right">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[var(--border-subtle)]">
        {/* Playback Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Reset Simulation (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onStepBackward}
            className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Step Backward"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {isPlaying ? (
            <button
              onClick={onPause}
              className="p-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Pause Simulation (Space)"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span className="text-xs">Pause</span>
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="p-2 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-500/10"
              title="Play Simulation (Space)"
            >
              <Play className="w-4 h-4 fill-current" />
              <span className="text-xs">Play</span>
            </button>
          )}

          <button
            onClick={onStepForward}
            className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Step Forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Speed Presets */}
          <div className="flex items-center ml-2 bg-[var(--bg-surface)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all ${
                  playbackSpeed === s
                    ? 'bg-cyan-500/20 text-[var(--accent-cyan)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Camera Views */}
        <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border-subtle)]">
          {[
            { id: 'perspective', label: '3D Orbit' },
            { id: 'isometric', label: 'Isometric' },
            { id: 'top', label: 'Top-Down' },
            { id: 'front', label: 'Front' },
            { id: 'side', label: 'Side' },
            { id: 'follow', label: 'Follow' },
          ].map((cam) => (
            <button
              key={cam.id}
              onClick={() => onCameraModeChange(cam.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                cameraMode === cam.id
                  ? 'bg-cyan-500/20 text-[var(--accent-cyan)]'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
              title={`${cam.label} Camera View`}
            >
              {cam.label}
            </button>
          ))}
        </div>

        {/* Scene Layer Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle('showGrid')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showGrid
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Floor Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggle('showObstacles')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showObstacles
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Obstacles"
          >
            <Box className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggle('showPath')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showPath
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Computed Path"
          >
            <Route className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggle('showExplored')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showExplored
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Explored Nodes & Frontier"
          >
            <Activity className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggle('showWaypoints')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showWaypoints
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Waypoint Markers"
          >
            <Milestone className="w-4 h-4" />
          </button>

          <button
            onClick={() => onToggle('showAxes')}
            className={`p-1.5 rounded-lg border transition-all ${
              toggles.showAxes
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-dim)]'
            }`}
            title="Toggle Coordinate Axes"
          >
            <Compass className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />

          {/* Screenshot capture */}
          <button
            onClick={onScreenshot}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)]"
            title="Export Scene Image"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)]"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimulationToolbar;
