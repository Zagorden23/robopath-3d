/**
 * Rapidly-exploring Random Tree (RRT) — sampling-based planning in the
 * continuous plane. Deterministic because sampling uses a seeded RNG.
 * Basic RRT finds A feasible path; it does not guarantee the global optimum.
 */
import { createRng } from './rng.js';
import { dist2, polylineLength } from './geometry.js';

export function rrtSearch({ env, collision, start, goal, options = {} }) {
  const {
    stepSize = 0.55,
    goalBias = 0.06,
    maxIterations = 6000,
    goalRadius = 0.35,
    seed = 7,
  } = options;

  const t0 = performance.now();
  const rng = createRng(seed >>> 0);
  const nodes = [{ x: start.x, y: start.y, parent: -1, id: 0 }];
  const samples = []; // all point samples, valid or rejected (for honest viz)
  let rejectedSamples = 0;
  let extensions = 0;
  let failedExtensions = 0;
  let edgeChecks = 0;
  let nearestQueries = 0;
  let goalFoundAt = -1;

  for (let iter = 0; iter < maxIterations; iter += 1) {
    // Sample: bias toward goal, otherwise uniform over the room.
    let sx;
    let sy;
    if (rng.chance(goalBias)) {
      sx = goal.x; sy = goal.y;
    } else {
      sx = rng.range(0.05, env.width - 0.05);
      sy = rng.range(0.05, env.height - 0.05);
    }
    samples.push({ x: sx, y: sy, rejected: 0 });

    // Nearest existing node (linear scan; tree sizes here are modest).
    nearestQueries += 1;
    let nearest = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = dist2(nodes[i].x, nodes[i].y, sx, sy);
      if (d < bestD) { bestD = d; nearest = i; }
    }
    const base = nodes[nearest];

    // Steer: move at most stepSize toward the sample.
    const dToSample = Math.max(1e-6, Math.hypot(sx - base.x, sy - base.y));
    const scale = Math.min(1, stepSize / dToSample);
    const nx = base.x + (sx - base.x) * scale;
    const ny = base.y + (sy - base.y) * scale;
    extensions += 1;

    // Collision check candidate edge; only inside the room counts too.
    const inRoom = nx >= 0 && ny >= 0 && nx <= env.width && ny <= env.height;
    edgeChecks += 1;
    const check = inRoom
      ? collision.segmentCheck(base.x, base.y, nx, ny, 0.02)
      : { ok: false };
    if (!check.ok) {
      failedExtensions += 1;
      samples[samples.length - 1].rejected = 1;
      rejectedSamples += 1;
      continue;
    }

    const parentId = nearest;
    const id = nodes.length;
    nodes.push({ x: nx, y: ny, parent: parentId, id });
    samples[samples.length - 1].nodeId = id;

    // Goal connection attempt.
    const dGoal = dist2(nx, ny, goal.x, goal.y);
    if (dGoal <= goalRadius) {
      edgeChecks += 1;
      const connect = collision.segmentCheck(nx, ny, goal.x, goal.y, 0.02);
      if (connect.ok) {
        const goalId = nodes.length;
        nodes.push({ x: goal.x, y: goal.y, parent: id, id: goalId });
        goalFoundAt = goalId;
        break;
      }
    }
  }

  const durationMs = performance.now() - t0;
  const result = {
    found: false,
    reason: 'no_path',
    path: [],
    pathLength: 0,
    pathCost: 0,
    nodes,
    samples,
    nodesExpanded: extensions,
    peakFrontier: nodes.length,
    durationMs,
    metrics: {
      sampler: 'rrt',
      iterations: Math.min(maxIterations, iterations_done(goalFoundAt, maxIterations)),
      samplesTaken: samples.length,
      rejectedSamples,
      extensions,
      failedExtensions,
      edgeChecks,
      nearestQueries,
      treeSize: nodes.length,
      goalRadius,
      stepSize,
      goalBias,
      seed,
    },
  };

  if (goalFoundAt === -1) {
    result.reason = maxIterations > 0 ? 'no_path' : 'inactive';
    return result;
  }

  // Reconstruct via parent chain.
  const chain = [];
  let cur = goalFoundAt;
  let guard = 0;
  while (cur !== -1 && guard++ < 1e6) {
    const n = nodes[cur];
    chain.push({ x: n.x, y: n.y });
    cur = n.parent;
  }
  chain.reverse();
  result.found = true;
  result.path = chain;
  result.pathLength = polylineLength(chain);
  result.pathCost = result.pathLength; // RRT cost = geometric length of the chain
  return result;
}

function iterations_done(goalFoundAt, maxIterations) {
  return goalFoundAt >= 0 ? goalFoundAt + 1 : maxIterations;
}
