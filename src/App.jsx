import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SimulationProvider } from './context/SimulationContext.jsx';
import Navbar from './components/common/Navbar.jsx';
import AppSidebar from './components/common/AppSidebar.jsx';
import Footer from './components/common/Footer.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';

// Load each workspace independently so the 3D renderer, charts, and simulators
// are only downloaded when their route is opened.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const SigninPage = lazy(() => import('./pages/SigninPage.jsx'));
const SignupPage = lazy(() => import('./pages/SignupPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage.jsx'));
const Simulator2DPage = lazy(() => import('./pages/Simulator2DPage.jsx'));
const AlgorithmsPage = lazy(() => import('./pages/AlgorithmsPage.jsx'));
const ExperimentsPage = lazy(() => import('./pages/ExperimentsPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

function RouteLoadingFallback() {
  return (
    <div
      className="flex flex-1 items-center justify-center min-h-[60vh]"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-[var(--text-muted)]">Loading workspace…</span>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const isLandingOrAuth =
    location.pathname === '/' ||
    location.pathname === '/signin' ||
    location.pathname === '/signup';
  const isFullViewport3D = location.pathname === '/simulator';

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-darkest)] text-[var(--text-primary)]">
      <Navbar />
      <div className="flex-1 flex">
        {!isLandingOrAuth && <AppSidebar />}
        <main className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SigninPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/simulator-2d" element={<Simulator2DPage />} />
            <Route
              path="/algorithms"
              element={
                <ProtectedRoute>
                  <AlgorithmsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comparison"
              element={
                <ProtectedRoute>
                  <AlgorithmsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/experiments"
              element={
                <ProtectedRoute>
                  <ExperimentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Public simulator routes support the explicit guest demo; private workspace routes require a session. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scenarios"
              element={
                <ProtectedRoute>
                  <ScenariosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/environments"
              element={
                <ProtectedRoute>
                  <ScenariosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      {!isFullViewport3D && <Footer />}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SimulationProvider>
          <AppLayout />
        </SimulationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
