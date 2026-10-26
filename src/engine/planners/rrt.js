/**
 * Rapidly-Exploring Random Tree (RRT) Continuous-Space Motion Planner.
 *
 * Samples continuous configurations q_rand in workspace bounds, selects nearest
 * tree vertex q_near, extends by step size delta_q toward q_rand to produce q_new,
 * and validates continuous segment collision in C-space.
 */

import {
  checkConfigurationCollision,
  checkSegmentCollision,
  euclideanDistance2D,
  getTerrainCostMultiplier,
} from '../collision.js';
import { createSeededRandom } from '../environment.js';

export function runRRT(environment, startPoint, goalPoint, robotConfig = {}, options = {}) {
  const t0 = performance.now();

  const footprintRadius = Number(robotConfig.footprintRadius ?? 0.45);
  const clearanceMargin = Number(robotConfig.clearanceMargin ?? 0.08);
  const effectiveRadius = footprintRadius + clearanceMargin;

  const maxIterations = Number(options.maxIterations ?? 900);
  const stepSize = Number(options.stepSize ?? 1.15);
  const goalBias = Number(options.goalBias ?? 0.16);
  const goalThreshold = Number(options.goalThreshold ?? stepSize * 1.25);
  const seed = options.seed ?? environment.seed ?? 2026;

  const startCheck = checkConfigurationCollision(startPoint, environment, effectiveRadius);
  const goalCheck = checkConfigurationCollision(goalPoint, environment, effectiveRadius);

  if (startCheck.collides || goalCheck.collides) {
    return {
      algorithm: 'RRT',
      success: false,
      reason: startCheck.collides ? 'START_BLOCKED' : 'GOAL_BLOCKED',
      path: [],
      exploredNodes: [],
      treeEdges: [],
      nodesExpanded: 0,
      peakQueueSize: 0,
      planningTimeMs: Number((performance.now() - t0).toFixed(3)),
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const rand = createSeededRandom(seed);
  const width = Number(environment.width ?? 20);
  const depth = Number(environment.depth ?? 20);
  const halfW = width / 2 - effectiveRadius;
  const halfD = depth / 2 - effectiveRadius;

  const rootNode = {
    id: 0,
    key: 'rrt-0',
    x: Number(startPoint.x.toFixed(3)),
    z: Number(startPoint.z.toFixed(3)),
    parentIndex: -1,
    g: 0,
    h: Number(euclideanDistance2D(startPoint, goalPoint).toFixed(3)),
    f: Number(euclideanDistance2D(startPoint, goalPoint).toFixed(3)),
    stepOrder: 0,
  };

  const treeNodes = [rootNode];
  const treeEdges = [];
  const exploredNodes = [rootNode];

  let goalNodeIndex = -1;

  for (let iter = 1; iter <= maxIterations; iter++) {
    const isGoalSample = rand() < goalBias;
    const qRand = isGoalSample
      ? { x: goalPoint.x, z: goalPoint.z }
      : {
          x: (rand() * 2 - 1) * halfW,
          z: (rand() * 2 - 1) * halfD,
        };

    // Find nearest tree vertex q_near
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < treeNodes.length; i++) {
      const d = euclideanDistance2D(treeNodes[i], qRand);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    if (minDist < 1e-4) continue;

    const qNear = treeNodes[nearestIdx];
    const actualStep = Math.min(stepSize, minDist);
    const dirX = (qRand.x - qNear.x) / minDist;
    const dirZ = (qRand.z - qNear.z) / minDist;

    const qNewPt = {
      x: Number((qNear.x + dirX * actualStep).toFixed(3)),
      z: Number((qNear.z + dirZ * actualStep).toFixed(3)),
    };

    const segCheck = checkSegmentCollision(qNear, qNewPt, environment, effectiveRadius);
    if (segCheck.collides) continue;

    const midpoint = { x: (qNear.x + qNewPt.x) / 2, z: (qNear.z + qNewPt.z) / 2 };
    const terrainMult = getTerrainCostMultiplier(midpoint, environment);
    const edgeCost = actualStep * terrainMult;
    const newG = qNear.g + edgeCost;
    const newH = euclideanDistance2D(qNewPt, goalPoint);

    const newNode = {
      id: treeNodes.length,
      key: `rrt-${treeNodes.length}`,
      x: qNewPt.x,
      z: qNewPt.z,
      parentIndex: nearestIdx,
      qRand: { x: Number(qRand.x.toFixed(2)), z: Number(qRand.z.toFixed(2)) },
      qNear: { x: qNear.x, z: qNear.z },
      stepDistance: Number(actualStep.toFixed(3)),
      edgeCost: Number(edgeCost.toFixed(3)),
      g: Number(newG.toFixed(3)),
      h: Number(newH.toFixed(3)),
      f: Number((newG + newH).toFixed(3)),
      terrainCost: terrainMult,
      stepOrder: exploredNodes.length,
    };

    const newIndex = treeNodes.length;
    treeNodes.push(newNode);
    exploredNodes.push(newNode);
    treeEdges.push({
      from: { x: qNear.x, z: qNear.z },
      to: { x: newNode.x, z: newNode.z },
      stepOrder: newIndex,
    });

    // Check if we can connect directly to the goal
    const distToGoal = euclideanDistance2D(newNode, goalPoint);
    if (distToGoal <= goalThreshold) {
      const goalConnectCheck = checkSegmentCollision(
        newNode,
        goalPoint,
        environment,
        effectiveRadius
      );
      if (!goalConnectCheck.collides) {
        const finalMid = {
          x: (newNode.x + goalPoint.x) / 2,
          z: (newNode.z + goalPoint.z) / 2,
        };
        const finalMult = getTerrainCostMultiplier(finalMid, environment);
        const finalEdgeCost = distToGoal * finalMult;
        const finalG = newNode.g + finalEdgeCost;

        const goalTreeNode = {
          id: treeNodes.length,
          key: `rrt-goal`,
          x: Number(goalPoint.x.toFixed(3)),
          z: Number(goalPoint.z.toFixed(3)),
          parentIndex: newIndex,
          qRand: { x: Number(goalPoint.x.toFixed(2)), z: Number(goalPoint.z.toFixed(2)) },
          qNear: { x: newNode.x, z: newNode.z },
          stepDistance: Number(distToGoal.toFixed(3)),
          edgeCost: Number(finalEdgeCost.toFixed(3)),
          g: Number(finalG.toFixed(3)),
          h: 0,
          f: Number(finalG.toFixed(3)),
          terrainCost: finalMult,
          stepOrder: exploredNodes.length,
        };

        goalNodeIndex = treeNodes.length;
        treeNodes.push(goalTreeNode);
        exploredNodes.push(goalTreeNode);
        treeEdges.push({
          from: { x: newNode.x, z: newNode.z },
          to: { x: goalTreeNode.x, z: goalTreeNode.z },
          stepOrder: goalNodeIndex,
        });
        break;
      }
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (goalNodeIndex === -1) {
    return {
      algorithm: 'RRT',
      success: false,
      reason: 'UNREACHABLE_GOAL',
      path: [],
      exploredNodes,
      treeEdges,
      nodesExpanded: exploredNodes.length,
      peakQueueSize: treeNodes.length,
      planningTimeMs,
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const rawPath = [];
  let idx = goalNodeIndex;
  while (idx !== -1) {
    const node = treeNodes[idx];
    rawPath.push({
      x: node.x,
      y: 0,
      z: node.z,
      g: node.g,
      h: node.h,
      f: node.f,
      edgeCost: node.edgeCost ?? 0,
      qRand: node.qRand || null,
      qNear: node.qNear || null,
    });
    idx = node.parentIndex;
  }
  rawPath.reverse();

  const finalCost = rawPath[rawPath.length - 1]?.g ?? 0;

  return {
    algorithm: 'RRT',
    success: true,
    reason: null,
    path: rawPath,
    exploredNodes,
    treeEdges,
    nodesExpanded: exploredNodes.length,
    peakQueueSize: treeNodes.length,
    planningTimeMs,
    accumulatedCost: Number(finalCost.toFixed(3)),
    hopCount: Math.max(0, rawPath.length - 1),
  };
}

/**
 * Rapidly-Exploring Random Tree Star (RRT*) Motion Planner.
 * Extends RRT with minimum-cost parent selection within neighborhood radius
 * r_rewire and local subtree rewiring for asymptotic optimality.
 */
export function runRRTStar(environment, startPoint, goalPoint, robotConfig = {}, options = {}) {
  const t0 = performance.now();

  const footprintRadius = Number(robotConfig.footprintRadius ?? 0.45);
  const clearanceMargin = Number(robotConfig.clearanceMargin ?? 0.08);
  const effectiveRadius = footprintRadius + clearanceMargin;

  const maxIterations = Number(options.maxIterations ?? 900);
  const stepSize = Number(options.stepSize ?? 1.15);
  const rewireRadius = Number(options.rewireRadius ?? stepSize * 2.1);
  const goalBias = Number(options.goalBias ?? 0.16);
  const goalThreshold = Number(options.goalThreshold ?? stepSize * 1.25);
  const seed = options.seed ?? environment.seed ?? 2026;

  const startCheck = checkConfigurationCollision(startPoint, environment, effectiveRadius);
  const goalCheck = checkConfigurationCollision(goalPoint, environment, effectiveRadius);

  if (startCheck.collides || goalCheck.collides) {
    return {
      algorithm: 'RRT_STAR',
      success: false,
      reason: startCheck.collides ? 'START_BLOCKED' : 'GOAL_BLOCKED',
      path: [],
      exploredNodes: [],
      treeEdges: [],
      nodesExpanded: 0,
      peakQueueSize: 0,
      planningTimeMs: Number((performance.now() - t0).toFixed(3)),
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const rand = createSeededRandom(seed);
  const width = Number(environment.width ?? 20);
  const depth = Number(environment.depth ?? 20);
  const halfW = width / 2 - effectiveRadius;
  const halfD = depth / 2 - effectiveRadius;

  const rootNode = {
    id: 0,
    key: 'rrts-0',
    x: Number(startPoint.x.toFixed(3)),
    z: Number(startPoint.z.toFixed(3)),
    parentIndex: -1,
    g: 0,
    h: Number(euclideanDistance2D(startPoint, goalPoint).toFixed(3)),
    f: Number(euclideanDistance2D(startPoint, goalPoint).toFixed(3)),
    stepOrder: 0,
  };

  const treeNodes = [rootNode];
  const treeEdges = [];
  const exploredNodes = [rootNode];

  let bestGoalNodeIndex = -1;
  let bestGoalCost = Infinity;

  for (let iter = 1; iter <= maxIterations; iter++) {
    const isGoalSample = rand() < goalBias;
    const qRand = isGoalSample
      ? { x: goalPoint.x, z: goalPoint.z }
      : {
          x: (rand() * 2 - 1) * halfW,
          z: (rand() * 2 - 1) * halfD,
        };

    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < treeNodes.length; i++) {
      const d = euclideanDistance2D(treeNodes[i], qRand);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    if (minDist < 1e-4) continue;

    const qNear = treeNodes[nearestIdx];
    const actualStep = Math.min(stepSize, minDist);
    const dirX = (qRand.x - qNear.x) / minDist;
    const dirZ = (qRand.z - qNear.z) / minDist;

    const qNewPt = {
      x: Number((qNear.x + dirX * actualStep).toFixed(3)),
      z: Number((qNear.z + dirZ * actualStep).toFixed(3)),
    };

    const segCheck = checkSegmentCollision(qNear, qNewPt, environment, effectiveRadius);
    if (segCheck.collides) continue;

    // Choose best parent in neighborhood radius r_rewire
    let bestParentIdx = nearestIdx;
    const mid0 = { x: (qNear.x + qNewPt.x) / 2, z: (qNear.z + qNewPt.z) / 2 };
    let minCostG = qNear.g + actualStep * getTerrainCostMultiplier(mid0, environment);
    const neighbors = [];

    for (let i = 0; i < treeNodes.length; i++) {
      const d = euclideanDistance2D(treeNodes[i], qNewPt);
      if (d <= rewireRadius) {
        neighbors.push({ idx: i, dist: d });
        const mid = { x: (treeNodes[i].x + qNewPt.x) / 2, z: (treeNodes[i].z + qNewPt.z) / 2 };
        const candG = treeNodes[i].g + d * getTerrainCostMultiplier(mid, environment);
        if (candG < minCostG - 1e-6) {
          const check = checkSegmentCollision(treeNodes[i], qNewPt, environment, effectiveRadius);
          if (!check.collides) {
            minCostG = candG;
            bestParentIdx = i;
          }
        }
      }
    }

    const parentNode = treeNodes[bestParentIdx];
    const newH = euclideanDistance2D(qNewPt, goalPoint);
    const newIndex = treeNodes.length;

    const newNode = {
      id: newIndex,
      key: `rrts-${newIndex}`,
      x: qNewPt.x,
      z: qNewPt.z,
      parentIndex: bestParentIdx,
      qRand: { x: Number(qRand.x.toFixed(2)), z: Number(qRand.z.toFixed(2)) },
      qNear: { x: parentNode.x, z: parentNode.z },
      stepDistance: Number(euclideanDistance2D(parentNode, qNewPt).toFixed(3)),
      edgeCost: Number((minCostG - parentNode.g).toFixed(3)),
      g: Number(minCostG.toFixed(3)),
      h: Number(newH.toFixed(3)),
      f: Number((minCostG + newH).toFixed(3)),
      terrainCost: 1,
      stepOrder: exploredNodes.length,
    };

    treeNodes.push(newNode);
    exploredNodes.push(newNode);
    treeEdges.push({
      from: { x: parentNode.x, z: parentNode.z },
      to: { x: newNode.x, z: newNode.z },
      rewired: bestParentIdx !== nearestIdx,
      stepOrder: newIndex,
    });

    // Rewire neighborhood through newNode if cheaper
    for (let k = 0; k < neighbors.length; k++) {
      const { idx: nbrIdx, dist: dNbr } = neighbors[k];
      if (nbrIdx === bestParentIdx) continue;
      const nbr = treeNodes[nbrIdx];
      const mid = { x: (newNode.x + nbr.x) / 2, z: (newNode.z + nbr.z) / 2 };
      const rewiredG = newNode.g + dNbr * getTerrainCostMultiplier(mid, environment);
      if (rewiredG < nbr.g - 1e-5) {
        const check = checkSegmentCollision(newNode, nbr, environment, effectiveRadius);
        if (!check.collides) {
          nbr.parentIndex = newIndex;
          nbr.g = Number(rewiredG.toFixed(3));
          nbr.f = Number((rewiredG + nbr.h).toFixed(3));
          treeEdges.push({
            from: { x: newNode.x, z: newNode.z },
            to: { x: nbr.x, z: nbr.z },
            rewired: true,
            stepOrder: treeEdges.length,
          });
        }
      }
    }

    // Check goal connection
    const distToGoal = euclideanDistance2D(newNode, goalPoint);
    if (distToGoal <= goalThreshold) {
      const goalConnectCheck = checkSegmentCollision(
        newNode,
        goalPoint,
        environment,
        effectiveRadius
      );
      if (!goalConnectCheck.collides) {
        const finalMid = {
          x: (newNode.x + goalPoint.x) / 2,
          z: (newNode.z + goalPoint.z) / 2,
        };
        const finalMult = getTerrainCostMultiplier(finalMid, environment);
        const finalG = newNode.g + distToGoal * finalMult;
        if (finalG < bestGoalCost) {
          bestGoalCost = finalG;
          const goalTreeNode = {
            id: treeNodes.length,
            key: `rrts-goal-${treeNodes.length}`,
            x: Number(goalPoint.x.toFixed(3)),
            z: Number(goalPoint.z.toFixed(3)),
            parentIndex: newIndex,
            qRand: { x: Number(goalPoint.x.toFixed(2)), z: Number(goalPoint.z.toFixed(2)) },
            qNear: { x: newNode.x, z: newNode.z },
            stepDistance: Number(distToGoal.toFixed(3)),
            edgeCost: Number((distToGoal * finalMult).toFixed(3)),
            g: Number(finalG.toFixed(3)),
            h: 0,
            f: Number(finalG.toFixed(3)),
            terrainCost: finalMult,
            stepOrder: exploredNodes.length,
          };
          bestGoalNodeIndex = treeNodes.length;
          treeNodes.push(goalTreeNode);
          exploredNodes.push(goalTreeNode);
          treeEdges.push({
            from: { x: newNode.x, z: newNode.z },
            to: { x: goalTreeNode.x, z: goalTreeNode.z },
            rewired: false,
            stepOrder: bestGoalNodeIndex,
          });
        }
      }
    }
  }

  const planningTimeMs = Number((performance.now() - t0).toFixed(3));

  if (bestGoalNodeIndex === -1) {
    return {
      algorithm: 'RRT_STAR',
      success: false,
      reason: 'SEARCH_LIMIT_REACHED',
      path: [],
      exploredNodes,
      treeEdges,
      nodesExpanded: exploredNodes.length,
      peakQueueSize: treeNodes.length,
      planningTimeMs,
      accumulatedCost: 0,
      hopCount: 0,
    };
  }

  const rawPath = [];
  let idx = bestGoalNodeIndex;
  const visitedGuard = new Set();
  while (idx !== -1 && !visitedGuard.has(idx)) {
    visitedGuard.add(idx);
    const node = treeNodes[idx];
    rawPath.push({
      x: node.x,
      y: 0,
      z: node.z,
      g: node.g,
      h: node.h,
      f: node.f,
      edgeCost: node.edgeCost ?? 0,
      qRand: node.qRand || null,
      qNear: node.qNear || null,
    });
    idx = node.parentIndex;
  }
  rawPath.reverse();

  const finalCost = rawPath[rawPath.length - 1]?.g ?? 0;

  return {
    algorithm: 'RRT_STAR',
    success: true,
    reason: null,
    path: rawPath,
    exploredNodes,
    treeEdges,
    nodesExpanded: exploredNodes.length,
    peakQueueSize: treeNodes.length,
    planningTimeMs,
    accumulatedCost: Number(finalCost.toFixed(3)),
    hopCount: Math.max(0, rawPath.length - 1),
  };
}
