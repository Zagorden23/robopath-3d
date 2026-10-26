import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, Play, AlertTriangle } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-4xl font-heading font-extrabold text-white">404 — Path Blocked</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          The requested coordinate trajectory or URL route does not exist in the RoboPath spatial map.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/" className="btn btn-secondary btn-sm text-xs">
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Link>

        <Link to="/simulator" className="btn btn-primary btn-sm text-xs">
          <Compass className="w-4 h-4" />
          <span>Launch Simulator</span>
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
