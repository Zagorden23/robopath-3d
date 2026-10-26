/**
 * Continuous-space collision world.
 * clearanceAt() measures the minimum distance from a point to obstacle
 * surfaces (signed: negative when the point is inside an obstacle).
 * RRT, path validation and footprint inflation all share this module.
 */
import { clamp } from './geometry.js';

/** Distance from a point to an axis-off-center oriented box (signed). */
function pointToBox(px, py, o) {
  const hw = (o.width ?? 1) / 2;
  const hd = (o.depth ?? o.length ?? 1) / 2;
  const rot = o.rot || o.rotation || 0;
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const dx = px - (o.x ?? 0);
  const oy = o.z !== undefined ? o.z : (o.y ?? 0);
  const dy = py - oy;
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  const qx = clamp(lx, -hw, hw);
  const qy = clamp(ly, -hd, hd);
  const ox = lx - qx;
  const oyVal = ly - qy;
  if (ox === 0 && oyVal === 0) return -Math.min(hw - Math.abs(lx), hd - Math.abs(ly));
  return Math.hypot(ox, oyVal);
}

/** Signed distance from a point to a vertical cylinder footprint. */
function pointToCylinder(px, py, o) {
  const oy = o.z !== undefined ? o.z : (o.y ?? 0);
  const rad = o.radius ?? ((o.width ?? 1) / 2);
  return Math.hypot(px - (o.x ?? 0), py - oy) - rad;
}

export function euclideanDistance2D(p1, p2) {
  const z1 = p1.z !== undefined ? p1.z : (p1.y ?? 0);
  const z2 = p2.z !== undefined ? p2.z : (p2.y ?? 0);
  return Math.hypot(p2.x - p1.x, z2 - z1);
}

export function signedDistanceToObstacle(point, o) {
  const px = point.x;
  const py = point.z !== undefined ? point.z : (point.y ?? 0);
  const type = o.shape || o.type || 'box';
  return type === 'box' ? pointToBox(px, py, o) : pointToCylinder(px, py, o);
}

export function checkConfigurationCollision(point, env, effectiveRadius = 0) {
  const px = point.x;
  const pz = point.z !== undefined ? point.z : (point.y ?? 0);
  const width = Number(env.width || 20);
  const depth = Number(env.depth || env.height || 20);

  const isCentered = Boolean(
    (env.start && env.start.x < 0) ||
    (env.obstacles && env.obstacles.some((o) => o.x < 0 || (o.z !== undefined && o.z < 0))) ||
    env.isCentered
  );

  const minX = isCentered ? -width / 2 : 0;
  const maxX = isCentered ? width / 2 : width;
  const minZ = isCentered ? -depth / 2 : 0;
  const maxZ = isCentered ? depth / 2 : depth;

  if (
    px < minX + effectiveRadius ||
    px > maxX - effectiveRadius ||
    pz < minZ + effectiveRadius ||
    pz > maxZ - effectiveRadius
  ) {
    return { collides: true, reason: 'OUT_OF_BOUNDS', minDistance: 0 };
  }

  const obstacles = env.obstacles || [];
  let minDistance = Infinity;
  let collidingObstacle = null;

  for (let i = 0; i < obstacles.length; i++) {
    const dist = signedDistanceToObstacle(point, obstacles[i]);
    if (dist < minDistance) minDistance = dist;
    if (dist < effectiveRadius) {
      collidingObstacle = obstacles[i];
      return { collides: true, reason: 'OBSTACLE_COLLISION', obstacle: collidingObstacle, minDistance };
    }
  }

  return { collides: false, minDistance };
}

export function checkSegmentCollision(p1, p2, env, effectiveRadius = 0, step = 0.05) {
  const dist = euclideanDistance2D(p1, p2);
  const steps = Math.max(1, Math.ceil(dist / step));
  const z1 = p1.z !== undefined ? p1.z : (p1.y ?? 0);
  const z2 = p2.z !== undefined ? p2.z : (p2.y ?? 0);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = {
      x: p1.x + (p2.x - p1.x) * t,
      z: z1 + (z2 - z1) * t,
    };
    const check = checkConfigurationCollision(pt, env, effectiveRadius);
    if (check.collides) {
      return { collides: true, at: pt, obstacle: check.obstacle };
    }
  }
  return { collides: false, at: null };
}

export function getTerrainCostMultiplier(point, env) {
  const zones = env.terrainZones || env.weightZones || [];
  const px = point.x;
  const pz = point.z !== undefined ? point.z : (point.y ?? 0);
  let multiplier = 1.0;

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const zx = z.x ?? 0;
    const zz = z.z !== undefined ? z.z : (z.y ?? 0);
    const zw = z.width ?? 2;
    const zd = z.depth ?? z.height ?? 2;
    const isCentered = Boolean(
      (env.start && env.start.x < 0) ||
      (env.obstacles && env.obstacles.some((o) => o.x < 0 || (o.z !== undefined && o.z < 0))) ||
      env.isCentered
    );

    let inside = false;
    if (isCentered) {
      inside = Math.abs(px - zx) <= zw / 2 && Math.abs(pz - zz) <= zd / 2;
    } else {
      inside = px >= zx && px <= zx + zw && pz >= zz && pz <= zz + zd;
    }

    if (inside) {
      multiplier = Math.max(multiplier, z.multiplier || z.costMultiplier || 1.0);
    }
  }
  return multiplier;
}

export function validatePath(path, env, robotConfig = {}) {
  if (!path || path.length === 0) {
    return {
      isValid: false,
      reason: 'EMPTY_PATH',
      pathLength: 0,
      traversalCost: 0,
      minClearance: 0,
      collisions: [],
    };
  }

  const footprintRadius = Number(robotConfig.footprintRadius ?? robotConfig.radius ?? 0.45);
  const clearanceMargin = Number(robotConfig.clearanceMargin ?? robotConfig.safetyMargin ?? 0.08);
  const effectiveRadius = footprintRadius + clearanceMargin;

  let pathLength = 0;
  let traversalCost = 0;
  let minClearance = Infinity;
  const collisions = [];

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    const confCheck = checkConfigurationCollision(pt, env, effectiveRadius);
    if (confCheck.minDistance < minClearance) minClearance = confCheck.minDistance;
    if (confCheck.collides) {
      collisions.push({ index: i, point: pt, reason: confCheck.reason, obstacle: confCheck.obstacle });
    }

    if (i < path.length - 1) {
      const nextPt = path[i + 1];
      const d = euclideanDistance2D(pt, nextPt);
      pathLength += d;
      const z1 = pt.z !== undefined ? pt.z : (pt.y ?? 0);
      const z2 = nextPt.z !== undefined ? nextPt.z : (nextPt.y ?? 0);
      const mid = {
        x: (pt.x + nextPt.x) / 2,
        z: (z1 + z2) / 2,
      };
      const mult = getTerrainCostMultiplier(mid, env);
      traversalCost += d * mult;

      const segCheck = checkSegmentCollision(pt, nextPt, env, effectiveRadius);
      if (segCheck.collides) {
        collisions.push({ segment: [i, i + 1], at: segCheck.at, obstacle: segCheck.obstacle });
      }
    }
  }

  return {
    isValid: collisions.length === 0,
    reason: collisions.length === 0 ? 'VALID' : 'COLLISION_DETECTED',
    pathLength: Number(pathLength.toFixed(3)),
    traversalCost: Number(traversalCost.toFixed(3)),
    minClearance: Number(minClearance.toFixed(3)),
    collisions,
  };
}

export function createCollisionWorld(env, { robotRadius = 0.3, safetyMargin = 0.05 } = {}) {
  const obstacles = (env.obstacles || []).filter((o) => (o.shape || o.type) === 'box' || (o.shape || o.type) === 'cylinder');

  const clearanceAt = (x, y) => {
    let min = Infinity;
    for (let i = 0; i < obstacles.length; i += 1) {
      const o = obstacles[i];
      const d = (o.shape || o.type) === 'box' ? pointToBox(x, y, o) : pointToCylinder(x, y, o);
      if (d < min) min = d;
    }
    return obstacles.length === 0 ? Infinity : min;
  };

  const nearestObstacle = (x, y) => {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < obstacles.length; i += 1) {
      const o = obstacles[i];
      const d = (o.shape || o.type) === 'box' ? pointToBox(x, y, o) : pointToCylinder(x, y, o);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (!best) return { id: null, label: null, distance: Infinity };
    return { id: best.id, label: env.obstacleLabel ? env.obstacleLabel(best.id) : (best.label || best.id), distance: bestD };
  };

  const isCollidingWith = (x, y) => {
    for (let i = 0; i < obstacles.length; i += 1) {
      const o = obstacles[i];
      const d = (o.shape || o.type) === 'box' ? pointToBox(x, y, o) : pointToCylinder(x, y, o);
      if (d < 0) return o.id;
    }
    return null;
  };

  /** True when the robot (radius r) centered at p intersects inflated geometry. */
  const isInCollision = (x, y, r = robotRadius + safetyMargin) => clearanceAt(x, y) < r;

  /** Walk a segment at fine resolution; report the first collision point.
   * `radius` defaults to robotRadius + safetyMargin (the full inflated footprint). */
  const segmentCheck = (ax, ay, bx, by, step = 0.05, radius = robotRadius + safetyMargin) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (isInCollision(x, y, radius)) {
        return { ok: false, at: { x, y } };
      }
    }
    return { ok: true, at: null };
  };

  return {
    robotRadius,
    safetyMargin,
    clearanceAt,
    nearestObstacle,
    isCollidingWith,
    isInCollision,
    segmentCheck,
    obstacleCount: obstacles.length,
  };
}
