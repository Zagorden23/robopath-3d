/**
 * Sampling-based planners: Rapidly-exploring Random Tree (RRT) and RRT*.
 *
 * These run in CONTINUOUS space over the arena footprint, sampling random
 * configurations, extending the tree toward them and validating the new
 * edge against the occupancy grid. They deliberately do NOT use the grid
 * heuristics — the heuristic dropdown is hidden for these planners.
 *
 * Difference in behaviour:
 *  - RRT    : connects to the goal as soon as a sample lands within the goal
 *             radius. The returned route is feasible but not optimal.
 *  - RRT*   : maintains edge costs and rewires nearby sub-trees toward newly
 *             added nodes, which asymptotically improves the route quality
 *             over more iterations. A single RRT* run is still not guaranteed
 *             to be optimal.
 *
 * Neither planner can PROVE that a goal is unreachable: when the iteration
 * budget is exhausted they report SEARCH_LIMIT_REACHED, never NO_PATH.
 *
 * PERFORMANCE NOTE
 * Each tree node keeps a list of its children. Rewiring a node re-parents
 * it, and every descendant's accumulated cost must shift by the same saving.
 * Walking the children lists touches only the affected sub-tree, which keeps
 * rewiring linear in the size of that sub-tree rather than quadratic in the
 * size of the whole tree.
 */

import { createRng } from '../../rng.js';
import { cellPathCost, cellPathLengthMetres } from '../movement.js';
import { RESULT_STATUS, makeResult } from '../result.js';

/**
 * Collision test for a continuous point against the occupancy grid.
 * A point is blocked when it falls inside an occupied cell.
 */
function pointBlocked(grid, x, z) {
  const col = Math.floor(x / grid.cellSize);
  const row = Math.floor(z / grid.cellSize);
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return true;
  return grid.blocked[row * grid.cols + col] === 1;
}

/**
 * Validate the straight edge between two continuous points by walking it in
 * small increments. Returns the first blocking point, or null when clear.
 */
function edgeBlocked(grid, ax, az, bx, bz) {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(dist / (grid.cellSize * 0.25)));
  let prevCol = Math.floor(ax / grid.cellSize);
  let prevRow = Math.floor(az / grid.cellSize);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (pointBlocked(grid, x, z)) return { x, z };

    // A segment that slips diagonally between two cells passes through a
    // shared corner. Treat that as corner-cutting (the same rule the graph
    // planners follow) unless both orthogonal neighbours are free.
    const col = Math.floor(x / grid.cellSize);
    const row = Math.floor(z / grid.cellSize);
    if (col !== prevCol && row !== prevRow) {
      const cornerA = cellBlockedAt(grid, prevRow, col);
      const cornerB = cellBlockedAt(grid, row, prevCol);
      if (cornerA || cornerB) return { x, z };
    }
    prevCol = col;
    prevRow = row;
  }
  return null;
}

function cellBlockedAt(grid, row, col) {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return true;
  return grid.blocked[row * grid.cols + col] === 1;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Shared RRT / RRT* implementation.
 */
function runSampling(grid, options, { useRewiring }) {
  const planner = useRewiring ? 'RRT_STAR' : 'RRT';
  const {
    stepSize = grid.cellSize * 2.2,
    goalBias = 0.12,
    maxIterations = 6000,
    goalRadius = grid.cellSize * 1.6,
    rewireRadius = grid.cellSize * 4,
    seed = 2026,
    isCancelled = () => false,
  } = options;

  const startedAt = now();
  const rng = createRng(seed >>> 0);

  const width = grid.width;
  const depth = grid.depth;

  // RRT* uses a rewiring radius that shrinks as the tree grows:
  //   r_k = gamma * sqrt(ln(k) / k)
  // This is the standard formulation and keeps the per-iteration work
  // bounded instead of growing quadratically with the tree size.
  const gamma = useRewiring
    ? 2 * Math.sqrt(Math.max(width * depth, 1)) / Math.sqrt(Math.PI)
    : 0;

  const startPoint = {
    x: (grid.start.col + 0.5) * grid.cellSize,
    z: (grid.start.row + 0.5) * grid.cellSize,
  };
  const goalPoint = {
    x: (grid.goal.col + 0.5) * grid.cellSize,
    z: (grid.goal.row + 0.5) * grid.cellSize,
  };

  if (pointBlocked(grid, startPoint.x, startPoint.z) || pointBlocked(grid, goalPoint.x, goalPoint.z)) {
    return makeResult({
      planner,
      status: RESULT_STATUS.ERROR,
      reason: 'Start or goal lies inside an obstacle, so no tree can be grown from it.',
      planningTimeMs: Number((now() - startedAt).toFixed(3)),
      metadata: { kind: 'sampling', iterations: 0 },
    });
  }

  // Each node tracks its children so a re-parented sub-tree can be updated
  // by walking the affected branch only.
  const nodes = [
    {
      x: startPoint.x,
      z: startPoint.z,
      parent: -1,
      cost: 0,
      children: [],
    },
  ];
  const treeEdges = [];
  const visited = [];
  let goalNodeIndex = -1;
  let iterations = 0;
  let rejectedSamples = 0;

  while (iterations < maxIterations) {
    if (isCancelled()) {
      return makeResult({
        planner,
        status: RESULT_STATUS.CANCELLED,
        reason: 'Search cancelled by the operator before a complete result was reached.',
        nodesExpanded: visited.length,
        nodesGenerated: nodes.length,
        peakFrontier: nodes.length,
        planningTimeMs: Number((now() - startedAt).toFixed(3)),
        visited,
        treeEdges,
        metadata: { kind: 'sampling', iterations },
      });
    }

    iterations += 1;

    // Sample a configuration, biased toward the goal.
    let sample;
    if (rng.chance(goalBias)) {
      sample = { x: goalPoint.x, z: goalPoint.z };
    } else {
      sample = { x: rng.range(0, width), z: rng.range(0, depth) };
    }

    // Nearest existing node.
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = distance(nodes[i], sample);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = i;
      }
    }
    if (nearestDistance < 1e-6) {
      rejectedSamples += 1;
      continue;
    }

    // Steer at most one step toward the sample.
    const base = nodes[nearest];
    const advance = Math.min(stepSize, nearestDistance);
    const newPoint = {
      x: base.x + ((sample.x - base.x) / nearestDistance) * advance,
      z: base.z + ((sample.z - base.z) / nearestDistance) * advance,
    };

    if (edgeBlocked(grid, base.x, base.z, newPoint.x, newPoint.z)) {
      rejectedSamples += 1;
      continue;
    }

    // RRT* "choose parent": instead of always attaching to the nearest node,
    // attach to whichever nearby node yields the lowest cost-from-root over a
    // collision-free edge.
    let parentIndex = nearest;
    let parentCost = base.cost + advance;
    let rewireRadiusNow = 0;
    if (useRewiring) {
      const k = nodes.length + 1;
      rewireRadiusNow = Math.max(
        grid.cellSize,
        Math.min(rewireRadius, gamma * Math.sqrt(Math.log(k + 1) / k))
      );
      for (let i = 0; i < nodes.length; i += 1) {
        const d = distance(nodes[i], newPoint);
        if (d > rewireRadiusNow || d < 1e-6) continue;
        const candidateCost = nodes[i].cost + d;
        if (candidateCost >= parentCost - 1e-9) continue;
        if (edgeBlocked(grid, nodes[i].x, nodes[i].z, newPoint.x, newPoint.z)) continue;
        parentIndex = i;
        parentCost = candidateCost;
      }
    }

    const parentNode = nodes[parentIndex];
    const newIndex = nodes.length;
    nodes.push({
      x: newPoint.x,
      z: newPoint.z,
      parent: parentIndex,
      cost: parentCost,
      children: [],
    });
    parentNode.children.push(newIndex);
    treeEdges.push({
      from: { x: parentNode.x, z: parentNode.z },
      to: { x: newPoint.x, z: newPoint.z },
      order: treeEdges.length,
    });
    visited.push({
      x: newPoint.x,
      z: newPoint.z,
      order: visited.length,
      g: nodes[newIndex].cost,
      h: Math.hypot(goalPoint.x - newPoint.x, goalPoint.z - newPoint.z),
      f: nodes[newIndex].cost + Math.hypot(goalPoint.x - newPoint.x, goalPoint.z - newPoint.z),
    });

    // RRT* rewiring: try to connect nearby nodes through the new node.
    if (useRewiring) {
      rewire(grid, nodes, treeEdges, newIndex, rewireRadiusNow);
    }
    // Attempt a direct connection to the goal.
    const distToGoal = distance(newPoint, goalPoint);
    if (distToGoal <= goalRadius) {
      const blockedPoint = edgeBlocked(grid, newPoint.x, newPoint.z, goalPoint.x, goalPoint.z);
      if (!blockedPoint) {
        const goalIndex = nodes.length;
        nodes.push({
          x: goalPoint.x,
          z: goalPoint.z,
          parent: newIndex,
          cost: nodes[newIndex].cost + distToGoal,
          children: [],
        });
        nodes[newIndex].children.push(goalIndex);
        treeEdges.push({
          from: { x: newPoint.x, z: newPoint.z },
          to: { x: goalPoint.x, z: goalPoint.z },
          order: treeEdges.length,
        });
        goalNodeIndex = goalIndex;
        break;
      }
    }
  }

  if (goalNodeIndex === -1) {
    return makeResult({
      planner,
      status: RESULT_STATUS.SEARCH_LIMIT_REACHED,
      reason: `The tree was grown for ${iterations.toLocaleString()} iterations without reaching the goal. Because RRT-style planners sample rather than exhaust, this does not prove the goal is unreachable — increase the iteration limit or try a different seed.`,
      nodesExpanded: visited.length,
      nodesGenerated: nodes.length,
      peakFrontier: nodes.length,
      planningTimeMs: Number((now() - startedAt).toFixed(3)),
      visited,
      treeEdges,
      metadata: {
        kind: 'sampling',
        iterations,
        rejectedSamples,
        goalReached: false,
      },
    });
  }

  // Reconstruct the route through the parent chain.
  const chain = [];
  let cursor = goalNodeIndex;
  let guard = 0;
  while (cursor !== -1 && guard < 1e7) {
    const node = nodes[cursor];
    chain.push({ x: node.x, z: node.z });
    cursor = node.parent;
    guard += 1;
  }
  chain.reverse();

  // Convert the continuous route into grid cells so it can be rendered and
  // measured with exactly the same cost model as the graph planners. Each
  // tree edge is rasterised in sub-cell increments so consecutive cells are
  // always adjacent (including diagonally).
  const toCell = (point) => {
    const col = Math.min(grid.cols - 1, Math.max(0, Math.floor(point.x / grid.cellSize)));
    const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(point.z / grid.cellSize)));
    return {
      row,
      col,
      index: row * grid.cols + col,
      x: (col + 0.5) * grid.cellSize,
      z: (row + 0.5) * grid.cellSize,
    };
  };

  const cells = [toCell(chain[0])];
  for (let c = 1; c < chain.length; c += 1) {
    const a = chain[c - 1];
    const b = chain[c];
    const segLength = Math.hypot(b.x - a.x, b.z - a.z);
    const subSteps = Math.max(1, Math.ceil(segLength / (grid.cellSize * 0.25)));
    for (let s = 1; s <= subSteps; s += 1) {
      const t = s / subSteps;
      cells.push(toCell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }));
    }
  }

  // Deduplicate consecutive cells so the reported length matches the cells
  // actually traversed rather than the raw sample spacing.
  const deduped = [cells[0]];
  for (let i = 1; i < cells.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    if (cells[i].row !== prev.row || cells[i].col !== prev.col) deduped.push(cells[i]);
  }

  return makeResult({
    planner,
    status: RESULT_STATUS.PATH_FOUND,
    reason: null,
    path: deduped,
    pathLength: cellPathLengthMetres(grid, deduped),
    pathCost: cellPathCost(grid, deduped),
    nodesExpanded: visited.length,
    nodesGenerated: nodes.length,
    peakFrontier: nodes.length,
    planningTimeMs: Number((now() - startedAt).toFixed(3)),
    visited,
    treeEdges,
    metadata: {
      kind: 'sampling',
      iterations,
      rejectedSamples,
      goalReached: true,
      rewireRadius: useRewiring ? rewireRadius : null,
    },
  });
}

/**
 * Attempt to rewire the sub-tree so that a node connects through the new
 * node instead of its previous parent. This is the defining improvement of
 * RRT*: over many iterations the tree converges toward cheaper routes.
 *
 * The comparison is between EDGE lengths, not total-from-root costs: a
 * candidate is rewired when the edge to the new node is shorter than the
 * edge it currently uses to reach its parent. When a node is re-parented,
 * every descendant's accumulated cost is shifted by the same saving,
 * otherwise the tree's cost bookkeeping would drift from the real route.
 */
function rewire(grid, nodes, treeEdges, newIndex, radius) {
  const origin = nodes[newIndex];
  const radiusSq = radius * radius;
  let rewired = 0;

  for (let i = 0; i < newIndex; i += 1) {
    const candidate = nodes[i];
    if (candidate.parent === -1) continue; // never re-parent the root

    const d = distance(origin, candidate);
    if (d * d > radiusSq || d < 1e-6) continue;

    // Rewire only when routing through the new node strictly lowers the
    // candidate's cost-from-root. Because an ancestor of the new node always
    // has a lower cost than the new node itself, this also guarantees the
    // tree can never develop a cycle.
    const newCost = origin.cost + d;
    if (newCost >= candidate.cost - 1e-9) continue;

    // The new edge must be collision free.
    if (edgeBlocked(grid, origin.x, origin.z, candidate.x, candidate.z)) continue;

    // Detach the candidate from its old parent and attach it to the new node.
    const oldParent = nodes[candidate.parent];
    const oldSiblingIndex = oldParent.children.indexOf(i);
    if (oldSiblingIndex !== -1) oldParent.children.splice(oldSiblingIndex, 1);
    origin.children.push(i);

    removeEdgeTo(treeEdges, candidate);

    const saving = candidate.cost - newCost;
    candidate.parent = newIndex;

    // Propagate the saving down the affected sub-tree only (candidate and
    // its descendants) by walking the children lists.
    const stack = [i];
    while (stack.length > 0) {
      const current = stack.pop();
      nodes[current].cost -= saving;
      for (const child of nodes[current].children) stack.push(child);
    }

    treeEdges.push({
      from: { x: origin.x, z: origin.z },
      to: { x: candidate.x, z: candidate.z },
      order: treeEdges.length,
      rewired: true,
    });
    rewired += 1;
  }

  return rewired;
}

/** Remove the tree edge that currently terminates at the given node. */
function removeEdgeTo(treeEdges, node) {
  for (let e = treeEdges.length - 1; e >= 0; e -= 1) {
    const edge = treeEdges[e];
    if (
      Math.abs(edge.to.x - node.x) < 1e-9 &&
      Math.abs(edge.to.z - node.z) < 1e-9
    ) {
      treeEdges.splice(e, 1);
      return;
    }
  }
}

/**
 * Rapidly-exploring Random Tree.
 */
export function runRRT(grid, options = {}) {
  return runSampling(grid, options, { useRewiring: false });
}

/**
 * RRT* with sub-tree rewiring.
 */
export function runRRTStar(grid, options = {}) {
  return runSampling(grid, options, { useRewiring: true });
}

function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
