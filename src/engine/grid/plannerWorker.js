/**
 * Planning Web Worker.
 *
 * Runs the search off the main thread so the UI stays responsive during
 * large searches, and supports cooperative cancellation: the main thread
 * sends a CANCEL message and the worker stops expanding at the next
 * checkpoint, reporting the CANCELLED status honestly rather than returning
 * a partial result dressed up as a complete one.
 *
 * Protocol
 *   main -> worker : { id, type: 'PLAN' | 'COMPARE' | 'CANCEL', payload }
 *   worker -> main : { id, type: 'RESULT' | 'ERROR' | 'PROGRESS', ... }
 */

import { buildOccupancyGrid } from '../grid/grid.js';
import { runPlanner } from '../grid/registry.js';
import { comparePlanners } from '../grid/comparison.js';

/** @type {Map<string, {cancelled: boolean}>} */
const cancellationTokens = new Map();

function isCancelled(token) {
  return token.cancelled;
}

self.onmessage = (event) => {
  const { id, type, payload } = event.data || {};

  try {
    if (type === 'CANCEL') {
      const token = cancellationTokens.get(id);
      if (token) token.cancelled = true;
      return;
    }

    if (type === 'COMPARE') {
      const token = { cancelled: false };
      cancellationTokens.set(id, token);
      try {
        const comparison = comparePlanners({
          ...payload,
          options: {
            ...(payload.options || {}),
            isCancelled: () => isCancelled(token),
          },
        });
        self.postMessage({ id, type: 'RESULT', result: comparison });
      } finally {
        cancellationTokens.delete(id);
      }
      return;
    }

    // Default: PLAN
    const token = { cancelled: false };
    cancellationTokens.set(id, token);
    try {
      const grid = buildOccupancyGrid(payload.environment);
      const result = runPlanner({
        grid,
        planner: payload.planner,
        options: {
          ...(payload.options || {}),
          isCancelled: () => isCancelled(token),
        },
      });
      self.postMessage({ id, type: 'RESULT', result });
    } finally {
      cancellationTokens.delete(id);
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: err?.message || 'Planning worker failed.',
    });
  }
};
