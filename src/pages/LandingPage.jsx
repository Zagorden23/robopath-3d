import React, { useRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import {
  Compass,
  Play,
  Layers,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Sparkles,
  Glasses,
  Cpu,
  CheckCircle2,
  LogIn,
  UserPlus,
  BarChart3,
  Grid as GridIcon,
} from 'lucide-react';
import KatexMath from '../components/common/KatexMath.jsx';
import RobotMesh from '../components/scene/RobotMesh.jsx';
import ObstacleMesh from '../components/scene/ObstacleMesh.jsx';
import PathMesh from '../components/scene/PathMesh.jsx';

// Animated continuous patrol robot for the landing page laboratory preview
function HeroPatrollingRobot({ path }) {
  const [pose, setPose] = useState({
    x: path[0].x,
    z: path[0].z,
    theta: Math.atan2(path[1].z - path[0].z, path[1].x - path[0].x),
    v: 1.4,
  });

  const progressRef = useRef(0);
  const forwardRef = useRef(true);

  const { segments, totalDist } = useMemo(() => {
    let dist = 0;
    const segs = [];
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const len = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      segs.push({ p1, p2, len, startDist: dist, endDist: dist + len });
      dist += len;
    }
    return { segments: segs, totalDist: dist };
  }, [path]);

  useFrame((_, delta) => {
    const speed = 1.35;
    const dir = forwardRef.current ? 1 : -1;
    progressRef.current += dir * speed * delta;

    if (progressRef.current >= totalDist) {
      progressRef.current = totalDist;
      forwardRef.current = false;
    } else if (progressRef.current <= 0) {
      progressRef.current = 0;
      forwardRef.current = true;
    }

    const currentDist = progressRef.current;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (currentDist >= seg.startDist && currentDist <= seg.endDist) {
        const segFrac = seg.len > 0 ? (currentDist - seg.startDist) / seg.len : 0;
        const x = seg.p1.x + (seg.p2.x - seg.p1.x) * segFrac;
        const z = seg.p1.z + (seg.p2.z - seg.p1.z) * segFrac;
        let theta = Math.atan2(seg.p2.z - seg.p1.z, seg.p2.x - seg.p1.x);
        if (!forwardRef.current) {
          theta = Math.atan2(seg.p1.z - seg.p2.z, seg.p1.x - seg.p2.x);
        }
        setPose({ x, z, theta, v: speed });
        break;
      }
    }
  });

  return <RobotMesh pose={pose} radius={0.45} color="#0ea5e9" />;
}

// Mini 3D Laboratory Hero Scene
function Hero3DScene() {
  const samplePath = useMemo(
    () => [
      { x: -5.0, z: -3.5 },
      { x: -3.2, z: -2.0 },
      { x: -1.2, z: -0.8 },
      { x: 0.6, z: 0.4 },
      { x: 2.2, z: 1.8 },
      { x: 4.5, z: 3.5 },
    ],
    []
  );

  const obstacles = [
    { id: 'h-obs1', shape: 'box', x: -1.2, z: 1.8, width: 2.2, depth: 2.2, height: 1.6, color: '#0d9488' },
    { id: 'h-obs2', shape: 'cylinder', x: 2.0, z: -1.4, radius: 1.1, height: 1.8, color: '#0284c7' },
    { id: 'h-obs3', shape: 'box', x: -3.6, z: 0.6, width: 1.5, depth: 1.5, height: 1.4, color: '#d97706' },
  ];

  return (
    <div className="w-full h-full min-h-[460px] relative rounded-3xl overflow-hidden glass-panel border border-[var(--border-medium)] shadow-2xl">
      <Canvas shadows camera={{ position: [0, 8, 11], fov: 45 }}>
        <color attach="background" args={['#f4efda']} />
        <ambientLight intensity={0.85} color="#fffbeb" />
        <directionalLight position={[8, 15, 8]} intensity={1.35} color="#ffffff" castShadow />
        <directionalLight position={[-8, 6, -8]} intensity={0.45} color="#0d9488" />

        <OrbitControls
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.55}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 4}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#fbf7e8" roughness={0.9} />
        </mesh>

        <Grid
          position={[0, 0, 0]}
          args={[14, 14]}
          cellSize={0.5}
          sectionSize={2.0}
          cellColor="#cbd5e1"
          sectionColor="#0d9488"
          fadeDistance={25}
        />

        {obstacles.map((obs) => (
          <ObstacleMesh key={obs.id} obstacle={obs} />
        ))}

        <PathMesh
          path={samplePath}
          start={samplePath[0]}
          goal={samplePath[samplePath.length - 1]}
          showPath={true}
          showWaypoints={true}
          pathColor="#059669"
        />

        <HeroPatrollingRobot path={samplePath} />
      </Canvas>

      {/* Floating telemetry tag */}
      <div className="absolute bottom-4 left-4 p-2.5 px-3.5 rounded-xl glass-panel-elevated border border-[var(--border-subtle)] text-xs font-mono flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[#0f1e36] font-semibold">Synchronized 2D & 3D Motion Planner</span>
        <span className="text-teal-700 font-bold">6 Verified Algorithms</span>
      </div>
    </div>
  );
}

const SIX_ALGORITHMS = [
  {
    name: 'Breadth-First Search (BFS)',
    id: 'BFS',
    badge: 'Unweighted Shortest Hops',
    formula: 'd(v) = d(u) + 1',
    summary:
      'Explores the grid level-by-level using a FIFO queue. Guarantees the fewest steps in unweighted cardinal grids without using a distance heuristic.',
  },
  {
    name: "Dijkstra's Algorithm",
    id: 'DIJKSTRA',
    badge: 'Uniform-Cost Optimal',
    formula: 'g(v) = \\min(g(v), g(u) + c(u,v))',
    summary:
      'Expands states strictly by minimum cumulative cost g(n) via a binary heap priority queue. Guarantees shortest path across cardinal and diagonal moves.',
  },
  {
    name: 'A* (A-Star) Search',
    id: 'ASTAR',
    badge: 'Heuristic Optimal',
    formula: 'f(n) = g(n) + h(n)',
    summary:
      'Combines exact path cost g(n) with an admissible heuristic h(n) (Manhattan, Euclidean, or Octile) to focus search toward the goal while preserving optimality.',
  },
  {
    name: 'Greedy Best-First Search',
    id: 'GREEDY',
    badge: 'Fast Heuristic Driven',
    formula: 'f(n) = h(n)',
    summary:
      'Prioritizes nodes strictly by estimated distance to the goal h(n). Expands far fewer states in open spaces, trading shortest-path optimality for speed.',
  },
  {
    name: 'RRT (Rapidly-Exploring Random Tree)',
    id: 'RRT',
    badge: 'Sampling-Based Tree',
    formula: 'q_{\\text{new}} = q_{\\text{near}} + \\Delta q',
    summary:
      'Incrementally grows a space-filling tree by sampling random configurations and validating collision-free segments toward the goal region.',
  },
  {
    name: 'RRT* (Optimal RRT)',
    id: 'RRT_STAR',
    badge: 'Asymptotically Optimal',
    formula: 'c(q_{\\text{new}}) = \\min_{q \\in X_{\\text{near}}} (c(q) + \\|q - q_{\\text{new}}\\|)',
    summary:
      'Extends RRT with local neighborhood parent selection and tree rewiring within a shrinking ball radius to converge toward shorter, smoother paths.',
  },
];

export function LandingPage() {
  return (
    <div className="flex-1 flex flex-col space-y-24 pb-20">
      {/* 1. CINEMATIC HERO SECTION */}
      <section className="container px-4 md:px-8 pt-12 md:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-xs text-amber-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Interactive 3D & 2D Robot Motion Planning Platform</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight leading-[1.08] text-white">
                RoboPath <span className="text-gradient">3D</span>
              </h1>
              <p className="text-xl sm:text-2xl font-heading font-semibold text-cyan-300">
                Plan Smarter. Navigate Safely. Visualize Path Planning.
              </p>
            </div>

            <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              An interactive robot motion-planning platform that brings search algorithms to life
              through immersive 3D visualization and measurable simulation results.
            </p>

            {/* Required 4 Primary CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link to="/simulator" className="btn btn-primary btn-lg shadow-glow-cyan text-sm">
                <Compass className="w-5 h-5" />
                <span>Launch Simulator</span>
              </Link>

              <a
                href="#features-overview"
                className="btn btn-secondary btn-lg text-sm text-[var(--accent-cyan)] border-cyan-500/30"
              >
                <Layers className="w-4 h-4" />
                <span>Explore Features</span>
              </a>

              <Link
                to="/signin"
                className="btn btn-secondary btn-lg text-sm text-white border-slate-700 hover:border-cyan-400"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>

              <Link
                to="/signup"
                className="btn btn-ghost btn-lg text-sm text-amber-300 hover:text-amber-200 border border-amber-500/30"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </Link>
            </div>

            {/* Key Value Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-[var(--border-subtle)] text-xs font-mono">
              <div>
                <p className="text-white font-bold text-lg font-heading">6 Planners</p>
                <p className="text-[var(--text-muted)]">BFS, Dijkstra, A*, Greedy, RRT, RRT*</p>
              </div>
              <div>
                <p className="text-emerald-400 font-bold text-lg font-heading">3D + 2D Lab</p>
                <p className="text-[var(--text-muted)]">Synchronized Simulators</p>
              </div>
              <div>
                <p className="text-cyan-400 font-bold text-lg font-heading">Live KaTeX</p>
                <p className="text-[var(--text-muted)]">Real-Time Math Narration</p>
              </div>
              <div>
                <p className="text-amber-400 font-bold text-lg font-heading">CSV & JSON</p>
                <p className="text-[var(--text-muted)]">Reproducible Benchmarks</p>
              </div>
            </div>
          </div>

          {/* Right 3D Scene Column */}
          <div className="lg:col-span-5 h-[480px]">
            <Hero3DScene />
          </div>
        </div>
      </section>

      {/* 2. SOOTHING LEMON-CREAM ENGINEERING SURFACE SECTION */}
      <section id="features-overview" className="container px-4 md:px-8">
        <div
          className="p-8 md:p-12 rounded-3xl border shadow-2xl space-y-10"
          style={{
            background: 'linear-gradient(135deg, #fdfaf0 0%, #f7f2df 100%)',
            borderColor: '#e5dcc0',
            color: '#0f1e36',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider"
                style={{ backgroundColor: '#0d948818', color: '#0d4f56', border: '1px solid #0d948840' }}
              >
                Engineering & Pedagogy Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-heading font-extrabold" style={{ color: '#0f1e36' }}>
                Why Interactive 3D Path-Planning Visualization Matters
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                Traditional 2D grid diagrams hide robot geometry, elevation, camera perspective, and
                real-time kinematic state transitions. RoboPath 3D preserves full 2D grid precision while
                elevating every experiment into an inspectable 3D laboratory.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/simulator-2d"
                className="px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2 transition-all"
                style={{ backgroundColor: '#0f1e36', color: '#fdfaf0' }}
              >
                <GridIcon className="w-4 h-4 text-teal-400" />
                <span>Open Classic 2D Lab</span>
              </Link>
              <Link
                to="/simulator"
                className="px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2 transition-all"
                style={{ backgroundColor: '#0d9488', color: '#ffffff' }}
              >
                <Compass className="w-4 h-4" />
                <span>Open 3D Simulator</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Interactive Environment Builder',
                desc: 'Draw walls, drag rectangular obstacle regions, generate mazes, or spawn dynamic moving obstacles with automatic replanning.',
                icon: Layers,
              },
              {
                step: '02',
                title: '6 Deterministic & Sampling Planners',
                desc: 'Compare BFS, Dijkstra, A*, Greedy Best-First, RRT, and RRT* with contextual heuristics and 4-way/8-way movement.',
                icon: Cpu,
              },
              {
                step: '03',
                title: 'Collision & Footprint Safety',
                desc: 'Prevent corner-cutting on diagonal moves and verify continuous line-of-sight segments against obstacle boundaries.',
                icon: ShieldCheck,
              },
              {
                step: '04',
                title: 'Measurable Analytics & Export',
                desc: 'Track planning latency, expanded states, path length, and success rates across scenarios with one-click CSV & JSON export.',
                icon: BarChart3,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl space-y-3 transition-all shadow-sm"
                  style={{
                    backgroundColor: '#ffffffd9',
                    border: '1px solid #e2d9be',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm" style={{ color: '#0d9488' }}>
                      {item.step}
                    </span>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#0f1e3610', color: '#0f1e36' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: '#0d9488' }} />
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-base" style={{ color: '#0f1e36' }}>
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. SIX SUPPORTED PLANNING ALGORITHMS */}
      <section className="container px-4 md:px-8">
        <div className="p-8 md:p-12 rounded-3xl glass-panel-elevated border border-[var(--border-medium)] bg-gradient-to-b from-slate-900/60 to-slate-950/80 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="badge badge-green mb-2">6 Verified Motion Planners</span>
              <h2 className="text-3xl font-heading font-bold text-white">
                Supported Path-Planning Algorithms
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Genuine client-side execution with honest distinction between grid-search states and sampling-tree nodes.
              </p>
            </div>
            <Link to="/algorithms" className="btn btn-secondary btn-sm text-xs">
              <span>Compare All 6 Planners Head-to-Head</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SIX_ALGORITHMS.map((alg) => (
              <div
                key={alg.id}
                className="p-5 rounded-2xl bg-slate-900/75 border border-[var(--border-subtle)] hover:border-cyan-500/40 transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading font-bold text-white text-sm">{alg.name}</h4>
                    <span className="badge badge-cyan text-[9px] shrink-0">{alg.badge}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs font-mono text-cyan-300 overflow-x-auto">
                    <KatexMath latex={alg.formula} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {alg.summary}
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80">
                  <span>ID: {alg.id}</span>
                  <Link
                    to={`/simulator?algorithm=${alg.id}`}
                    className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Run in 3D</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. THE SIGNATURE FEATURE HIGHLIGHT & TECH STACK */}
      <section className="container px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="badge badge-violet">Real-Time Mathematical Narration</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white leading-tight">
              Floating Live Intelligence & MERN Stack Telemetry
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              RoboPath 3D synchronizes its floating intelligence window with the simulation timeline,
              displaying the active algorithm state, cost vectors, kinematics, and KaTeX derivations while
              persisting experiments to your MongoDB & Express workspace.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>React 19 + Three.js + React Three Fiber + Drei + Recharts + Framer Motion</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Node.js + Express + MongoDB/Mongoose + Email OTP (SMTP) + Phone OTP (Twilio)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Explicit failure classification: distinguishes NO_PATH vs SEARCH_LIMIT_REACHED</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dynamic moving obstacles with real-time path collision detection & replanning</span>
              </li>
            </ul>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                to="/simulator?demo=demo-a-dijkstra-vs-astar"
                className="btn btn-primary btn-sm text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Test Live Intelligence Now</span>
              </Link>
              <Link to="/experiments" className="btn btn-secondary btn-sm text-xs">
                <span>View Experiments & Export</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 p-6 rounded-3xl glass-panel-elevated border border-cyan-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-cyan-400" />
                <span className="font-heading font-bold text-xs uppercase text-white">
                  RoboPath Live Intelligence Preview
                </span>
              </div>
              <span className="badge badge-green text-[10px]">A* Node Expansion</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Decision Stage</span>
              <p className="text-white font-medium">
                Evaluating candidate node near central obstacle partition.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-center">
              <KatexMath latex="f(n) = g(n) + h(n) = 4.82 + 3.41 = 8.23" block />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Because A* estimates total path cost through node n to be 8.23, it expands ahead of
              sub-optimal perimeter cells, bypassing high-cost detours.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
