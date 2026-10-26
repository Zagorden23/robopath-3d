/** Deterministic seeded RNG (mulberry32) — guarantees repeatable demos and RRT runs. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

export function createRng(seed = 1) {
  const next = mulberry32(seed);
  return {
    next,
    /** Float in [0, 1). */
    float: () => next(),
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [0, max). */
    int: (max) => Math.floor(next() * max),
    /** Integer within [min, max). */
    intRange: (min, max) => min + Math.floor(next() * (max - min)),
    /** True with probability p. */
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
