import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard,
  Compass,
  Grid,
  Layers,
  History,
  BarChart3,
  BookmarkCheck,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const SIDEBAR_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: '3D Simulator', path: '/simulator', icon: Compass },
  { label: '2D Simulator', path: '/simulator-2d', icon: Grid },
  { label: 'Comparison', path: '/algorithms', icon: Layers },
  { label: 'Experiments', path: '/experiments', icon: History },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Environments', path: '/scenarios', icon: BookmarkCheck },
  { label: 'Profile', path: '/profile', icon: User },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signout, isAuthenticated } = useAuth();
  const isSimulatorRoute =
    location.pathname === '/simulator' || location.pathname === '/simulator-2d';
  const [collapsed, setCollapsed] = useState(isSimulatorRoute);

  const isActive = (path) => {
    if (path === '/simulator' && location.pathname === '/simulator-2d') return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = async () => {
    await signout();
    navigate('/');
  };

  return (
    <aside
      className={`hidden xl:flex flex-col shrink-0 dark-teal-nav border-r border-teal-400/20 select-none transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-52'
      }`}
    >
      <div className="p-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-teal-400/15">
            {!collapsed && (
              <p className="text-[10px] font-mono uppercase tracking-wider text-teal-200/80">
                Workspace
              </p>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand navigation sidebar' : 'Collapse sidebar for wider workspace'}
              className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-400/15 ml-auto"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center ${
                  collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                } py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-[#fdfaf0] text-[#0c353d] font-semibold shadow-sm'
                    : 'text-teal-50/80 hover:text-white hover:bg-teal-400/15'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-teal-700' : 'text-teal-200/85'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {isAuthenticated && (
          <div className="pt-3 border-t border-teal-400/20">
            <button
              type="button"
              onClick={handleLogout}
              title="Log Out"
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
              } py-2.5 rounded-xl text-xs font-medium text-amber-200 hover:text-white hover:bg-red-500/25 transition-all`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Log Out</span>}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AppSidebar;
