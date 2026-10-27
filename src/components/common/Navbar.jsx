import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { SIDEBAR_ITEMS } from './AppSidebar.jsx';
import {
  Compass,
  LayoutDashboard,
  BookmarkCheck,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Play,
  ChevronDown,
  BarChart3,
  History,
  Grid,
  GitCompare,
  Home,
} from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, signout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSignout = async () => {
    setProfileDropdownOpen(false);
    await signout();
    navigate('/');
  };

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    ...(isAuthenticated ? [{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }] : []),
    { name: '3D Simulator', path: '/simulator', icon: Compass },
    { name: '2D Simulator', path: '/simulator-2d', icon: Grid },
    { name: 'Comparison', path: '/algorithms', icon: GitCompare },
    { name: 'Scenarios', path: '/scenarios', icon: BookmarkCheck },
    { name: 'Experiments', path: '/experiments', icon: History },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/simulator' && location.pathname === '/simulator-2d') return false;
    if (path === '/algorithms' && location.pathname === '/comparison') return true;
    if (path === '/scenarios' && location.pathname === '/environments') return true;
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 dark-teal-nav border-b border-teal-400/25 shadow-md">
      <div className="w-full flex items-center justify-between gap-3 h-14 px-4 lg:px-6">
        {/* Left: Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-500 flex items-center justify-center shadow-md shadow-teal-950/50 group-hover:scale-105 transition-transform duration-200">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-base sm:text-lg tracking-tight text-[#fdfaf0] whitespace-nowrap">
                Robo<span className="text-teal-300">Path</span>{' '}
                <span className="text-amber-300">3D</span>
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-teal-400/15 text-teal-200 border border-teal-300/30 hidden xl:inline-block whitespace-nowrap">
                2D + 3D Sync
              </span>
            </div>
            <p className="text-[9px] text-teal-100/75 font-mono tracking-wider uppercase leading-none hidden sm:block whitespace-nowrap">
              Interactive Motion Planning Lab
            </p>
          </div>
        </Link>

        {/* Center: Unified Top Horizontal Navigation Bar */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="hidden md:flex items-center justify-center gap-1 lg:gap-1.5 overflow-x-auto py-1"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#fdfaf0] text-[#0c353d] font-bold shadow-xs'
                    : 'text-teal-50/90 hover:text-white hover:bg-teal-400/15'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    active ? 'text-[#0f766e]' : 'text-teal-300/85'
                  }`}
                />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Desktop Auth / Action Area */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            to="/simulator?scenario=random-obstacles"
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/40 hover:bg-amber-400/30 transition-all whitespace-nowrap"
            title="Launch synchronized 3D & 2D robotics workspace"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch 3D Lab</span>
          </Link>

          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 pr-3 rounded-full bg-teal-950/60 hover:bg-teal-900/70 border border-teal-300/30 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-sky-500 flex items-center justify-center font-bold text-xs text-white uppercase">
                  {user.name ? user.name[0] : 'U'}
                </div>
                <span className="text-xs font-medium text-[#fdfaf0] max-w-[100px] truncate">
                  {user.name?.split(' ')[0] || 'User'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-teal-200" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-[#fdfaf0] text-[#0f1e36] border border-teal-700/25 shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-teal-800/15">
                    <p className="text-sm font-semibold text-[#0f1e36] truncate">{user.name}</p>
                    <p className="text-xs text-[#52677c] truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/dashboard"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <LayoutDashboard className="w-4 h-4 text-teal-600" />
                    <span>Overview Dashboard</span>
                  </Link>

                  <Link
                    to="/simulator-2d"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <Grid className="w-4 h-4 text-amber-600" />
                    <span>2D Grid Simulator</span>
                  </Link>

                  <Link
                    to="/experiments"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <History className="w-4 h-4 text-sky-600" />
                    <span>Experiments & History</span>
                  </Link>

                  <Link
                    to="/analytics"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Performance Analytics</span>
                  </Link>

                  <Link
                    to="/scenarios"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                    <span>Saved Environments</span>
                  </Link>

                  <Link
                    to="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <User className="w-4 h-4 text-teal-600" />
                    <span>Profile & Account</span>
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#2d4258] hover:text-[#0f1e36] hover:bg-teal-500/10"
                  >
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>Preferences</span>
                  </Link>

                  <div className="my-1 border-t border-teal-800/15" />

                  <button
                    type="button"
                    onClick={handleSignout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-500/10 text-left transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/signin"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-50 hover:bg-teal-400/15 transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#fdfaf0] text-[#0c353d] hover:bg-amber-100 transition-colors shadow-sm whitespace-nowrap"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-teal-100 hover:text-white"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden dark-teal-nav border-b border-teal-400/25 px-6 py-4 space-y-3">
          <div className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                    isActive(item.path)
                      ? 'bg-[#fdfaf0] text-[#0c353d] font-semibold'
                      : 'text-teal-100 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-teal-400/20 space-y-2">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignout();
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-300 font-semibold"
              >
                Sign Out
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  to="/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-secondary justify-center btn-sm text-xs"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary justify-center btn-sm text-xs"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
