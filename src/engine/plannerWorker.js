/**
 * Web Worker for offloading motion planning and timeline generation
 * from the main UI thread on dense grids or high-iteration RRT searches.
 */

import { executeMotionPlan } from './planners/index.js';
import { compareAlgorithms } from './comparison.js';

self.onmessage = (event) => {
  const { id, type, payload } = event.data || {};
  try {
    if (type === 'COMPARE_ALGORITHMS') {
      const comparison = compareAlgorithms(payload);
      self.postMessage({ id, ok: true, result: comparison });
    } else {
      const planResult = executeMotionPlan(payload);
      self.postMessage({ id, ok: true, result: planResult });
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message || 'Worker planning error',
    });
  }
};
