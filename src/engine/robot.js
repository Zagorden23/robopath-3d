/**
 * Robot models + kinematics. The differential-drive and holonomic
 * (point/omnidirectional) models are fully implemented for planning and
 * animation. The car-like bicycle model is intentionally exposed as
 * "concept only" so the UI never fakes a feature.
 */
import { angleDiff, clamp, wrapAngle } from './geometry.js';

export const ROBOT_TYPES = [
  {
    id: 'differential',
    label: 'Differential drive',
    description: 'Two independently driven wheels; can rotate in place. Implemented.',
    canRotateInPlace: true,
    usesWheelKinematics: true,
    implemented: true,
  },
  {
    id: 'holonomic',
    label: 'Holonomic point robot',
    description: 'Idealized circular body that slides along the path. Implemented.',
    canRotateInPlace: true,
    usesWheelKinematics: false,
    implemented: true,
  },
  {
    id: 'car',
    label: 'Car-like (Ackermann)',
    description: 'Minimum-curvature steering model. Educational concept — not implemented.',
    canRotateInPlace: false,
    usesWheelKinematics: false,
    implemented: false,
  },
];

export function createRobot(config = {}) {
  const model = ROBOT_TYPES.some((t) => t.id === config.model) ? config.model : 'differential';
  const type = ROBOT_TYPES.find((t) => t.id === model);
  return {
    model,
    typeInfo: type,
    /** Footprint radius (m) — used for collision inflation. */
    radius: clamp(config.radius ?? 0.35, 0.05, 1.5),
    wheelRadius: clamp(config.wheelRadius ?? 0.05, 0.01, 0.4),
    wheelSeparation: clamp(config.wheelSeparation ?? 0.3, 0.05, 2),
    maxSpeed: clamp(config.maxSpeed ?? 1.2, 0.05, 6),
    maxOmega: clamp(config.maxOmega ?? Math.PI / 2, 0.1, Math.PI * 2),
    /** Initial pose on the floor. */
    startPose: {
      x: config.startPose?.x ?? 0.5,
      y: config.startPose?.y ?? 0.5,
      theta: Number.isFinite(config.startPose?.theta) ? config.startPose.theta : 0,
    },
    goalPose: {
      x: config.goalPose?.x ?? 1.5,
      y: config.goalPose?.y ?? 1.5,
      theta: Number.isFinite(config.goalPose?.theta) ? config.goalPose.theta : null,
    },
  };
}

/** Node speeds (rad/s) that produce linear velocity v and body spin omega. */
export function wheelSpeeds(robot, v, omega) {
  const L = robot.wheelSeparation;
  const r = robot.wheelRadius;
  return {
    omegaR: (v + (omega * L) / 2) / r,
    omegaL: (v - (omega * L) / 2) / r,
  };
}

/**
 * Convert a validated polyline path into a list of "turn" and "move" motion
 * segments compatible with the robot model. TurnGeometry: differential-drive
 * rotates in place; holonomic robot simply re-aims (its heading is cosmetic).
 */
export function buildMotionSegments(path, robot, { speedFactor = 0.75 } = {}) {
  if (!path || path.length < 2) {
    return { segments: [], duration: 0 };
  }
  const v = robot.maxSpeed * clamp(speedFactor, 0.05, 1);
  const maxOmega = robot.maxOmega;
  const segments = [];
  let t = 0;
  let theta = path[0].theta ?? 0;

  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const target = wrapAngle(heading);
    const delta = angleDiff(theta, target);

    if (Math.abs(delta) > 1e-3) {
      const dur = Math.abs(delta) / maxOmega;
      segments.push({
        kind: 'turn',
        t0: t, t1: t + dur,
        fromTheta: theta, toTheta: target,
        center: { x: a.x, y: a.y },
        omega: Math.sign(delta) * maxOmega,
        speed: 0,
      });
      t += dur;
      theta = target;
    }
    if (segLen > 1e-6) {
      const dur = segLen / v;
      segments.push({
        kind: 'move',
        t0: t, t1: t + dur,
        from: { x: a.x, y: a.y },
        to: { x: b.x, y: b.y },
        theta: target,
        speed: v,
        length: segLen,
        index: i - 1,
      });
      t += dur;
    }
  }

  // Optional final alignment to the requested goal heading.
  const goalTheta = robot.goalPose?.theta;
  if (Number.isFinite(goalTheta)) {
    const finalTurn = angleDiff(theta, goalTheta);
    if (Math.abs(finalTurn) > 1e-3) {
      const dur = Math.abs(finalTurn) / maxOmega;
      segments.push({
        kind: 'turn',
        t0: t, t1: t + dur,
        fromTheta: theta, toTheta: goalTheta,
        center: { x: path[path.length - 1].x, y: path[path.length - 1].y },
        omega: Math.sign(finalTurn) * maxOmega,
        speed: 0,
        isFinal: true,
      });
      t += dur;
    }
  }

  return { segments, duration: t };
}

/** Wheel rotation (rad) accumulated over the run up to `t` — pure archive. */
export function wheelSpinUpTo(segments, t, robot) {
  let spin = 0;
  for (const seg of segments) {
    if (seg.t1 <= t) {
      const dur = seg.t1 - seg.t0;
      const target = seg.kind === 'move' ? seg.speed : 0;
      const w = robot.typeInfo.usesWheelKinematics
        ? Math.abs(wheelSpeeds(robot, target, seg.omega ?? 0).omegaR)
        : Math.abs(seg.omega ?? 0);
      spin += w * dur;
    }
  }
  return spin;
}

export const evaluatePoseAtSegments = (segments, t) => {
  for (const seg of segments) {
    if (t >= seg.t0 && t <= seg.t1) {
      const local = (t - seg.t0) / Math.max(1e-6, seg.t1 - seg.t0);
      if (seg.kind === 'turn') {
        return {
          x: seg.center.x,
          y: seg.center.y,
          theta: seg.fromTheta + (seg.toTheta - seg.fromTheta) * local,
          v: 0,
          omega: seg.omega,
          active: { kind: 'turn', omega: seg.omega, heading: seg.toTheta },
        };
      }
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * local,
        y: seg.from.y + (seg.to.y - seg.from.y) * local,
        theta: seg.theta,
        v: seg.speed,
        omega: 0,
        active: { kind: 'move', index: seg.index, speed: seg.speed },
      };
    }
  }
  return null;
};
