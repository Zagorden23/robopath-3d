import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, BookOpen, ShieldCheck, Terminal, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="glass-panel-elevated border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] py-12 text-sm text-[var(--text-muted)] mt-auto">
      <div className="container px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[var(--border-subtle)]">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <Compass className="w-5 h-5 text-[var(--accent-cyan)]" />
              </div>
              <span className="font-heading font-bold text-lg text-white">
                Robo<span className="text-[var(--accent-cyan)]">Path</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              An advanced, interactive 3D robot motion planning simulator and university learning
              platform. Plan smarter, navigate safely, and understand every algorithmic decision in real time.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-dim)]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Simulation Engine v1.0 • Client-side WebGL</span>
            </div>
          </div>

          {/* Column 2: Navigation & Tools */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-white text-sm tracking-wide">
              Simulator & Labs
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/simulator" className="hover:text-white transition-colors">
                  Interactive 3D Workspace
                </Link>
              </li>
              <li>
                <Link
                  to="/simulator?demo=demo-a-dijkstra-vs-astar"
                  className="hover:text-white transition-colors"
                >
                  Demo A: Dijkstra vs. A*
                </Link>
              </li>
              <li>
                <Link
                  to="/simulator?demo=demo-b-bfs-vs-dijkstra"
                  className="hover:text-white transition-colors"
                >
                  Demo B: BFS vs. Weighted Terrain
                </Link>
              </li>
              <li>
                <Link
                  to="/simulator?demo=demo-c-rrt-continuous"
                  className="hover:text-white transition-colors"
                >
                  Demo C: Continuous-Space RRT
                </Link>
              </li>
              <li>
                <Link to="/algorithms" className="hover:text-white transition-colors">
                  Algorithm Laboratory
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Mathematical Concepts */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-white text-sm tracking-wide">
              Mathematics & Theory
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="font-mono text-cyan-400">f(n) = g(n) + h(n)</span> — A* Admissibility
              </li>
              <li>
                <span className="font-mono text-indigo-400">g(v) = min(g(v), g(u)+c)</span> — Relaxation
              </li>
              <li>
                <span className="font-mono text-emerald-400">v = r(ω_R + ω_L)/2</span> — Differential Drive
              </li>
              <li>
                <span className="font-mono text-amber-400">d(p, q)</span> — Octile / Euclidean Metrics
              </li>
              <li>
                <span className="font-mono text-sky-400">C-Space</span> — Footprint Obstacle Inflation
              </li>
            </ul>
          </div>

          {/* Column 4: Platform & Security */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-white text-sm tracking-wide">
              Security & Technology
            </h4>
            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>HttpOnly & CSRF Cookie Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Zero Cloud LLM Dependency</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Academic & University Curriculum Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} RoboPath Robotics Laboratory. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-[var(--text-dim)]">
            Built with React, Three.js, KaTeX, and Express.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
