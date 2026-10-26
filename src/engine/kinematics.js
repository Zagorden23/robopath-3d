/**
 * Robot Models, Differential-Drive & Holonomic Kinematics,
 * and Time-Parameterized Motion Profile Generator.
 *
 * Differential-drive equations:
 *   v = r * (omega_R + omega_L) / 2
 *   omega = r * (omega_R - omega_L) / L
 *   x_dot = v * cos(theta)
 *   z_dot = v * sin(theta)
 *   theta_dot = omega
 */

import { euclideanDistance2D, signedDistanceToObstacle } from './collision.js';

export const ROBOT_MODELS = {
  differential: {
    id: 'differential',
    name: 'Pioneer-DX Differential Drive',
    shortName: 'Differential Drive',
    category: 'Non-Holonomic (Unicycle / Diff-Drive)',
    footprintRadius: 0.45,
    clearanceMargin: 0.08,
    wheelRadius: 0.12,
    wheelBase: 0.52,
    maxLinearSpeed: 2.2,
    maxAngularSpeed: 2.8,
    canRotateInPlace: true,
    isHolonomic: false,
    supportedPlanners: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    description:
      'Two independently driven coaxial wheels with caster support. Subject to non-holonomic constraint (zero lateral slip); aligns heading theta before or during forward translation.',
  },
  holonomic: {
    id: 'holonomic',
    name: 'OmniBot-X4 Mecanum Rover',
    shortName: 'Holonomic Omni-Rover',
    category: 'Holonomic (3-DOF Planar)',
    footprintRadius: 0.42,
    clearanceMargin: 0.08,
    wheelRadius: 0.1,
    wheelBase: 0.5,
    maxLinearSpeed: 2.4,
    maxAngularSpeed: 3.2,
    canRotateInPlace: true,
    isHolonomic: true,
    supportedPlanners: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    description:
      'Four-wheel omnidirectional mecanum drive capable of instantaneous translation in any planar direction (vx, vz) independent of chassis orientation.',
  },
  point: {
    id: 'point',
    name: 'MicroScout Point-Approximation Bot',
    shortName: 'Micro Point-Bot',
    category: 'Minimal-Footprint Holonomic',
    footprintRadius: 0.12,
    clearanceMargin: 0.03,
    wheelRadius: 0.06,
    wheelBase: 0.2,
    maxLinearSpeed: 2.5,
    maxAngularSpeed: 4.0,
    canRotateInPlace: true,
    isHolonomic: true,
    supportedPlanners: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    description:
      'Compact 0.12m radius micro-robot used to contrast idealized point-robot path planning against finite-footprint C-space inflation.',
  },
};

export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function shortestAngleDiff(from, to) {
  return normalizeAngle(to - from);
}

/**
 * Computes wheel angular velocities (omega_L, omega_R) from linear velocity v
 * and angular velocity omega using inverse differential-drive kinematics.
 */
export function computeWheelVelocities(v, omega, wheelRadius = 0.12, wheelBase = 0.52) {
  const r = Math.max(0.02, wheelRadius);
  const L = Math.max(0.1, wheelBase);
  const omegaR = (v + (omega * L) / 2) / r;
  const omegaL = (v - (omega * L) / 2) / r;
  return {
    omegaL: Number(omegaL.toFixed(3)),
    omegaR: Number(omegaR.toFixed(3)),
    vReconstructed: Number(((r * (omegaR + omegaL)) / 2).toFixed(3)),
    omegaReconstructed: Number(((r * (omegaR - omegaL)) / L).toFixed(3)),
  };
}

/**
 * Generates a deterministic kinematic motion schedule along a validated path.
 * For differential-drive robots, inserts heading alignment segments when angle changes
 * exceed a threshold; for holonomic models, translates smoothly along each segment.
 */
export function buildMotionProfile(path, robotConfig = {}, environment = {}) {
  const modelKey = robotConfig.model || 'differential';
  const modelSpec = ROBOT_MODELS[modelKey] || ROBOT_MODELS.differential;
  const wheelRadius = Number(robotConfig.wheelRadius ?? modelSpec.wheelRadius);
  const wheelBase = Number(robotConfig.wheelBase ?? modelSpec.wheelBase);
  const vMax = Number(robotConfig.maxLinearSpeed ?? modelSpec.maxLinearSpeed);
  const omegaMax = Number(robotConfig.maxAngularSpeed ?? modelSpec.maxAngularSpeed);
  const isHolonomic = Boolean(robotConfig.isHolonomic ?? modelSpec.isHolonomic);

  const startPose = environment.start || { x: path[0]?.x ?? 0, z: path[0]?.z ?? 0, theta: 0 };
  const goalPose = environment.goal || {
    x: path[path.length - 1]?.x ?? 0,
    z: path[path.length - 1]?.z ?? 0,
    theta: 0,
  };

  if (!Array.isArray(path) || path.length === 0) {
    return {
      totalDuration: 0,
      totalDistance: 0,
      segments: [],
      sampleAtTime: () => ({
        x: startPose.x,
        y: 0,
        z: startPose.z,
        theta: startPose.theta ?? 0,
        v: 0,
        omega: 0,
        omegaL: 0,
        omegaR: 0,
        waypointIndex: 0,
        distanceTraveled: 0,
        distanceRemaining: euclideanDistance2D(startPose, goalPose),
        motionStatus: 'NO_PATH',
      }),
    };
  }

  // Pre-compute cumulative distances from each waypoint to goal
  const segLengths = [];
  let totalPathDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = euclideanDistance2D(path[i], path[i + 1]);
    segLengths.push(d);
    totalPathDistance += d;
  }

  const segments = [];
  let currentTime = 0;
  let currentTheta = Number(startPose.theta ?? 0);
  let cumulativeDist = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dist = segLengths[i];
    if (dist < 1e-4) continue;

    const targetTheta = Math.atan2(p2.z - p1.z, p2.x - p1.x);
    const dTheta = shortestAngleDiff(currentTheta, targetTheta);

    // Non-holonomic differential drive rotates in place when heading delta is significant
    if (!isHolonomic && Math.abs(dTheta) > 0.12) {
      const rotDuration = Math.max(0.18, Math.abs(dTheta) / omegaMax);
      const omegaVal = dTheta / rotDuration;
      const wheels = computeWheelVelocities(0, omegaVal, wheelRadius, wheelBase);

      segments.push({
        type: 'ROTATE',
        waypointIndex: i,
        targetWaypointIndex: i + 1,
        tStart: currentTime,
        tEnd: currentTime + rotDuration,
        duration: rotDuration,
        fromPose: { x: p1.x, z: p1.z, theta: currentTheta },
        toPose: { x: p1.x, z: p1.z, theta: targetTheta },
        distStart: cumulativeDist,
        distEnd: cumulativeDist,
        v: 0,
        omega: Number(omegaVal.toFixed(3)),
        omegaL: wheels.omegaL,
        omegaR: wheels.omegaR,
      });

      currentTime += rotDuration;
      currentTheta = targetTheta;
    }

    // Translation segment from p1 to p2
    const moveDuration = Math.max(0.15, dist / vMax);
    const vVal = dist / moveDuration;
    const omegaVal = isHolonomic ? dTheta / moveDuration : 0;
    const wheels = computeWheelVelocities(vVal, omegaVal, wheelRadius, wheelBase);

    // Find closest obstacle near this segment for rich narration
    let nearestObs = null;
    let minObsDist = Infinity;
    const midPt = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
    const obstacles = environment.obstacles || [];
    for (let k = 0; k < obstacles.length; k++) {
      const dObs = signedDistanceToObstacle(midPt, obstacles[k]);
      if (dObs < minObsDist) {
        minObsDist = dObs;
        nearestObs = obstacles[k];
      }
    }

    segments.push({
      type: 'TRANSLATE',
      waypointIndex: i,
      targetWaypointIndex: i + 1,
      tStart: currentTime,
      tEnd: currentTime + moveDuration,
      duration: moveDuration,
      fromPose: { x: p1.x, z: p1.z, theta: isHolonomic ? currentTheta : targetTheta },
      toPose: { x: p2.x, z: p2.z, theta: targetTheta },
      distStart: cumulativeDist,
      distEnd: cumulativeDist + dist,
      v: Number(vVal.toFixed(3)),
      omega: Number(omegaVal.toFixed(3)),
      omegaL: wheels.omegaL,
      omegaR: wheels.omegaR,
      nearestObstacle:
        nearestObs && minObsDist < 2.2
          ? {
              id: nearestObs.id,
              label: nearestObs.label || nearestObs.id,
              surfaceDistance: Number(minObsDist.toFixed(2)),
            }
          : null,
    });

    currentTime += moveDuration;
    cumulativeDist += dist;
    currentTheta = targetTheta;
  }

  const totalDuration = Number(currentTime.toFixed(3));

  function sampleAtTime(t) {
    if (segments.length === 0 || t <= 0) {
      return {
        x: Number(path[0].x.toFixed(3)),
        y: 0,
        z: Number(path[0].z.toFixed(3)),
        theta: Number((startPose.theta ?? 0).toFixed(3)),
        v: 0,
        omega: 0,
        omegaL: 0,
        omegaR: 0,
        waypointIndex: 0,
        distanceTraveled: 0,
        distanceRemaining: Number(totalPathDistance.toFixed(3)),
        motionStatus: 'READY',
        nearestObstacle: null,
      };
    }

    if (t >= totalDuration) {
      const lastPt = path[path.length - 1];
      return {
        x: Number(lastPt.x.toFixed(3)),
        y: 0,
        z: Number(lastPt.z.toFixed(3)),
        theta: Number(currentTheta.toFixed(3)),
        v: 0,
        omega: 0,
        omegaL: 0,
        omegaR: 0,
        waypointIndex: path.length - 1,
        distanceTraveled: Number(totalPathDistance.toFixed(3)),
        distanceRemaining: 0,
        motionStatus: 'GOAL_REACHED',
        nearestObstacle: null,
      };
    }

    // Locate active segment
    let activeSeg = segments[segments.length - 1];
    for (let i = 0; i < segments.length; i++) {
      if (t >= segments[i].tStart && t <= segments[i].tEnd) {
        activeSeg = segments[i];
        break;
      }
    }

    const alpha = Math.min(
      1,
      Math.max(0, (t - activeSeg.tStart) / Math.max(1e-5, activeSeg.duration))
    );

    const x = activeSeg.fromPose.x + (activeSeg.toPose.x - activeSeg.fromPose.x) * alpha;
    const z = activeSeg.fromPose.z + (activeSeg.toPose.z - activeSeg.fromPose.z) * alpha;
    const dTheta = shortestAngleDiff(activeSeg.fromPose.theta, activeSeg.toPose.theta);
    const theta = normalizeAngle(activeSeg.fromPose.theta + dTheta * alpha);
    const distSoFar =
      activeSeg.distStart + (activeSeg.distEnd - activeSeg.distStart) * alpha;
    const distRem = Math.max(0, totalPathDistance - distSoFar);

    return {
      x: Number(x.toFixed(3)),
      y: 0,
      z: Number(z.toFixed(3)),
      theta: Number(theta.toFixed(3)),
      v: activeSeg.v,
      omega: activeSeg.omega,
      omegaL: activeSeg.omegaL,
      omegaR: activeSeg.omegaR,
      waypointIndex: activeSeg.targetWaypointIndex,
      distanceTraveled: Number(distSoFar.toFixed(3)),
      distanceRemaining: Number(distRem.toFixed(3)),
      motionStatus:
        activeSeg.type === 'ROTATE' ? 'ROTATING_TO_HEADING' : 'FOLLOWING_VALIDATED_PATH',
      nearestObstacle: activeSeg.nearestObstacle || null,
    };
  }

  return {
    totalDuration,
    totalDistance: Number(totalPathDistance.toFixed(3)),
    wheelRadius,
    wheelBase,
    isHolonomic,
    modelName: modelSpec.name,
    segments,
    sampleAtTime,
  };
}
