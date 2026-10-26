import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Save,
  Check,
  Award,
  Sparkles,
} from 'lucide-react';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  const exploredConcepts = user?.exploredConcepts || ['ASTAR', 'EUCLIDEAN', 'DIFF_DRIVE'];
  const completedDemos = user?.completedDemos || [];

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSavedSuccess(false);

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    try {
      setLoading(true);
      await updateUser({ name: name.trim() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 container px-4 md:px-8 py-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel border border-cyan-500/30 text-xs text-cyan-300 mb-2">
          <User className="w-3.5 h-3.5 text-cyan-400" />
          <span>Researcher Profile</span>
        </div>
        <h1 className="text-3xl font-heading font-extrabold text-white tracking-tight">
          Profile & Learning Telemetry
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Manage your researcher identity and track your robotics motion planning mastery.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Profile changes saved successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
          <ShieldCheck className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Account Details */}
        <div className="md:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-subtle)] space-y-4">
            <h3 className="font-heading font-bold text-white text-base">Account Information</h3>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full font-sans opacity-60 cursor-not-allowed"
                />
                <p className="text-[10px] text-[var(--text-dim)] mt-1 font-mono">
                  Email is locked to your university account session.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-sm text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Concept Mastery */}
        <div className="md:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl glass-panel-elevated border border-[var(--border-subtle)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-white text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>Concept Mastery</span>
              </h3>
              <span className="badge badge-cyan text-[10px]">
                {exploredConcepts.length} / 8 Mastered
              </span>
            </div>

            <div className="space-y-2">
              {[
                { id: 'ASTAR', name: 'A* Heuristic Search f(n) = g(n) + h(n)' },
                { id: 'DIJKSTRA', name: 'Dijkstra Priority Relaxation g(v)' },
                { id: 'BFS', name: 'BFS Level Graph Minimization d(v)' },
                { id: 'RRT', name: 'Rapidly-Exploring Random Trees' },
                { id: 'DIFF_DRIVE', name: 'Differential Drive Unicycle Kinematics' },
                { id: 'CSPACE', name: 'Configuration Space Footprint Inflation' },
                { id: 'EUCLIDEAN', name: 'L2 Norm & Octile Distance Metrics' },
                { id: 'TRAJECTORY', name: 'Time-Parameterized Kinematic Scheduling' },
              ].map((c) => {
                const isMastered = exploredConcepts.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-300 font-mono text-[11px]">{c.name}</span>
                    {isMastered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">In Progress</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
