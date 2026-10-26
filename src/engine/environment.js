/**
 * 3D environment model: world bounds, obstacles, weighted terrain zones.
 * Obstacles are real geometry — rasterized into the planning grid and used
 * directly by the continuous-space collision checker (RRT).
 */
import { clamp } from './geometry.js';
import { checkConfigurationCollision, getTerrainCostMultiplier } from './collision.js';

export const OBSTACLE_TYPES = ['box', 'cylinder'];

let uidCounter = 0;
export function nextObstacleId() {
  uidCounter += 1;
  return `obs-${uidCounter}`;
}

export function createObstacle(raw = {}) {
  const type = OBSTACLE_TYPES.includes(raw.type) ? raw.type : 'box';
  const id = raw.id || nextObstacleId();
  const base = {
    id,
    type,
    x: Number.isFinite(raw.x) ? raw.x : 0,
    y: Number.isFinite(raw.y) ? raw.y : 0,
    rot: Number.isFinite(raw.rot) ? raw.rot : 0,
    height: clamp(Number.isFinite(raw.height) ? raw.height : 0.6, 0.05, 4),
    label: typeof raw.label === 'string' ? raw.label.slice(0, 24) : '',
  };
  if (type === 'box') {
    base.width = clamp(Number.isFinite(raw.width) ? raw.width : 1, 0.1, 20);
    base.depth = clamp(Number.isFinite(raw.depth) ? raw.depth : 1, 0.1, 20);
  } else {
    base.radius = clamp(Number.isFinite(raw.radius) ? raw.radius : 0.5, 0.1, 8);
  }
  return base;
}

export function createEnvironment(config = {}) {
  const width = clamp(config.width ?? 12, 1, 40);
  const height = clamp(config.height ?? 8, 1, 40);
  const cellSize = [0.25, 0.5, 1].includes(config.cellSize) ? config.cellSize : 0.5;
  const cols = Math.round(width / cellSize);
  const rows = Math.round(height / cellSize);
  const seed = ((typeof config.seed === 'number' && config.seed) || 1) >>> 0;

  const env = {
    name: typeof config.name === 'string' ? config.name.slice(0, 60) : 'Custom environment',
    width,
    height,
    cellSize,
    cols,
    rows,
    seed,
    obstacles: (config.obstacles || []).map((o) => createObstacle(o)),
    weightZones: (config.weightZones || []).map((z, i) => ({
      id: z.id || `wz-${i + 1}`,
      type: 'weight',
      x: Number.isFinite(z.x) ? z.x : 0,
      y: Number.isFinite(z.y) ? z.y : 0,
      width: clamp(z.width ?? 2, 0.5, width),
      depth: clamp(z.depth ?? 2, 0.5, height),
      multiplier: clamp(z.multiplier ?? 2, 1, 6),
    })),
  };

  env.metadata = {
    version: 1,
    createdAt: config.createdAt || null,
  };

  env.worldToCell = (x, y) => ({
    ix: clamp(Math.floor(x / cellSize), 0, cols - 1),
    iy: clamp(Math.floor(y / cellSize), 0, rows - 1),
  });
  env.cellCenter = (ix, iy) => ({
    x: (ix + 0.5) * cellSize,
    y: (iy + 0.5) * cellSize,
  });
  env.cellOf = (x, y) => {
    const c = env.worldToCell(x, y);
    return { ...c, index: c.iy * cols + c.ix };
  };
  env.isInsideWorld = (x, y) =>
    x >= 0 && x <= width && y >= 0 && y <= height;

  /** Unique label fallback for obstacles without a name. */
  env.obstacleLabel = (id) => {
    const ob = env.obstacles.find((o) => o.id === id);
    if (!ob) return 'Unknown obstacle';
    const idx = env.obstacles.indexOf(ob) + 1;
    return ob.label || (ob.type === 'box' ? `Box ${idx}` : `Cylinder ${idx}`);
  };

  env.addObstacle = (raw) => {
    const ob = createObstacle(raw);
    env.obstacles.push(ob);
    return ob;
  };
  env.removeObstacle = (id) => {
    env.obstacles = env.obstacles.filter((o) => o.id !== id);
  };
  env.updateObstacle = (id, patch) => {
    env.obstacles = env.obstacles.map((o) => (o.id === id ? { ...o, ...patch } : o));
  };
  env.get = {
    box: (o) => o,
  };

  env.clone = () => createEnvironment(JSON.parse(JSON.stringify({
    name: env.name,
    width: env.width,
    height: env.height,
    cellSize: env.cellSize,
    seed: env.seed,
    obstacles: env.obstacles,
    weightZones: env.weightZones,
  })));

  return env;
}

/** Rough footprint extremes of one obstacle (for editor bounds + camera fitting). */
export function obstacleExtents(o) {
  if (o.type === 'box') {
    const hw = (Math.abs(o.width) + Math.abs(o.depth)) / 2;
    return { radius: Math.hypot(o.width, o.depth) / 2, height: o.height };
  }
  return { radius: o.radius, height: o.height };
}

/**
 * Random obstacle field. Deterministic for a given seed so demos and
 * shared classrooms get identical environments.
 */
export function generateRandomObstacles(env, { count = 10, seed = 1, minSize = 0.6, maxSize = 2.2 } = {}) {
  const rngSeed = (seed >>> 0) || 1;
  const rnd = (function mulberry32Native(a) {
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(rngSeed);

  const obstacles = [];
  for (let i = 0; i < count; i += 1) {
    const box = rnd() < 0.7;
    const w = minSize + rnd() * (maxSize - minSize);
    const d = minSize + rnd() * (maxSize - minSize);
    const x = 1 + rnd() * Math.max(0.5, env.width - 2);
    const y = 1 + rnd() * Math.max(0.5, env.height - 2);
    const ob = createObstacle(box
      ? { type: 'box', x, y, width: w, depth: d, height: 0.5 + rnd() * 1.5, rot: Math.round(rnd() * 3) * (Math.PI / 4) }
      : { type: 'cylinder', x, y, radius: Math.min(w, d) / 2, height: 0.5 + rnd() * 1.5 });
    obstacles.push(ob);
  }
  return obstacles;
}

/** Serialize for persistence over HTTP / localStorage. */
export function envToJSON(env) {
  return JSON.parse(JSON.stringify({
    name: env.name,
    width: env.width,
    height: env.height,
    cellSize: env.cellSize,
    seed: env.seed,
    obstacles: env.obstacles,
    weightZones: env.weightZones,
  }));
}

/** Client-side scenario validation (mirrors the stricter server rules). */
export function validateScenario(scenario) {
  const errors = [];
  if (!scenario || typeof scenario !== 'object') {
    return { ok: false, errors: ['Scenario must be an object'] };
  }
  const env = scenario.env;
  if (!env) errors.push('Missing environment');
  else {
    if (!Number.isFinite(env.width) || env.width < 1 || env.width > 40) errors.push('Environment width must be 1–40 m');
    if (!Number.isFinite(env.height) || env.height < 1 || env.height > 40) errors.push('Environment height must be 1–40 m');
    if (!Array.isArray(env.obstacles)) errors.push('Obstacles must be an array');
    else if (env.obstacles.length > 600) errors.push('Too many obstacles (max 600)');
  }
  const robot = scenario.robot;
  if (!robot || !['differential', 'holonomic'].includes(robot.model)) errors.push('Robot model must be differential or holonomic');
  if (!robot || !Number.isFinite(robot.radius) || robot.radius <= 0 || robot.radius > 1.5) errors.push('Robot radius must be 0–1.5 m');
  const planning = scenario.planning;
  if (!planning || !['bfs', 'dijkstra', 'astar', 'rrt'].includes(planning.algorithm)) errors.push('Unknown algorithm');
  if (planning && planning.rgt) errors.push('Unexpected planning key');
  return { ok: errors.length === 0, errors };
}

export function createSeededRandom(seed = 1) {
  let s = typeof seed === 'string'
    ? seed.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
    : Number(seed) || 1;
  return function next() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function validateStartAndGoal(start, goal, env, robotConfig = {}) {
  const footprintRadius = Number(robotConfig.footprintRadius ?? robotConfig.radius ?? 0.45);
  const clearanceMargin = Number(robotConfig.clearanceMargin ?? robotConfig.safetyMargin ?? 0.08);
  const effectiveRadius = footprintRadius + clearanceMargin;

  const errors = [];
  const startCheck = checkConfigurationCollision(start, env, effectiveRadius);
  if (startCheck.collides) {
    errors.push({
      target: 'start',
      reason: startCheck.reason,
      message: `Start configuration (${start.x.toFixed(2)}, ${(start.z ?? start.y).toFixed(2)}) is invalid: ${startCheck.reason}`,
      obstacle: startCheck.obstacle,
    });
  }

  const goalCheck = checkConfigurationCollision(goal, env, effectiveRadius);
  if (goalCheck.collides) {
    errors.push({
      target: 'goal',
      reason: goalCheck.reason,
      message: `Goal configuration (${goal.x.toFixed(2)}, ${(goal.z ?? goal.y).toFixed(2)}) is invalid: ${goalCheck.reason}`,
      obstacle: goalCheck.obstacle,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildSpatialGrid(env, robotConfig = {}) {
  const width = Number(env.width || 20);
  const depth = Number(env.depth || env.height || 20);
  const resolution = Number(env.resolution || env.cellSize || 0.5);

  const footprintRadius = Number(robotConfig.footprintRadius ?? robotConfig.radius ?? 0.45);
  const clearanceMargin = Number(robotConfig.clearanceMargin ?? robotConfig.safetyMargin ?? 0.08);
  const effectiveRadius = footprintRadius + clearanceMargin;

  const isCentered = Boolean(
    (env.start && env.start.x < 0) ||
    (env.obstacles && env.obstacles.some((o) => o.x < 0 || (o.z !== undefined && o.z < 0))) ||
    env.isCentered
  );

  const minX = isCentered ? -width / 2 : 0;
  const minZ = isCentered ? -depth / 2 : 0;

  const cols = Math.round(width / resolution);
  const rows = Math.round(depth / resolution);
  const totalCells = cols * rows;

  const cells = [];
  let rawBlockedCount = 0;
  let inflatedBlockedCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Number((minX + (c + 0.5) * resolution).toFixed(3));
      const z = Number((minZ + (r + 0.5) * resolution).toFixed(3));
      const key = `${r}_${c}`;

      const rawCheck = checkConfigurationCollision({ x, z }, env, 0);
      const isRawBlocked = rawCheck.collides;
      if (isRawBlocked) rawBlockedCount++;

      const inflatedCheck = checkConfigurationCollision({ x, z }, env, effectiveRadius);
      const isBlocked = inflatedCheck.collides;
      if (isBlocked) inflatedBlockedCount++;

      const terrainCost = getTerrainCostMultiplier({ x, z }, env);

      cells.push({
        row: r,
        col: c,
        x,
        z,
        key,
        isBlocked,
        isRawBlocked,
        terrainCost,
      });
    }
  }

  const freeCellsCount = totalCells - inflatedBlockedCount;

  const worldToGrid = (pt) => {
    const px = pt.x;
    const pz = pt.z !== undefined ? pt.z : (pt.y ?? 0);
    const c = Math.max(0, Math.min(cols - 1, Math.floor((px - minX) / resolution)));
    const r = Math.max(0, Math.min(rows - 1, Math.floor((pz - minZ) / resolution)));
    return {
      row: r,
      col: c,
      cell: cells[r * cols + c],
    };
  };

  const getNeighbors = (row, col, allowDiagonal = true) => {
    const dirs = [
      [0, 1, 1],
      [0, -1, 1],
      [1, 0, 1],
      [-1, 0, 1],
    ];
    if (allowDiagonal) {
      dirs.push([1, 1, Math.SQRT2]);
      dirs.push([1, -1, Math.SQRT2]);
      dirs.push([-1, 1, Math.SQRT2]);
      dirs.push([-1, -1, Math.SQRT2]);
    }

    const nbrs = [];
    const currentCell = cells[row * cols + col];

    for (const [dr, dc, stepLen] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      const nextCell = cells[nr * cols + nc];
      if (nextCell.isBlocked) continue;

      // Prevent cutting corners through adjacent blocked cells on diagonal moves
      if (dr !== 0 && dc !== 0) {
        const side1 = cells[row * cols + nc];
        const side2 = cells[nr * cols + col];
        if (side1.isBlocked || side2.isBlocked) continue;
      }

      const avgTerrain = (currentCell.terrainCost + nextCell.terrainCost) / 2;
      const edgeCost = Number((stepLen * resolution * avgTerrain).toFixed(3));
      nbrs.push({
        cell: nextCell,
        edgeCost,
      });
    }
    return nbrs;
  };

  return {
    rows,
    cols,
    resolution,
    totalCells,
    freeCellsCount,
    rawBlockedCount,
    inflatedBlockedCount,
    effectiveRadius,
    cells,
    worldToGrid,
    getNeighbors,
  };
}
