import React, { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  Minimize2,
  Maximize2,
  X,
  Compass,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Move,
  Layers,
  Sparkles,
  Info,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import KatexMath from '../common/KatexMath.jsx';
import { FORMULAS } from '../../engine/mathFormulas.js';

export function FloatingExplanationPanel({
  event = null,
  robotPose = { x: 0, z: 0, theta: 0, v: 0, omega: 0 },
  goal = { x: 0, z: 0 },
  simTimeMs = 0,
  algorithm = 'ASTAR',
  layout = 'floating', // 'floating' | 'dock-right' | 'dock-bottom' | 'expanded'
  onLayoutChange = () => {},
  onHighlightElement = () => {},
  onSeek = () => {},
  recentEvents = [],
  isOpen = true,
  onClose = () => {},
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [techMode, setTechMode] = useState(false);
  const [showDerivation, setShowDerivation] = useState(false);
  const [selectedFormulaKey, setSelectedFormulaKey] = useState(null);

  // Dragging state for floating mode
  const [position, setPosition] = useState({ x: 30, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 30, posY: 80 });
  const panelRef = useRef(null);

  // Update formula key when event changes
  useEffect(() => {
    if (event?.data?.formulaKey) {
      setSelectedFormulaKey(event.data.formulaKey);
    } else if (algorithm === 'ASTAR') {
      setSelectedFormulaKey('astar.est');
    } else if (algorithm === 'DIJKSTRA') {
      setSelectedFormulaKey('dijkstra.relax');
    } else if (algorithm === 'BFS') {
      setSelectedFormulaKey('bfs.level');
    } else if (algorithm === 'RRT') {
      setSelectedFormulaKey('rrt.step');
    }
  }, [event, algorithm]);

  // Handle Dragging
  const handleMouseDown = (e) => {
    if (layout !== 'floating' || isMinimized) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 420, dragStartRef.current.posX + dx)),
        y: Math.max(70, Math.min(window.innerHeight - 300, dragStartRef.current.posY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // Active math concept formula
  const activeFormula =
    (selectedFormulaKey && FORMULAS[selectedFormulaKey]) || FORMULAS['astar.est'];

  // Distance remaining to goal
  const distRemaining = Math.sqrt(
    Math.pow(goal.x - robotPose.x, 2) + Math.pow(goal.z - robotPose.z, 2)
  ).toFixed(2);

  // Compute stage and badges
  const stageName = event?.phase || 'Simulation Active';
  const stageType = event?.type || 'sim.step';

  // Container classes based on selected layout
  let containerStyle = {};
  let layoutClasses = '';

  if (layout === 'floating') {
    containerStyle = {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: isMinimized ? '320px' : '440px',
      maxHeight: isMinimized ? 'auto' : 'calc(100vh - 120px)',
    };
    layoutClasses = 'fixed z-40 shadow-2xl';
  } else if (layout === 'dock-right') {
    layoutClasses =
      'fixed right-0 top-16 bottom-0 w-96 z-40 border-l border-[var(--border-medium)] shadow-2xl';
  } else if (layout === 'dock-bottom') {
    layoutClasses =
      'fixed left-0 right-0 bottom-0 max-h-72 z-40 border-t border-[var(--border-medium)] shadow-2xl';
  } else if (layout === 'expanded') {
    layoutClasses =
      'fixed inset-12 z-50 rounded-2xl border border-cyan-500/40 shadow-2xl overflow-y-auto';
  }

  return (
    <aside
      ref={panelRef}
      style={containerStyle}
      aria-label="RoboPath live intelligence narration and mathematics panel"
      className={`glass-panel-elevated rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-glass-elevated)] backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-200 ${layoutClasses}`}
    >
      {/* HEADER / DRAG BAR */}
      <div
        onMouseDown={handleMouseDown}
        className={`p-3.5 px-4 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/90 border-b border-[var(--border-subtle)] flex items-center justify-between select-none ${
          layout === 'floating' ? 'cursor-move' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shadow-sm shadow-cyan-500/20">
            <BrainCircuit className="w-4 h-4 text-[var(--accent-cyan)] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                RoboPath Live Intelligence
              </h3>
              <span className="badge badge-cyan text-[10px] py-0 px-1.5 font-mono">
                {algorithm}
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Understand every planning decision
            </p>
          </div>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1">
          {/* Layout Switcher Menu */}
          <select
            value={layout}
            onChange={(e) => onLayoutChange(e.target.value)}
            className="text-[10px] font-mono bg-slate-800/80 border border-slate-700 rounded px-1.5 py-0.5 text-[var(--text-secondary)] focus:text-white"
            title="Panel Layout Mode"
          >
            <option value="floating">Floating</option>
            <option value="dock-right">Dock Right</option>
            <option value="dock-bottom">Dock Bottom</option>
            <option value="expanded">Expanded</option>
          </select>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-300"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      {!isMinimized && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. CURRENT STAGE & STATUS */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-[var(--text-muted)] uppercase tracking-wider">
                Current Stage
              </span>
              <span className="badge badge-green text-[10px] py-0.5 px-2">
                {event?.data?.statusText || stageName}
              </span>
            </div>
            <p className="text-white font-medium leading-relaxed">
              {event?.data?.explanation ||
                'Executing collision-aware search across environment space.'}
            </p>
          </div>

          {/* 2. REAL ROBOT KINEMATIC STATE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Robot State
              </span>
              <span className="font-mono text-cyan-300 text-[11px]">
                t = {(simTimeMs / 1000).toFixed(2)}s
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Position (x, z)</p>
                <p className="font-mono text-white text-xs font-semibold">
                  ({robotPose.x.toFixed(2)}, {robotPose.z.toFixed(2)})
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Heading (θ)</p>
                <p className="font-mono text-white text-xs font-semibold">
                  {((robotPose.theta * 180) / Math.PI).toFixed(1)}°
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Dist to Goal</p>
                <p className="font-mono text-emerald-400 text-xs font-semibold">
                  {distRemaining} m
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50">
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Velocity (v)</p>
                <p className="font-mono text-cyan-300 text-xs font-semibold">
                  {(robotPose.v || 0).toFixed(2)} m/s
                </p>
              </div>
            </div>
          </div>

          {/* 3. PLANNING DECISION: WHY THIS ROUTE? */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Why This Route?</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              {event?.data?.whyThisRoute ||
                (algorithm === 'ASTAR'
                  ? 'A* balances accumulated travel cost g(n) with the admissible heuristic h(n), avoiding obstacles by inflating obstacle geometries with the robot’s physical footprint radius.'
                  : algorithm === 'DIJKSTRA'
                  ? 'Dijkstra expands cells strictly in order of lowest accumulated cost g(v), guaranteeing global optimality across weighted terrain.'
                  : algorithm === 'BFS'
                  ? 'BFS treats all edges as having uniform unit cost, finding the route with the fewest grid steps.'
                  : 'RRT rapidly branches random exploratory trees into high-dimensional free space to connect start and goal around obstacles.')}
            </p>

            {/* Real computed values if available */}
            {event?.data?.costValues && (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-cyan-500/20 text-center font-mono text-[11px]">
                <div className="bg-slate-900/60 p-1.5 rounded">
                  <span className="text-slate-400 block text-[9px]">g(n) Cost</span>
                  <span className="text-cyan-300 font-bold">
                    {event.data.costValues.g?.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded">
                  <span className="text-slate-400 block text-[9px]">h(n) Est</span>
                  <span className="text-indigo-300 font-bold">
                    {event.data.costValues.h?.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded">
                  <span className="text-slate-400 block text-[9px]">f(n) Total</span>
                  <span className="text-emerald-300 font-bold">
                    {event.data.costValues.f?.toFixed(2) ?? '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. MATHEMATICS BEHIND THE MOTION (KaTeX) */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold text-xs text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Mathematics Behind the Motion
              </span>

              {/* Simple vs Technical explanation toggle */}
              <button
                onClick={() => setTechMode(!techMode)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 transition-colors"
              >
                {techMode ? 'Technical View' : 'Simple View'}
              </button>
            </div>

            {/* LaTeX Equation */}
            <div className="p-2 rounded-lg bg-slate-950/70 border border-indigo-500/30 text-center text-white overflow-x-auto shadow-inner">
              <KatexMath latex={activeFormula.latex} block />
            </div>

            {/* Explanation text */}
            <p className="text-slate-300 text-xs leading-relaxed">
              {techMode ? activeFormula.technical : activeFormula.simple}
            </p>

            {/* Derivation toggle */}
            {activeFormula.derivation && (
              <div>
                <button
                  onClick={() => setShowDerivation(!showDerivation)}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showDerivation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showDerivation ? 'Hide Derivation' : 'Show Mathematical Derivation'}</span>
                </button>
                {showDerivation && (
                  <div className="mt-1.5 p-2.5 rounded bg-slate-900/80 border border-indigo-500/20 text-[11px] text-slate-300 font-mono leading-relaxed">
                    {activeFormula.derivation}
                  </div>
                )}
              </div>
            )}

            {/* Interactive scene highlight */}
            <button
              onClick={() => onHighlightElement(activeFormula.highlightType || 'ASTAR_VECTORS')}
              className="btn btn-secondary btn-sm w-full justify-center text-xs text-indigo-300 hover:border-indigo-400"
            >
              Highlight Related Elements in 3D Scene
            </button>
          </div>

          {/* 5. WHAT HAPPENS NEXT? */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px]">
            <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block text-[10px] uppercase font-mono tracking-wider">
                What Happens Next
              </span>
              <p className="text-slate-400">
                {event?.data?.whatNext ||
                  'The mobile robot will continue steering along the trajectory towards the next path waypoint.'}
              </p>
            </div>
          </div>

          {/* 6. RECENT TIMELINE EVENT SCRUBBER */}
          {recentEvents.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Simulation Event Log (Click to Jump)
              </span>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {recentEvents.slice(-5).map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => onSeek(evt.t)}
                    className="w-full text-left p-1.5 rounded bg-slate-900/40 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30 flex items-center justify-between text-[11px] transition-colors"
                  >
                    <span className="text-slate-300 truncate max-w-[260px]">
                      {evt.data?.statusText || evt.phase}
                    </span>
                    <span className="font-mono text-[10px] text-cyan-400">
                      {(evt.t / 1000).toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export default FloatingExplanationPanel;
