/**
 * Mathematics behind the motion — KaTeX registry.
 * Only formulas matching the active algorithm / robot model / event are shown.
 * Every entry pairs a simple explanation with a technical one.
 */
export const FORMULAS = {
  'astar.est': {
    title: 'A* node evaluation',
    latex: 'f(n) = g(n) + h(n)',
    simple: 'A* ranks every candidate cell by combining real walking cost so far (g) with an optimistic guess of what is left (h). The robot expands the cell with the smallest sum first.',
    technical: 'g(n) is the exact accumulated edge cost from the start cell to n; h(n) is a heuristic estimate toward the goal. If h is admissible (never above the true remaining cost) and consistent, A* returns an optimal path and expands far fewer nodes than Dijkstra.',
    variables: [
      { sym: 'g(n)', desc: 'cost accumulated from start' },
      { sym: 'h(n)', desc: 'heuristic estimate to goal' },
      { sym: 'f(n)', desc: 'estimated total cost through n' },
    ],
  },
  'dijkstra.relax': {
    title: 'Dijkstra relaxation',
    latex: 'g(v) = \\min\\big(g(v),\\; g(u) + c(u,v)\\big)',
    simple: 'Every time Dijkstra reaches a neighbour v through u, it checks whether the route via u is cheaper than anything seen before, and keeps the best known value.',
    technical: 'A priority queue orders unexplored nodes by g. When a node pops first, its g value is final — so the first time the goal pops, its cost is optimal (for non-negative edge costs c(u, v)).',
    variables: [
      { sym: 'c(u,v)', desc: 'non-negative edge cost u→v' },
      { sym: 'g(u)', desc: 'known cost to u' },
    ],
  },
  'bfs.level': {
    title: 'BFS layer growth',
    latex: 'd(v) = d(u) + 1',
    simple: 'BFS explores the map like ripples: first all cells 1 step away, then 2 steps, and so on. The first time it touches the goal, that ripple distance is the minimum number of edges.',
    technical: 'On an unweighted graph every edge has identical cost, so expanding in layer order guarantees the first path reaching the goal contains the fewest edges. On weighted terrain BFS minimises edge count, not cost.',
    variables: [{ sym: 'd(v)', desc: 'edge distance from start' }],
  },
  'heuristic.manhattan': {
    title: 'Manhattan heuristic',
    latex: 'h(n) = |x_n - x_{\\text{goal}}| + |y_n - y_{\\text{goal}}|',
    simple: 'Count city-block steps: only horizontal and vertical moves are allowed, so this guesses the minimum number of steps left.',
    technical: 'Admissible and consistent for 4-connected uniform-cost grids because every real path needs at least |Δx| + |Δy| axis steps.',
  },
  'heuristic.octile': {
    title: 'Octile heuristic',
    latex: 'h(n) = (\\Delta x + \\Delta y) + (\\sqrt{2} - 2)\\,\\min(\\Delta x, \\Delta y)',
    simple: 'For maps where diagonal moves are allowed, this guesses the minimum cost left using the cheapest diagonal-friendly path.',
    technical: 'Equivalent to D* with Euclidean decorrelation: max(Δx, Δy) + (√2−1)·min(Δx, Δy). Admissible and consistent for 8-connected grids whose diagonal edges cost √2 times a straight edge.',
  },
  'heuristic.euclidean': {
    title: 'Euclidean heuristic',
    latex: 'h(n) = \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}',
    simple: 'Straight-line "as the crow flies" distance — always realistic and never too optimistic.',
    technical: 'Admissible for any movement model because no path can be shorter than the Euclidean distance. Slightly less informative than octile on 8-connected grids.',
  },
  'euclid.2d': {
    title: 'Euclidean distance (plane)',
    latex: 'd(p,q) = \\sqrt{(x_q - x_p)^2 + (y_q - y_p)^2}',
    simple: 'The straight-line distance between two points on the floor — used for path length and heuristic estimates.',
    technical: 'Used wherever the robot lives on the ground plane: edge lengths, RRT steering distance and path-length metrics are all computed with this formula.',
  },
  'euclid.3d': {
    title: 'Euclidean distance (3D)',
    latex: 'd(p,q) = \\sqrt{(x_q - x_p)^2 + (y_q - y_p)^2 + (z_q - z_p)^2}',
    simple: 'The same rule, extended with height. In this scene the robot drives on the floor so the z-term is zero; aerial or voxel planners apply exactly this formula.',
    technical: 'General n-term Euclidean norm. For 3D voxel planners with diagonal movements (26-connectivity) the tri(vector) norm extends to the octile rule over three axes.',
  },
  'pose.planar': {
    title: 'Robot pose',
    latex: 'q = (x,\\, y,\\, \\theta)',
    simple: 'A planar pose is position on the floor plus a heading angle.',
    technical: 'For a 3D rigid body, position becomes (x, y, z) and orientation needs three angles, a rotation matrix or a quaternion — three scalars (x, y, θ) are not enough in full 3D.',
    variables: [
      { sym: '(x, y)', desc: 'floor position' },
      { sym: 'θ', desc: 'heading angle' },
    ],
  },
  'rotation.matrix': {
    title: 'Orientation in 3D',
    latex: 'R_{z}(\\theta) = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta & 0 \\\\ \\sin\\theta & \\cos\\theta & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}',
    simple: 'In full 3D the heading becomes a 3×3 rotation matrix (or a quaternion) attached to the body.',
    technical: 'Orientation lives in the SO(3) manifold; roll-pitch-yaw compositions suffer gimbal issues, which is why simulators and XR runtimes interpolate quaternions.',
  },
  'dd.linear': {
    title: 'Differential drive: linear velocity',
    latex: 'v = \\frac{r\\,(\\omega_{R} + \\omega_{L})}{2}',
    simple: 'The robot speed along its heading is just the average of the two wheel speeds.',
    technical: 'Wheel angular velocities ωR and ωL (rad/s) with wheel radius r produce body speed v (m/s). Equal speeds ⇒ straight line.',
    variables: [
      { sym: 'r', desc: 'wheel radius' },
      { sym: 'ωR, ωL', desc: 'right / left wheel speed' },
      { sym: 'v', desc: 'linear speed of the body' },
    ],
  },
  'dd.angular': {
    title: 'Differential drive: turning rate',
    latex: '\\omega = \\frac{r\\,(\\omega_{R} - \\omega_{L})}{L}',
    simple: 'Spin the wheels at different speeds and the robot curves. Speed difference (and how far apart the wheels sit) decides how quickly it turns.',
    technical: 'L is the wheel separation. ω > 0 turns counter-clockwise. Both equations together are the two-parameter control pair (v, ω) of the unicycle model.',
    variables: [{ sym: 'L', desc: 'distance between the wheels' }],
  },
  'dd.pose': {
    title: 'Differential drive: pose derivative',
    latex: '\\dot{x} = v\\cos\\theta, \\quad \\dot{y} = v\\sin\\theta, \\quad \\dot{\\theta} = \\omega',
    simple: 'How the pose (x, y, θ) changes over time when the robot drives at speed v while rotating at ω.',
    technical: 'Idealised kinematics: no motor dynamics, wheel slip or lateral drift. The animation integrates exactly these equations between waypoints.',
    variables: [
      { sym: 'θ', desc: 'current heading' },
      { sym: 'ω', desc: 'body rotation rate' },
    ],
  },
  'collision.footprint': {
    title: 'Collision checking',
    latex: 'C_{\\text{free}} = \\{\\, q \\; | \\; \\text{dist}(q,\\, \\mathcal{O}) > r \\,\\}',
    simple: 'A pose is safe when the robot body (radius r) keeps its distance from every obstacle O. The planner blocks every cell that is too close.',
    technical: 'Grid planners approximate this by inflating obstacles by the footprint radius; RRT checks exact distances along candidate edges. Validation re-walks the final path at centimetre steps.',
    variables: [
      { sym: '𝒪', desc: 'occupied obstacle geometry' },
      { sym: 'r', desc: 'robot footprint radius' },
    ],
  },
  'path.length': {
    title: 'Path length',
    latex: 'L = \\sum_{i=1}^{n-1} \\lVert p_{i+1} - p_{i} \\rVert_2',
    simple: 'Total driving distance = the sum of the lengths of every straight segment.',
    technical: 'Reported in metres on the world floor; the cost metric (pathCost) can differ when terrain weights change edge prices.',
  },
  'grid.cost': {
    title: 'Weighted edge cost',
    latex: 'c(u,v) = \\ell(u,v) \\cdot \\frac{w_u + w_v}{2}',
    simple: 'Moving through difficult ground costs more: edge length × average terrain weight.',
    technical: 'Weight zones mark cells with multiplier w ≥ 1. Costs stay positive, which preserves Dijkstra/A* optimality guarantees.',
    variables: [
      { sym: 'ℓ(u,v)', desc: 'geometric step length (1 or √2 cells)' },
      { sym: 'w_u, w_v', desc: 'terrain weights of the cells' },
    ],
  },
  'rrt.sample': {
    title: 'RRT sampling loop',
    latex: 'x_{\\text{new}} = x_{\\text{near}} + \\frac{\\varepsilon}{\\lVert x_{\\text{rand}} - x_{\\text{near}} \\rVert}\\big(x_{\\text{rand}} - x_{\\text{near}}\\big)',
    simple: 'RRT draws a random point, finds the nearest tree node and stretches one branch part-way toward it, then asks the collision checker whether the move is legal.',
    technical: 'ε is the extension step. With goal-bias probability p the sample is the goal itself. Tree edges are only added when the swept segment is collision-free; the result is feasible but not necessarily the globally shortest route.',
    variables: [
      { sym: 'ε', desc: 'extension step size' },
      { sym: 'p', desc: 'goal bias probability' },
    ],
  },
  'trajectory.timing': {
    title: 'Time parameterisation (concept)',
    latex: 's(t):\\ [0, T] \\to [0, L], \\qquad \\dot{s} \\le v_{\\max}',
    simple: 'A geometric path says where to go, not when or how fast. Turning it into a timed trajectory (s(t)) with velocity and acceleration limits is a separate planning stage.',
    technical: 'RoboPath plays back paths at a constant comforted speed (v depends on your speed factor). A true trapezoidal velocity profile / time-optimal parameterisation is a future extension and is not silently pretended here.',
  },
  'kin.wheelmap': {
    title: 'Wheel control mapping',
    latex: '\\omega_{R} = \\frac{v + \\tfrac{\\omega L}{2}}{r}, \\qquad \\omega_{L} = \\frac{v - \\tfrac{\\omega L}{2}}{r}',
    simple: 'The inverse of the drive equations: given the speed (v) and turning rate (ω) the robot needs, this computes each wheel command.',
    technical: 'Used by the motion player: every segment declares (v, ω) and the simulator reports the matching wheel angular velocities live.',
  },
};

export const FORMULA_IDS = Object.keys(FORMULAS);

/** Which formulas matter for the current algorithm (+ robot) — bounded list. */
export function formulasForAlgorithm(algorithm, robotModel) {
  const list = [];
  if (algorithm === 'astar') list.push('astar.est');
  if (algorithm === 'dijkstra') list.push('dijkstra.relax');
  if (algorithm === 'bfs') list.push('bfs.level');
  if (algorithm === 'astar' || algorithm === 'rrt') list.push('euclid.2d');
  if (algorithm === 'bfs') list.push('grid.cost');
  if (algorithm === 'rrt') list.push('rrt.sample');
  if (algorithm === 'dijkstra' || algorithm === 'astar') list.push('grid.cost');
  if (robotModel === 'differential') {
    list.push('dd.linear', 'dd.angular', 'dd.pose', 'kin.wheelmap');
  }
  list.push('pose.planar', 'collision.footprint', 'path.length', 'trajectory.timing');
  return list;
}

export function formulasForEvent(event) {
  if (!event) return [];
  switch (event.type) {
    case 'plan.start':
    case 'exploration.batch': {
      if (event.data.sampler === 'rrt') return ['rrt.sample', 'euclid.2d'];
      const a = event.data.algorithm;
      if (a === 'astar') return ['astar.est', 'heuristic.octile', 'grid.cost'];
      if (a === 'dijkstra') return ['dijkstra.relax', 'grid.cost'];
      if (a === 'bfs') return ['bfs.level', 'grid.cost'];
      return [];
    }
    case 'plan.validate':
    case 'validate.error':
    case 'run.failed':
      return event.data?.which || event.data?.reason === 'goal_in_obstacle' || event.data?.reason === 'start_in_obstacle'
        ? ['collision.footprint']
        : ['collision.footprint', 'euclid.2d'];
    case 'validate.pose':
      return ['collision.footprint', 'pose.planar'];
    case 'plan.reconstruct':
    case 'plan.found':
      return ['path.length', 'grid.cost'];
    case 'motion.move':
    case 'motion.turn':
    case 'motion.start':
      return ['dd.linear', 'dd.angular', 'dd.pose', 'kin.wheelmap'];
    case 'goal.reached':
      return ['path.length', 'euclid.3d', 'trajectory.timing'];
    case 'compare.summary':
      return ['path.length'];
    default:
      return [];
  }
}
