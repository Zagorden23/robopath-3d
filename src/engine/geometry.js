/** Geometric primitives shared by the planning engine and scene code. */

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

/** Full 3D Euclidean distance — used wherever a z coordinate is meaningful. */
export function dist3(ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Wrap an angle in radians to (-PI, PI]. */
export function wrapAngle(theta) {
  let t = theta;
  while (t > Math.PI) t -= Math.PI * 2;
  while (t <= -Math.PI) t += Math.PI * 2;
  return t;
}

/** Signed shortest rotation from angle a to angle b, in radians (-PI..PI). */
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

export function round(value, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Interpolate along a polyline of {x,y} points by absolute distance s. */
export function pointOnPolyline(points, s) {
  if (!points || points.length === 0) return null;
  if (s <= 0) return { x: points[0].x, y: points[0].y, segment: 0, t: 0 };
  let acc = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = dist2(a.x, a.y, b.x, b.y);
    if (acc + len >= s || i === points.length - 2) {
      const t = len === 0 ? 0 : clamp((s - acc) / len, 0, 1);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), segment: i, t };
    }
    acc += len;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, segment: points.length - 2, t: 1 };
}

/** Total Euclidean length of a polyline of {x,y} points. */
export function polylineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += dist2(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
  return len;
}

/** Convert a straight home heading (radians 0..2PI-friendly) to degrees for display. */
export function toDegrees(theta) {
  return (theta * 180) / Math.PI;
}
