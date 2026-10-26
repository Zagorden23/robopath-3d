/**
 * Simulation timeline: converts plan results into a deterministic, replayable
 * event stream that drives the 3D scene, the playback controls and the
 * floating explanation panel. Every event carries real computed data.
 */
import { evaluatePoseAtSegments, wheelSpeeds } from './robot.js';
import { mergeCollinear } from './plan.js';

const T = {
  init: 900,
  validate: 700,
  planStart: 600,
  batchMin: 10,
  batchMax: 70,
  found: 800,
  noResult: 1100,
  reconstruct: 800,
  validatePath: 900,
  motionStart: 500,
  failedDwell: 1700,
  compare: 2400,
  complete: 600,
};

let seq = 0;
export function resetTimelineSeq() { seq = 0; }

/**
 * @param {Array} results executePlanRun outputs (one per chapter/run)
 * @param {object} scenario the full scenario config
 */
export function buildTimeline(results, scenario = {}, opts = {}) {
  resetTimelineSeq();
  const events = [];
  const runs = [];
  let t = 0;

  const push = (type, runIndex, phase, data, dur = 400, viz = null) => {
    const evt = {
      id: `e${seq++}`,
      t,
      dur,
      endT: t + dur,
      type,
      runIndex,
      phase,
      data,
      viz,
    };
    events.push(evt);
    t += dur;
    return evt;
  };

  const envFirst = results[0]?.env;
  const robotFirst = results[0]?.robot;

  push('sim.init', 0, 'init', {
    envName: envFirst?.name || 'Environment',
    width: envFirst?.width, height: envFirst?.height,
    cellSize: envFirst?.cellSize,
    obstacles: envFirst?.obstacles?.length ?? 0,
    weightZones: envFirst?.weightZones?.length ?? 0,
    model: robotFirst?.model,
    robotRadius: robotFirst?.radius,
    seed: envFirst?.seed,
  }, T.init);

  for (let r = 0; r < results.length; r += 1) {
    const res = results[r];
    const runMeta = {
      runIndex: r,
      label: res.label,
      algorithm: res.algorithm,
      status: res.status || (res.found ? 'found' : 'no_path'),
      chapterT0: t,
      startPose: res.robot?.startPose,
      goalPose: res.robot?.goalPose,
      visitedPoints: [],
      batchEvents: [],
      motionSegments: [],
      motionDuration: 0,
      motionT0: 0,
      finalPose: null,
      path: res.visiblePath || [],
      pathCost: 0,
      pathLength: 0,
      treeEdges: buildTreeEdges(res.nodes || []),
      tPathVisible: 0,
    };
    runs.push(runMeta);

    if (res.note) {
      push('run.meta', r, 'validate', { ...res.note }, T.validate * 0.75);
    }

    push('run.begin', r, 'validate', {
      label: res.label,
      algorithm: res.algorithm,
      runIndex: r + 1,
      totalRuns: results.length,
    }, T.validate * 0.5);

    // --- pose validation ------------------------------------------------
    const collisionClear = (x, y) => res.collisions?.start?.clearance ?? null;
    if (res.status && res.status !== 'found' && res.status !== 'no_path' && res.status !== 'noresult') {
      // sticky pre-planning error (out_of_bounds / *_in_obstacle / start_blocked / goal_blocked)
      push('validate.error', r, 'validation', {
        status: res.status,
        message: res.message,
        obstacleId: res.obstacleId || null,
        which: res.status.startsWith('start') ? 'start' : res.status.startsWith('goal') ? 'goal' : 'configuration',
      }, T.validate, res.obstacleId ? { type: 'obstacle', obstacleId: res.obstacleId } : null);
      push('run.failed', r, 'validation', { reason: res.status }, T.failedDwell);
      runMeta.chapterT1 = t;
      continue;
    }

    push('validate.pose', r, 'validation', {
      start: res.start, goal: res.goal,
      startTheta: res.robot?.startPose?.theta ?? 0,
      footprint: res.robot?.radius,
    }, T.validate * 0.5);

    push('plan.start', r, 'planning', {
      algorithm: res.algorithm,
      label: res.label,
      connectivity: res.connectivity,
      heuristic: res.heuristicName,
      weightsUsed: (res.env?.weightZones?.length ?? 0) > 0,
      obstacleCount: res.env?.obstacles?.length ?? 0,
    }, T.planStart);

    // --- planning exploration -------------------------------------------
    let batchEvents = [];
    if (res.algorithm !== 'rrt') {
      batchEvents = pushExploreBatches(push, r, res.visited || [], res.peakFrontier || 0, opts, res.env);
    } else {
      batchEvents = pushRrtBatches(push, r, res);
    }

    // --- outcome ----------------------------------------------------------
    const outcome = planOutcomeEvent(push, r, res, batchEvents.length);
    runMeta.tPathVisible = outcome.pathVisibleAt;

    if (outcome.kind === 'found') {
      push('plan.reconstruct', r, 'planning', {
        waypoints: res.visiblePath?.length ?? 0,
        pathLength: res.pathLength,
        pathCost: res.pathCost,
      }, T.reconstruct);

      const vres = res.validation || { ok: true };
      push('plan.validate', r, 'validation', {
        ok: vres.ok,
        clearance: vres.minClearance,
        required: vres.required,
        at: vres.ok ? null : vres.at,
        obstacleId: vres.ok ? null : (vres.obstacleId ?? null),
        pathLength: res.pathLength,
      }, T.validatePath, vres.ok ? null : (vres.at ? { type: 'point', x: vres.at.x, y: vres.at.y } : null));

      if (vres.ok) {
        // --- motion -----------------------------------------------------
        const merged = mergeCollinear(res.visiblePath || []);
        const { segments, duration } = buildMotionSegments(merged, res.robot, { speedFactor: scenario.motion?.speedFactor ?? 0.7 });
        runMeta.motionSegments = segments;
        runMeta.motionDuration = duration;
        runMeta.motionT0 = t;
        runMeta.finalPose = lastPoseOf(segments, res.robot?.startPose);
        runMeta.pathCost = res.pathCost ?? 0;
        runMeta.pathLength = res.pathLength ?? 0;

        push('motion.start', r, 'motion', {
          pathLength: res.pathLength,
          speed: res.robot?.maxSpeed * (scenario.motion?.speedFactor ?? 0.7),
          waypoints: segments.filter((s) => s.kind === 'move').length,
        }, T.motionStart);

        let remaining = res.pathLength ?? 0;
        for (const seg of segments) {
          const at = seg.kind === 'turn' ? seg.center : seg.from;
          const data = seg.kind === 'turn'
            ? { kind: 'turn', heading: seg.toTheta, omega: seg.omega, wheel: wheelSpeeds(res.robot, 0, seg.omega) }
            : {
                kind: 'move', from: seg.from, to: seg.to,
                distance: seg.length, speed: seg.speed,
                remaining,
                wheel: wheelSpeeds(res.robot, seg.speed, 0),
              };
          push(seg.kind === 'turn' ? 'motion.turn' : 'motion.move', r, 'motion', data, 0, { type: 'waypoint', x: at.x, y: at.y });
          if (seg.kind === 'move') remaining = Math.max(0, remaining - seg.length);
        }

        push('goal.reached', r, 'complete', {
          simTime: t + T.complete * 0.4,
          pathLength: res.pathLength,
          pathCost: res.pathCost,
          travelDuration: duration,
        }, T.complete);
      } else {
        push('run.failed', r, 'validation', {
          reason: 'invalid_path',
          message: 'The planned route grazes an obstacle — validation rejected it.',
          at: vres.at,
        }, T.failedDwell, vres.at ? { type: 'point', x: vres.at.x, y: vres.at.y } : null);
      }
    } else {
      push('run.failed', r, 'planning', {
        reason: res.reason === 'max_iterations' ? 'no_path' : res.reason,
        message: res.message || resultFailureMessage(res),
        nodesExpanded: res.nodesExpanded,
      }, T.failedDwell);
    }

    runMeta.chapterT1 = t;
  }

  // --- comparison summary --------------------------------------------------
  if ((scenario.compare || results.length > 1) && results.every((r) => r)) {
    push('compare.summary', results.length - 1, 'compare', {
      rows: results.map((res) => ({
        runIndex: res.runIndex,
        label: res.label,
        algorithm: res.algorithm,
        ok: !!(res.found && (!res.validation || res.validation.ok)),
        reason: res.found ? (res.validation && !res.validation.ok ? 'invalid_path' : 'found') : res.reason,
        nodesExpanded: res.nodesExpanded ?? 0,
        planTimeMs: res.metrics?.planTimeMs ?? 0,
        pathLength: res.pathLength ?? 0,
        pathCost: res.pathCost ?? 0,
        peakFrontier: res.peakFrontier ?? 0,
      })),
    }, T.compare);
  }

  push('sim.complete', results.length - 1, 'complete', { chapters: results.length }, T.complete);

  const durationMs = events.reduce((acc, e) => Math.max(acc, e.endT), 400);
  runs.forEach((run) => {
    run.visitedPoints = run.batchEvents.flatMap((b) => b.data.nodes || []);
  });

  return {
    events,
    runs,
    durationMs,
    scenario: {
      algorithm: results[0]?.algorithm,
      model: results[0]?.robot?.model,
      voice: results[0]?.label,
    },
  };
}

function lastPoseOf(segments, startPose) {
  if (!segments.length) return startPose;
  const last = segments[segments.length - 1];
  if (last.kind === 'turn') return { x: last.center.x, y: last.center.y, theta: last.toTheta };
  return { x: last.to.x, y: last.to.y, theta: last.theta };
}

function planOutcomeEvent(push, r, res, batchCount) {
  if (res.found) {
    const ev = push('plan.found', r, 'planning', {
      nodesExpanded: res.nodesExpanded,
      planTimeMs: res.metrics?.planTimeMs ?? 0,
      pathCost: res.pathCost,
      peakFrontier: res.peakFrontier,
    }, T.found);
    return { kind: 'found', pathVisibleAt: ev.endT };
  }
  const ev = push('plan.noresult', r, 'planning', {
    reason: res.reason === 'max_iterations' ? 'no_path' : res.reason,
    nodesExpanded: res.nodesExpanded,
    planTimeMs: res.metrics?.planTimeMs ?? 0,
    batchCount,
  }, T.noResult);
  return { kind: 'noresult', pathVisibleAt: ev.endT };
}

function resultFailureMessage(res) {
  switch (res.reason) {
    case 'no_path': return 'No route connects start and goal with the current robot footprint.';
    case 'start_blocked': return 'The start cell can not host the robot at this resolution.';
    case 'goal_blocked': return 'The goal cell can not host the robot at this resolution.';
    case 'max_iterations': return 'RRT hit its iteration limit before connecting to the goal.';
    default: return 'The planner could not return a route.';
  }
}

/** Batch grid expansions into readable exploration events (world coords included). */
function pushExploreBatches(push, r, visited, peakFrontier, opts, env) {
  if (!visited.length) return [];
  const count = visited.length;
  const numBatches = Math.min(count, opts.exploreBatches ?? 90);
  const batchSize = Math.max(T.batchMin, Math.ceil(count / numBatches));
  const perEvent = Math.min(T.batchMax, Math.max(14, 15000 / Math.ceil(count / batchSize)));
  const cs = env.cellSize;
  const toWorld = (n) => {
    const w = env.cellCenter(n.ix, n.iy);
    return { x: w.x, y: w.y, ix: n.ix, iy: n.iy, g: n.g, h: n.h, f: n.f };
  };
  const batchEvents = [];
  let idx = 0;
  let cum = 0;
  while (idx < count) {
    const slice = visited.slice(idx, idx + batchSize);
    cum += slice.length;
    const nodes = slice.map(toWorld);
    const last = nodes[nodes.length - 1];
    const ev = push('exploration.batch', r, 'planning', {
      count: slice.length,
      cum,
      total: count,
      nodes,
      current: last,
      peakFrontier,
    }, perEvent, { type: 'node', x: last.x, y: last.y, g: last.g, h: last.h, f: last.f });
    batchEvents.push(ev);
    idx += batchSize;
  }
  return batchEvents;
}

/** RRT: batch sample attempts, accepted tree nodes and edges. */
function pushRrtBatches(push, r, res) {
  const samples = res.samples || [];
  const nodes = res.nodes || [];
  if (!samples.length) return [];
  const numBatches = Math.min(samples.length, 110);
  const batchSize = Math.max(6, Math.ceil(samples.length / numBatches));
  const perEvent = Math.min(70, Math.max(18, 12000 / Math.ceil(samples.length / batchSize)));
  const batchEvents = [];
  let idx = 0;
  let cum = 0;
  let cumAccepted = 0;
  while (idx < samples.length) {
    const slice = samples.slice(idx, idx + batchSize);
    cum += slice.length;
    slice.forEach((s) => { if (!s.rejected) cumAccepted += 1; });
    const last = slice[slice.length - 1];
    batchEvents.push(push('exploration.batch', r, 'planning', {
      sampler: 'rrt',
      count: slice.length,
      cum,
      total: samples.length,
      nodes: slice.map((s) => ({ x: s.x, y: s.y, g: s.rejected ? -1 : 1, rejected: !!s.rejected })),
      treeEdgesCount: cumAccepted,
      current: last ? { x: last.x, y: last.y, rejected: !!last.rejected } : null,
      peakFrontier: nodes.length,
    }, perEvent, { type: 'node', x: last?.x, y: last?.y, rejected: !!last?.rejected }));
    idx += batchSize;
  }
  return batchEvents;
}

export function buildTreeEdges(nodes) {
  const edges = [];
  for (const n of nodes) {
    if (n.parent >= 0) edges.push([n.parent, n.id]);
  }
  return edges;
}

/* ---------- playback core ---------- */

function bisect(arr, t) {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export function stateAt(timeline, tMs) {
  const t = Math.max(0, Math.min(timeline.durationMs, tMs));
  const { events, runs } = timeline;
  const eventIdx = bisect(events, t);
  const currentEvent = eventIdx >= 0 ? events[eventIdx] : events[0];

  let runIdx = 0;
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i];
    if (t >= run.chapterT0 && t <= run.chapterT1 + 400) { runIdx = i; break; }
    if (t > run.chapterT1) runIdx = i;
  }
  const run = runs[runIdx];

  // exploration visibility: full for completed chapters, partial for the current one
  let explorers = 0;
  let explorersTotal = 0;
  runs.forEach((rex, i) => {
    explorersTotal += rex.visitedPoints.length;
    if (i < runIdx) explorers += rex.visitedPoints.length;
  });
  if (run) {
    const shown = run.batchEvents.filter((e) => e.t <= t);
    const lastBatch = shown[shown.length - 1];
    explorers += lastBatch ? lastBatch.data.cum : 0;
    explorersTotal -= run.visitedPoints.length;
    explorersTotal += (lastBatch ? lastBatch.data.total : 0);
  }

  // robot pose
  let robot = null;
  if (run?.startPose) {
    robot = { ...run.startPose, v: 0, omega: 0, heading: run.startPose.theta ?? 0, wheel: { omegaR: 0, omegaL: 0 } };
  }
  if (run && run.motionSegments && run.motionSegments.length) {
    const localT = t - run.motionT0;
    if (localT >= 0) {
      const pose = evaluatePoseAtSegments(run.motionSegments, localT);
      if (pose) {
        const usesWheel = run.robot?.typeInfo?.usesWheelKinematics;
        robot = {
          x: pose.x, y: pose.y, theta: pose.theta, v: pose.v, omega: pose.omega,
          heading: pose.theta,
          wheel: usesWheel ? wheelSpeeds(run.robot, pose.v, pose.omega) : { omegaR: 0, omegaL: 0 },
          waypointIndex: pose.active?.kind === 'move' ? pose.active.index : null,
          doing: pose.active?.kind,
        };
      }
    }
  }

  const next = events[eventIdx + 1] || null;
  return {
    time: t,
    duration: timeline.durationMs,
    progress: timeline.durationMs ? t / timeline.durationMs : 0,
    eventIdx,
    currentEvent,
    nextEvent: next,
    phase: phaseOf(currentEvent),
    runIndex: runIdx,
    run,
    explorers,
    explorersTotal,
    isComplete: t >= timeline.durationMs - 1,
    isFailedNow: currentEvent.type === 'run.failed' || currentEvent.type === 'plan.noresult' || currentEvent.type === 'validate.error',
    robot,
  };
}

const phaseLabels = {
  init: 'Environment setup',
  validate: 'Start & goal validation',
  validation: 'Path validation',
  planning: 'Algorithm planning',
  motion: 'Robot motion',
  complete: 'Goal reached',
  compare: 'Algorithm comparison',
};

export function phaseOf(event) {
  if (!event) return 'Environment setup';
  if (event.type === 'run.failed') return event.phase === 'validation' ? 'Path validation' : 'Planning failed';
  return phaseLabels[event.phase] || event.phase;
}
