/**
 * Grid environment editor.
 *
 * Owns the editable state of a planning environment: dimensions, blocked
 * cells, start and goal. Every mutation is expressed as a pure function
 * returning a NEW state, which makes undo/redo trivial and keeps React
 * rendering predictable.
 *
 * The editor works directly on cell indices. It does not know about 2D or 3D
 * rendering — both the 2D simulator and the 3D simulator consume the same
 * state, so the two views can never drift apart.
 */

import { createRng } from '../rng.js';

export const MIN_CELLS = 4;
export const MAX_CELLS = 120;

/**
 * @typedef {object} GridEnvironmentState
 * @property {number} rows
 * @property {number} cols
 * @property {number} cellSize
 * @property {boolean[]} blocked    length rows*cols
 * @property {number[]} weights     length rows*cols, traversal cost multiplier
 * @property {{row:number,col:number}} start
 * @property {{row:number,col:number}} goal
 * @property {string} name
 */

export function createEnvironmentState(overrides = {}) {
  const rows = clampInt(overrides.rows ?? 20, MIN_CELLS, MAX_CELLS);
  const cols = clampInt(overrides.cols ?? 20, MIN_CELLS, MAX_CELLS);
  const cellSize = clampNumber(overrides.cellSize ?? 0.5, 0.1, 10);
  const total = rows * cols;

  const blocked = new Array(total).fill(false);
  if (Array.isArray(overrides.blocked)) {
    for (let i = 0; i < Math.min(total, overrides.blocked.length); i += 1) {
      blocked[i] = Boolean(overrides.blocked[i]);
    }
  }

  const weights = new Array(total).fill(1);
  if (Array.isArray(overrides.weights)) {
    for (let i = 0; i < Math.min(total, overrides.weights.length); i += 1) {
      const w = Number(overrides.weights[i]);
      weights[i] = Number.isFinite(w) && w > 0 ? w : 1;
    }
  }

  const start = normaliseCell(overrides.start, rows, cols, { row: 0, col: 0 });
  const goal = normaliseCell(overrides.goal, rows, cols, { row: rows - 1, col: cols - 1 });

  // Endpoints must never rest inside a blocked cell.
  blocked[start.row * cols + start.col] = false;
  blocked[goal.row * cols + goal.col] = false;

  return {
    name: typeof overrides.name === 'string' ? overrides.name.slice(0, 80) : 'Untitled environment',
    rows,
    cols,
    cellSize,
    blocked,
    weights,
    start,
    goal,
  };
}

export function cloneEnvironmentState(state) {
  return {
    ...state,
    blocked: [...state.blocked],
    weights: [...state.weights],
    start: { ...state.start },
    goal: { ...state.goal },
  };
}

export function environmentToSpec(state) {
  return {
    name: state.name,
    rows: state.rows,
    cols: state.cols,
    cellSize: state.cellSize,
    blocked: [...state.blocked],
    weights: [...state.weights],
    start: { ...state.start },
    goal: { ...state.goal },
  };
}

export function indexOf(state, row, col) {
  return row * state.cols + col;
}

export function isBlocked(state, row, col) {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return true;
  return state.blocked[indexOf(state, row, col)];
}

/* ------------------------------------------------------------------ */
/* Obstacle editing                                                    */
/* ------------------------------------------------------------------ */

/** Paint a single cell as blocked or free. */
export function setCellBlocked(state, row, col, blocked) {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;

  const idx = indexOf(state, row, col);
  if (state.blocked[idx] === blocked) return state;

  const next = cloneEnvironmentState(state);
  next.blocked[idx] = blocked;

  // Endpoints are never allowed to sit inside an obstacle. Rather than
  // collapsing one endpoint onto the other, relocate it to the closest
  // genuinely free cell so the environment stays meaningful.
  if (blocked) {
    if (next.start.row === row && next.start.col === col) {
      next.start = findFreeCellNear(next, { row, col }, next.goal);
    }
    if (next.goal.row === row && next.goal.col === col) {
      next.goal = findFreeCellNear(next, { row, col }, next.start);
    }
  }
  return next;
}

/** Paint a rectangular region of cells. */
export function setRegionBlocked(state, r0, c0, r1, c1, blocked) {
  const minRow = Math.max(0, Math.min(r0, r1));
  const maxRow = Math.min(state.rows - 1, Math.max(r0, r1));
  const minCol = Math.max(0, Math.min(c0, c1));
  const maxCol = Math.min(state.cols - 1, Math.max(c0, c1));

  const next = cloneEnvironmentState(state);
  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) {
      next.blocked[indexOf(next, r, c)] = blocked;
    }
  }

  if (blocked) {
    if (isBlocked(next, next.start.row, next.start.col)) {
      next.start = findFreeCellNear(next, next.start, next.goal);
    }
    if (isBlocked(next, next.goal.row, next.goal.col)) {
      next.goal = findFreeCellNear(next, next.goal, next.start);
    }
  }
  return next;
}

/** Remove every obstacle from the environment. */
export function clearObstacles(state) {
  const next = cloneEnvironmentState(state);
  next.blocked = new Array(state.rows * state.cols).fill(false);
  return next;
}

/**
 * Scatter random obstacles at a given density (0..1).
 * Endpoints are always left free so the environment stays solvable
 * unless the user deliberately blocks the goal.
 */
export function generateRandomObstacles(state, density = 0.2, seed = 1) {
  const rng = createRng(seed >>> 0 || 1);
  const ratio = clampNumber(density, 0, 0.85);
  const next = cloneEnvironmentState(state);

  const total = state.rows * state.cols;
  const target = Math.floor(total * ratio);

  let placed = 0;
  let guard = 0;
  while (placed < target && guard < total * 40) {
    guard += 1;
    const row = rng.int(state.rows);
    const col = rng.int(state.cols);
    const idx = indexOf(next, row, col);
    if (next.blocked[idx]) continue;

    // Keep a small clearance around the endpoints.
    if (
      Math.abs(row - next.start.row) + Math.abs(col - next.start.col) <= 1 ||
      Math.abs(row - next.goal.row) + Math.abs(col - next.goal.col) <= 1
    ) {
      continue;
    }

    next.blocked[idx] = true;
    placed += 1;
  }

  return next;
}

/**
 * Generate a perfect maze using a randomised depth-first search.
 *
 * The maze is built on an odd-sized lattice: cells at odd coordinates are
 * rooms and the cells between them are walls. The result is resized to the
 * environment's dimensions.
 */
export function generateMaze(state, seed = 7) {
  const rng = createRng(seed >>> 0 || 7);
  const rows = state.rows;
  const cols = state.cols;

  // Odd lattice dimensions guarantee walls between rooms.
  const mazeRows = rows % 2 === 1 ? rows : rows - 1;
  const mazeCols = cols % 2 === 1 ? cols : cols - 1;
  if (mazeRows < 3 || mazeCols < 3) return cloneEnvironmentState(state);

  const lattice = new Array(mazeRows * mazeCols).fill(1); // 1 = wall
  const visited = new Array(mazeRows * mazeCols).fill(false);
  const stack = [];

  const carve = (row, col) => {
    const idx = row * mazeCols + col;
    lattice[idx] = 0;
    visited[idx] = true;
  };

  carve(1, 1);
  stack.push({ row: 1, col: 1 });

  const directions = [
    { dr: -2, dc: 0 },
    { dr: 2, dc: 0 },
    { dr: 0, dc: -2 },
    { dr: 0, dc: 2 },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = [];

    for (const dir of directions) {
      const nextRow = current.row + dir.dr;
      const nextCol = current.col + dir.dc;
      if (nextRow < 1 || nextRow >= mazeRows - 1 || nextCol < 1 || nextCol >= mazeCols - 1) {
        continue;
      }
      if (visited[nextRow * mazeCols + nextCol]) continue;
      candidates.push({ nextRow, nextCol, dir });
    }

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const choice = candidates[rng.int(candidates.length)];
    const wallRow = current.row + choice.dir.dr / 2;
    const wallCol = current.col + choice.dir.dc / 2;
    lattice[wallRow * mazeCols + wallCol] = 0;
    carve(choice.nextRow, choice.nextCol);
    stack.push({ row: choice.nextRow, col: choice.nextCol });
  }

  const next = cloneEnvironmentState(state);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const inLattice = r < mazeRows && c < mazeCols;
      next.blocked[indexOf(next, r, c)] = inLattice ? lattice[r * mazeCols + c] === 1 : true;
    }
  }

  // Place the endpoints on free cells.
  next.start = findFreeCell(next, next.start, { row: 1, col: 1 });
  next.goal = findFreeCell(next, next.goal, { row: mazeRows - 2, col: mazeCols - 2 });
  next.blocked[indexOf(next, next.start.row, next.start.col)] = false;
  next.blocked[indexOf(next, next.goal.row, next.goal.col)] = false;

  return next;
}

/* ------------------------------------------------------------------ */
/* Endpoint editing                                                    */
/* ------------------------------------------------------------------ */

export function setStart(state, row, col) {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;
  if (isBlocked(state, row, col)) return state;
  const next = cloneEnvironmentState(state);
  next.start = { row, col };
  return next;
}

export function setGoal(state, row, col) {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;
  if (isBlocked(state, row, col)) return state;
  const next = cloneEnvironmentState(state);
  next.goal = { row, col };
  return next;
}

export function swapEndpoints(state) {
  const next = cloneEnvironmentState(state);
  const temp = next.start;
  next.start = { ...next.goal };
  next.goal = temp;
  return next;
}

/** Move both endpoints to random free cells. */
export function randomizeEndpoints(state, seed = 3) {
  const rng = createRng(seed >>> 0 || 3);
  const next = cloneEnvironmentState(state);
  const free = [];
  for (let r = 0; r < state.rows; r += 1) {
    for (let c = 0; c < state.cols; c += 1) {
      if (!state.blocked[indexOf(state, r, c)]) free.push({ row: r, col: c });
    }
  }
  if (free.length < 2) return next;

  const start = free[rng.int(free.length)];
  let goal = free[rng.int(free.length)];
  let guard = 0;
  while ((goal.row === start.row && goal.col === start.col) && guard < 50) {
    goal = free[rng.int(free.length)];
    guard += 1;
  }

  next.start = start;
  next.goal = goal;
  return next;
}

/* ------------------------------------------------------------------ */
/* Dimension changes                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resize the environment, preserving the existing obstacle layout where
 * possible and keeping both endpoints inside the new bounds.
 */
export function resizeEnvironment(state, rows, cols) {
  const nextRows = clampInt(rows, MIN_CELLS, MAX_CELLS);
  const nextCols = clampInt(cols, MIN_CELLS, MAX_CELLS);
  const total = nextRows * nextCols;
  const blocked = new Array(total).fill(false);
  const weights = new Array(total).fill(1);

  const copyRows = Math.min(state.rows, nextRows);
  const copyCols = Math.min(state.cols, nextCols);
  for (let r = 0; r < copyRows; r += 1) {
    for (let c = 0; c < copyCols; c += 1) {
      blocked[r * nextCols + c] = state.blocked[indexOf(state, r, c)];
      weights[r * nextCols + c] = state.weights[indexOf(state, r, c)];
    }
  }

  const next = {
    ...state,
    rows: nextRows,
    cols: nextCols,
    blocked,
    weights,
    start: {
      row: clampInt(state.start.row, 0, nextRows - 1),
      col: clampInt(state.start.col, 0, nextCols - 1),
    },
    goal: {
      row: clampInt(state.goal.row, 0, nextRows - 1),
      col: clampInt(state.goal.col, 0, nextCols - 1),
    },
  };

  blocked[next.start.row * nextCols + next.start.col] = false;
  blocked[next.goal.row * nextCols + next.goal.col] = false;
  return next;
}

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

/**
 * A bounded undo/redo history over environment states.
 */
export function createHistory(initialState, limit = 60) {
  return {
    past: [],
    present: initialState,
    future: [],
    limit,
  };
}

/**
 * Apply a mutation, recording the previous state for undo.
 * The function returns a NEW history object; the previous one is untouched.
 */
export function commit(history, nextState) {
  if (nextState === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-history.limit),
    present: nextState,
    future: [],
    limit: history.limit,
  };
}

export function undo(history) {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, history.limit),
    limit: history.limit,
  };
}

export function redo(history) {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future: history.future.slice(1),
    limit: history.limit,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function findFreeCell(state, preferred, fallback) {
  if (!isBlocked(state, preferred.row, preferred.col)) return { ...preferred };
  if (!isBlocked(state, fallback.row, fallback.col)) return { ...fallback };
  for (let r = 0; r < state.rows; r += 1) {
    for (let c = 0; c < state.cols; c += 1) {
      if (!state.blocked[indexOf(state, r, c)]) return { row: r, col: c };
    }
  }
  return { ...fallback };
}

/**
 * Find the free cell closest to `origin`, excluding the other endpoint.
 * Used when an obstacle is painted over an endpoint: the endpoint is moved
 * to the nearest sensible free cell rather than being silently merged with
 * the other endpoint (which would make the environment trivially solvable).
 */
function findFreeCellNear(state, origin, otherEndpoint) {
  const maxRadius = Math.max(state.rows, state.cols);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        // Only the perimeter of the current radius.
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;

        const row = origin.row + dr;
        const col = origin.col + dc;
        if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) continue;
        if (state.blocked[indexOf(state, row, col)]) continue;
        if (
          otherEndpoint &&
          row === otherEndpoint.row &&
          col === otherEndpoint.col
        ) {
          continue;
        }
        return { row, col };
      }
    }
  }
  return { ...origin };
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function normaliseCell(cell, rows, cols, fallback) {
  if (!cell || !Number.isFinite(cell.row) || !Number.isFinite(cell.col)) {
    return { ...fallback };
  }
  return {
    row: clampInt(cell.row, 0, rows - 1),
    col: clampInt(cell.col, 0, cols - 1),
  };
}
