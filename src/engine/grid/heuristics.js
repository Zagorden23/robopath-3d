/**
 * Heuristic functions for grid-based planners (A* and Greedy Best-First).
 *
 * All heuristics operate on grid-cell offsets, not world coordinates, so they
 * are independent of `cellSize`. The caller multiplies by `cellSize` when the
 * heuristic needs to be expressed in the same units as the edge cost.
 *
 * Admissibility notes:
 *  - Manhattan is admissible for 4-connected movement with unit edge costs.
 *  - Octile is admissible for 8-connected movement where a diagonal step
 *    costs sqrt(2) and an orthogonal step costs 1.
 *  - Euclidean is admissible for both movement models but is weaker than
 *    Octile on an 8-connected grid, so it typically expands more nodes.
 */

export const HEURISTIC_NAMES = ['manhattan', 'euclidean', 'octile'];

export const HEURISTIC_LABELS = {
  manhattan: 'Manhattan',
  euclidean: 'Euclidean',
  octile: 'Octile',
};

const SQRT2 = Math.SQRT2;

/**
 * @param {'manhattan'|'euclidean'|'octile'} name
 * @param {number} dx  column delta (target - current)
 * @param {number} dy  row delta (target - current)
 * @returns {number} heuristic estimate in "step" units
 */
export function heuristicValue(name, dx, dy) {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  switch (name) {
    case 'euclidean':
      return Math.hypot(adx, ady);
    case 'octile':
      return Math.max(adx, ady) + (SQRT2 - 1) * Math.min(adx, ady);
    case 'manhattan':
    default:
      return adx + ady;
  }
}

/**
 * Heuristic estimate between two cells expressed in the same cost units as
 * the movement model. Diagonal steps are priced at sqrt(2) when 8-connected
 * movement is enabled, so the Octile heuristic exactly matches the true cost
 * of an unobstructed diagonal move in that model.
 */
export function heuristicCost(name, dx, dy, allowDiagonal) {
  const raw = heuristicValue(name, dx, dy);
  if (!allowDiagonal) {
    // Manhattan is the tightest admissible estimate for 4-connected movement.
    return Math.abs(dx) + Math.abs(dy);
  }
  return raw;
}

/**
 * Resolve a requested heuristic against the movement model.
 * Octile is only meaningful with 8-connected movement; Manhattan is the
 * matching choice for 4-connected movement.
 */
export function resolveHeuristic(requested, allowDiagonal) {
  if (requested === 'auto' || !requested) {
    return allowDiagonal ? 'octile' : 'manhattan';
  }
  if (requested === 'manhattan' && allowDiagonal) {
    // Still admissible with diagonals (it over-estimates diagonal cost by
    // 2 - sqrt(2)), so it remains valid but loses guidance quality.
    return 'manhattan';
  }
  if (requested === 'octile' && !allowDiagonal) {
    // Octile under-estimates nothing, but Manhattan is strictly tighter here.
    return 'manhattan';
  }
  return requested;
}
