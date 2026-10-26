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
    { name: 'Home', path: '/' },
    { name: '3D Simulator', path: '/simulator' },
    { name: '2D Simulator', path: '/simulator-2d' },
    { name: 'Comparison', path: '/algorithms' },
    { name: 'Experiments', path: '/experiments' },
    { name: 'Analytics', path: '/analytics' },
    ...(isAuthenticated ? [{ name: 'Dashboard', path: '/dashboard' }] : []),
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    if (path === '/simulator' && location.pathname === '/simulator-2d') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 dark-teal-nav border-b border-teal-400/25 shadow-md">
      <div className="container flex items-center justify-between h-14 px-4 md:px-6 max-w-full">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-sky-500 flex items-center justify-center shadow-md shadow-teal-950/50 group-hover:scale-105 transition-transform duration-200">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-lg tracking-tight text-[#fdfaf0]">
                Robo<span className="text-teal-300">Path</span>{' '}
                <span className="text-amber-300">3D</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-teal-400/15 text-teal-200 border border-teal-300/30 hidden sm:inline-block">
                2D + 3D Sync
              </span>
            </div>
            <p className="text-[10px] text-teal-100/75 font-mono tracking-wider uppercase leading-none">
              Interactive Motion Planning Lab
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive(link.path)
                  ? 'bg-[#fdfaf0] text-[#0c353d] font-semibold shadow-sm'
                  : 'text-teal-50/85 hover:text-white hover:bg-teal-400/15'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth / Action Area */}
        <div className="hidden md:flex items-center gap-2.5">
          <Link
            to="/simulator?scenario=random-obstacles"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/40 hover:bg-amber-400/30 transition-all"
            title="Launch synchronized 3D & 2D robotics workspace"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch 3D Lab</span>
          </Link>

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 pr-3 rounded-full bg-teal-950/60 hover:bg-teal-900/70 border border-teal-300/30 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-teal-400 to-sky-500 flex items-center justify-center font-bold text-xs text-white uppercase">
                  {user.name ? user.name[0] : 'U'}
                </div>
                <span className="text-xs font-medium text-[#fdfaf0] max-w-[110px] truncate">
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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-50 hover:bg-teal-400/15 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#fdfaf0] text-[#0c353d] hover:bg-amber-100 transition-colors shadow-sm"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu hamburger */}
        <div className="flex items-center md:hidden">
          <button
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
