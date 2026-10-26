import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Compass } from 'lucide-react';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-pulse">
            <Compass className="w-8 h-8 text-[var(--accent-cyan)] animate-spin-slow" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-heading font-semibold text-white">Verifying Robotics Session</p>
          <p className="text-xs text-[var(--text-muted)] font-mono">Authenticating session token...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;
