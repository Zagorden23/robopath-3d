import React, { useState, useEffect } from 'react';
import { Glasses, Info, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export function WebXRManager({ isOpen = false, onClose = () => {} }) {
  const [hasXrSupport, setHasXrSupport] = useState(false);
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSupport() {
      if (typeof window !== 'undefined' && 'xr' in navigator) {
        setHasXrSupport(true);
        try {
          const vr = await navigator.xr.isSessionSupported('immersive-vr');
          setVrSupported(Boolean(vr));
        } catch {
          setVrSupported(false);
        }
        try {
          const ar = await navigator.xr.isSessionSupported('immersive-ar');
          setArSupported(Boolean(ar));
        } catch {
          setArSupported(false);
        }
      } else {
        setHasXrSupport(false);
      }
      setChecking(false);
    }
    checkSupport();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg glass-panel-elevated rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-glass-elevated)] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
              <Glasses className="w-5 h-5 text-[var(--accent-violet)]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-base">
                WebXR Immersive Device Mode
              </h3>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                Hardware detection & spatial runtime verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Status Matrix */}
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">WebXR Device API Runtime</span>
              {hasXrSupport ? (
                <span className="badge badge-green text-[10px]">API Supported</span>
              ) : (
                <span className="badge badge-amber text-[10px]">Unavailable</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Immersive VR Headset Display</span>
              {vrSupported ? (
                <span className="badge badge-green text-[10px]">Headset Connected</span>
              ) : (
                <span className="badge badge-amber text-[10px]">No VR Headset Found</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">Immersive AR Spatial Pass-through</span>
              {arSupported ? (
                <span className="badge badge-green text-[10px]">Spatial AR Ready</span>
              ) : (
                <span className="badge badge-amber text-[10px]">AR Unsupported</span>
              )}
            </div>
          </div>
        </div>

        {/* Educational note on hardware requirements */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Desktop 3D Fallback Active</span>
          </div>
          <p className="leading-relaxed">
            RoboPath uses high-performance Three.js WebGL rendering for all devices. When an
            immersive headset (e.g. Meta Quest via WebXR browser or SteamVR PC connection) is active
            and HTTPS is enabled, spatial stereoscopic rendering is enabled.
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Full 3D orbit, pan, zoom, and kinematic inspection remain fully interactive on this
            desktop screen.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="btn btn-primary btn-sm text-xs">
            Continue with 3D Desktop View
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebXRManager;
