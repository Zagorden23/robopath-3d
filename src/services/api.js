/**
 * RoboPath 3D — REST API Service Layer
 * Supports Email/Password, Email OTP, Phone OTP, Password Reset,
 * Saved Environments, Simulation Experiment History, and CSV/JSON Export.
 */

let cachedCsrfToken = null;
const LOCAL_RUNS_KEY = 'robopath_3d_experiment_runs_v1';
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function resolveApiUrl(endpoint) {
  if (!endpoint) return API_BASE_URL || '/';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function setCsrfToken(token) {
  cachedCsrfToken = token;
}

export function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/robopath_csrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function apiRequest(endpoint, options = {}) {
  const url = resolveApiUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isMutating) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (data?.csrfToken) {
    setCsrfToken(data.csrfToken);
  }

  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ============================================================================
// AUTHENTICATION API (Email/Password + Email OTP + Phone OTP + Password Reset)
// ============================================================================
export const authApi = {
  async signup(payload) {
    const data = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    return data;
  },

  async signin(payload) {
    const data = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    return data;
  },

  async requestEmailOtp(payload) {
    return apiRequest('/api/auth/email-otp/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyEmailOtp(payload) {
    const data = await apiRequest('/api/auth/email-otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    return data;
  },

  async requestPhoneOtp(payload) {
    return apiRequest('/api/auth/phone-otp/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyPhoneOtp(payload) {
    const data = await apiRequest('/api/auth/phone-otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    return data;
  },

  async forgotPassword(payload) {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resetPassword(payload) {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async signout() {
    try {
      await apiRequest('/api/auth/signout', { method: 'POST' });
    } finally {
      cachedCsrfToken = null;
    }
  },

  async getMe() {
    return apiRequest('/api/auth/me');
  },

  async updateProfile(updates) {
    return apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};

// ============================================================================
// SAVED ENVIRONMENTS & SCENARIOS API (With Client Vault Rehydration)
// ============================================================================
const LOCAL_SCENARIOS_KEY = 'robopath_3d_saved_scenarios_v1';

function getLocalScenarios() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocalScenarios(scenarios) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios.slice(0, 100)));
  } catch {
    // ignore quota errors
  }
}

export const scenariosApi = {
  async list() {
    const localScenarios = getLocalScenarios();
    try {
      const data = await apiRequest('/api/scenarios');
      const serverScenarios = data.scenarios || [];
      const serverNames = new Set(serverScenarios.map((s) => `${s.name}::${s.description || ''}`));
      const unsynced = localScenarios.filter(
        (loc) => loc?.name && !serverNames.has(`${loc.name}::${loc.description || ''}`)
      );
      if (unsynced.length > 0) {
        for (const item of unsynced) {
          try {
            const created = await apiRequest('/api/scenarios', {
              method: 'POST',
              body: JSON.stringify(item),
            });
            if (created?.scenario) {
              serverScenarios.unshift(created.scenario);
            }
          } catch {
            // ignore individual sync errors
          }
        }
      }
      setLocalScenarios(serverScenarios);
      return serverScenarios;
    } catch {
      return localScenarios;
    }
  },

  async get(id) {
    const data = await apiRequest(`/api/scenarios/${id}`);
    return data.scenario;
  },

  async create(scenarioPayload) {
    const data = await apiRequest('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(scenarioPayload),
    });
    if (data.scenario) {
      const existing = getLocalScenarios();
      setLocalScenarios([data.scenario, ...existing]);
    }
    return data.scenario;
  },

  async duplicate(id, customName) {
    const data = await apiRequest(`/api/scenarios/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: customName }),
    });
    if (data.scenario) {
      const existing = getLocalScenarios();
      setLocalScenarios([data.scenario, ...existing]);
    }
    return data.scenario;
  },

  async update(id, updates) {
    const data = await apiRequest(`/api/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (data.scenario) {
      const next = getLocalScenarios().map((s) =>
        String(s.id || s._id) === String(id) ? data.scenario : s
      );
      setLocalScenarios(next);
    }
    return data.scenario;
  },

  async delete(id) {
    const next = getLocalScenarios().filter((s) => String(s.id || s._id) !== String(id));
    setLocalScenarios(next);
    return apiRequest(`/api/scenarios/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// SIMULATION RUN HISTORY, ANALYTICS & EXPORT API
// ============================================================================
const INITIAL_SAMPLE_RUNS = [
  {
    runId: 'run-seed-101',
    scenarioId: 'maze',
    scenarioName: 'Maze Navigation',
    planner: 'ASTAR',
    plannerFamily: 'graph',
    heuristic: 'octile',
    movementMode: 'eight',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 28.4853,
    pathCost: 28.4853,
    nodesExpanded: 84,
    nodesGenerated: 142,
    planningTimeMs: 2.14,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-102',
    scenarioId: 'maze',
    scenarioName: 'Maze Navigation',
    planner: 'DIJKSTRA',
    plannerFamily: 'graph',
    heuristic: 'none',
    movementMode: 'eight',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 28.4853,
    pathCost: 28.4853,
    nodesExpanded: 196,
    nodesGenerated: 240,
    planningTimeMs: 4.38,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 4.5).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-103',
    scenarioId: 'maze',
    scenarioName: 'Maze Navigation',
    planner: 'BFS',
    plannerFamily: 'graph',
    heuristic: 'none',
    movementMode: 'four',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 34.0,
    pathCost: 34.0,
    nodesExpanded: 210,
    nodesGenerated: 245,
    planningTimeMs: 1.92,
    simulatorMode: '2D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-104',
    scenarioId: 'narrow-corridor',
    scenarioName: 'Narrow Corridor',
    planner: 'GREEDY',
    plannerFamily: 'graph',
    heuristic: 'euclidean',
    movementMode: 'eight',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 25.12,
    pathCost: 25.12,
    nodesExpanded: 41,
    nodesGenerated: 78,
    planningTimeMs: 1.15,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-105',
    scenarioId: 'random-obstacles',
    scenarioName: 'Random Obstacle Field',
    planner: 'RRT',
    plannerFamily: 'sampling',
    heuristic: 'none',
    movementMode: 'continuous',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 26.84,
    pathCost: 26.84,
    nodesExpanded: 312,
    nodesGenerated: 312,
    planningTimeMs: 6.45,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-106',
    scenarioId: 'random-obstacles',
    scenarioName: 'Random Obstacle Field',
    planner: 'RRT_STAR',
    plannerFamily: 'sampling',
    heuristic: 'none',
    movementMode: 'continuous',
    pathFound: true,
    resultStatus: 'PATH_FOUND',
    pathLength: 22.95,
    pathCost: 22.95,
    nodesExpanded: 480,
    nodesGenerated: 480,
    planningTimeMs: 11.8,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 1.5).toISOString(),
    isDemoSeed: true,
  },
  {
    runId: 'run-seed-107',
    scenarioId: 'unreachable-goal',
    scenarioName: 'Unreachable Goal Chamber',
    planner: 'ASTAR',
    plannerFamily: 'graph',
    heuristic: 'octile',
    movementMode: 'eight',
    pathFound: false,
    resultStatus: 'NO_PATH',
    pathLength: 0,
    pathCost: 0,
    nodesExpanded: 289,
    nodesGenerated: 289,
    planningTimeMs: 3.1,
    simulatorMode: '3D',
    timestamp: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    isDemoSeed: true,
  },
];

export function getLocalExperimentRuns() {
  if (typeof window === 'undefined') return INITIAL_SAMPLE_RUNS;
  try {
    const raw = localStorage.getItem(LOCAL_RUNS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(INITIAL_SAMPLE_RUNS));
      return INITIAL_SAMPLE_RUNS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SAMPLE_RUNS;
  } catch {
    return INITIAL_SAMPLE_RUNS;
  }
}

export function saveLocalExperimentRun(runRecord) {
  if (typeof window === 'undefined') return runRecord;
  try {
    const existing = getLocalExperimentRuns();
    const record = {
      runId: runRecord.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scenarioId: runRecord.scenarioId || 'custom',
      scenarioName: runRecord.scenarioName || 'Custom Environment',
      planner: String(runRecord.planner || 'ASTAR').toUpperCase(),
      plannerFamily:
        runRecord.planner === 'RRT' || runRecord.planner === 'RRT_STAR' ? 'sampling' : 'graph',
      heuristic: runRecord.heuristic || 'none',
      movementMode: runRecord.movementMode || 'eight',
      pathFound: Boolean(runRecord.pathFound),
      resultStatus:
        runRecord.resultStatus || (runRecord.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
      pathLength: Number(runRecord.pathLength ?? 0),
      pathCost: Number(runRecord.pathCost ?? runRecord.pathLength ?? 0),
      nodesExpanded: Number(runRecord.nodesExpanded ?? 0),
      nodesGenerated: Number(runRecord.nodesGenerated ?? runRecord.nodesExpanded ?? 0),
      planningTimeMs: Number(runRecord.planningTimeMs ?? 0),
      simulatorMode: runRecord.simulatorMode || '3D',
      timestamp: runRecord.timestamp || new Date().toISOString(),
      isDemoSeed: false,
    };
    const next = [record, ...existing].slice(0, 250);
    localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(next));
    return record;
  } catch {
    return runRecord;
  }
}

export const resultsApi = {
  async list() {
    const localRuns = getLocalExperimentRuns();
    try {
      const data = await apiRequest('/api/results');
      const serverRuns = data.results || [];
      const seenIds = new Set(serverRuns.map((r) => r.runId));
      const unsyncedUserRuns = localRuns.filter(
        (r) => !r.isDemoSeed && r.runId && !seenIds.has(r.runId)
      );
      if (unsyncedUserRuns.length > 0) {
        apiRequest('/api/results', {
          method: 'POST',
          body: JSON.stringify({ runs: unsyncedUserRuns.slice(0, 50) }),
        }).catch(() => {});
      }
      if (serverRuns.length === 0) return localRuns;
      const merged = [
        ...serverRuns,
        ...localRuns.filter((r) => !seenIds.has(r.runId)),
      ];
      return merged;
    } catch {
      return localRuns;
    }
  },

  async record(runPayload) {
    const items = Array.isArray(runPayload) ? runPayload : [runPayload];
    const savedLocal = items.map((item) => saveLocalExperimentRun(item));
    try {
      await apiRequest('/api/results', {
        method: 'POST',
        body: JSON.stringify({ runs: savedLocal }),
      });
    } catch {
      // Guest or offline fallback already saved in localStorage
    }
    return savedLocal;
  },

  async delete(runId) {
    if (typeof window !== 'undefined') {
      const next = getLocalExperimentRuns().filter(
        (r) => r.runId !== runId && r.id !== runId
      );
      localStorage.setItem(LOCAL_RUNS_KEY, JSON.stringify(next));
    }
    try {
      await apiRequest(`/api/results/${runId}`, { method: 'DELETE' });
    } catch {
      // Ignore if local-only record
    }
  },

  exportToCsvString(runs = []) {
    const header =
      'runId,scenarioId,planner,heuristic,movementMode,pathFound,resultStatus,pathLength,nodesExpanded,planningTimeMs,timestamp';
    const rows = runs.map((r) => {
      const cols = [
        r.runId || r.id || '',
        r.scenarioId || 'custom',
        r.planner || 'ASTAR',
        r.heuristic || 'none',
        r.movementMode || 'eight',
        Boolean(r.pathFound),
        r.resultStatus || (r.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
        Number(r.pathLength ?? 0).toFixed(4),
        Number(r.nodesExpanded ?? 0),
        Number(r.planningTimeMs ?? 0).toFixed(3),
        r.timestamp || new Date().toISOString(),
      ];
      return cols
        .map((c) => {
          const s = String(c);
          return s.includes(',') || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(',');
    });
    return [header, ...rows].join('\n');
  },

  downloadCsv(runs = [], filename = `robopath-3d-experiments-${Date.now()}.csv`) {
    const csv = this.exportToCsvString(runs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  downloadJson(runs = [], filename = `robopath-3d-experiments-${Date.now()}.json`) {
    const json = JSON.stringify(runs, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
