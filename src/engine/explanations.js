/**
 * Mathematical Learning System ("MATHEMATICS BEHIND THE MOTION")
 * and Event-Driven Explanation Synthesizer.
 */

export const MATH_CONCEPTS = {
  ASTAR: {
    id: 'ASTAR',
    code: 'A',
    title: 'A* Heuristic Search',
    category: 'Path Planning',
    relevantAlgorithms: ['ASTAR'],
    primaryFormula: 'f(n) = g(n) + h(n)',
    secondaryFormulas: [
      {
        label: 'Manhattan Heuristic (4-Connected)',
        latex: 'h_{\\text{Manhattan}}(n, g) = |x_g - x_n| + |z_g - z_n|',
      },
      {
        label: 'Octile Heuristic (8-Connected Grid)',
        latex: 'h_{\\text{Octile}}(n, g) = D(\\Delta x + \\Delta z) + (\\sqrt{2}D - 2D)\\min(\\Delta x, \\Delta z)',
      },
      {
        label: 'Admissibility & Consistency',
        latex: '0 \\le h(n) \\le h^*(n), \\quad h(n) \\le c(n, n^\\prime) + h(n^\\prime)',
      },
    ],
    simpleExplanation:
      'A* combines the exact distance already traveled from the start g(n) with an educated guess h(n) of how far remains to the goal. This focuses the search toward the goal instead of expanding blindly in all directions.',
    technicalExplanation:
      'A* orders its priority queue by f(n) = g(n) + h(n). When h(n) is admissible (never overestimates true optimal cost h*(n)) and consistent (satisfies the triangle inequality h(n) <= c(n,n\') + h(n\')), A* is guaranteed to find an optimal least-cost path without re-expanding closed nodes.',
    derivation:
      'Let g*(n) be the optimal path cost from start s to n, and h*(n) be the optimal cost from n to goal. Any node expanded with f(n) = g(n) + h(n) <= g(n) + h*(n) = C* is bounded by the true optimal cost C*. For 4-connected uniform grids, Manhattan distance is exact in obstacle-free space; for 8-connected grids with diagonal cost sqrt(2), Octile or Euclidean distance preserves admissibility.',
    highlightType: 'ASTAR_VECTORS',
    highlightLabel: 'Highlight g(n) & h(n) Vectors in 3D Scene',
  },

  DIJKSTRA: {
    id: 'DIJKSTRA',
    code: 'B',
    title: "Dijkstra's Shortest-Path Algorithm",
    category: 'Path Planning',
    relevantAlgorithms: ['DIJKSTRA', 'ASTAR'],
    primaryFormula: 'g(v) = \\min\\bigl(g(v),\\; g(u) + c(u,v)\\bigr), \\quad c(u,v) \\ge 0',
    secondaryFormulas: [
      {
        label: 'Priority Queue Complexity',
        latex: '\\mathcal{O}\\bigl((|V| + |E|)\\log |V|\\bigr)',
      },
    ],
    simpleExplanation:
      'Dijkstra expands outward from the start in order of actual travel cost. Whenever it finds a cheaper way to reach a neighbor cell v through u, it updates v with that lower cost.',
    technicalExplanation:
      'Using a binary min-heap priority queue keyed on accumulated cost g(u), Dijkstra extracts the unvisited vertex with minimum g(u) and relaxes all outgoing edges (u,v) with non-negative weights c(u,v) >= 0. Because edge costs are non-negative, the first time the goal is extracted from the priority queue, its path is guaranteed to be globally optimal even across weighted terrain.',
    derivation:
      'By induction on the closed set S: when vertex u is extracted with minimum g(u) among V \\ S, any alternative path to u must pass through some frontier vertex w in V \\ S with g(w) >= g(u). Since all edge weights c(x,y) >= 0, no path through w can reduce g(u).',
    highlightType: 'EXPLORED_FRONTIER',
    highlightLabel: 'Highlight Cost-Ordered Frontier in 3D Scene',
  },

  BFS: {
    id: 'BFS',
    code: 'C',
    title: 'Breadth-First Search (BFS)',
    category: 'Path Planning',
    relevantAlgorithms: ['BFS'],
    primaryFormula: 'L_k = \\bigl\\{ v \\in V \\;\\big|\\; \\text{edges}(s, v) = k \\bigr\\}',
    secondaryFormulas: [
      {
        label: 'FIFO Queue Invariant',
        latex: 'd(v) = d(u) + 1 \\quad \\forall (u,v) \\in E',
      },
    ],
    simpleExplanation:
      'BFS explores the map ring-by-ring: first all cells 1 step away, then 2 steps away, then 3 steps away. It always finds the path with the fewest grid steps, but ignores terrain cost differences.',
    technicalExplanation:
      'BFS maintains a First-In-First-Out (FIFO) queue. It partitions reachable vertices into concentric hop-count layers L_0, L_1, ..., L_k. In an unweighted graph where every edge has uniform cost, minimum hop count equals minimum path cost; however, on weighted terrain or diagonal grids, BFS can choose a higher-cost route.',
    derivation:
      'Because vertices are enqueued in non-decreasing order of hop depth d(u) and appended to the tail of a FIFO queue, all vertices at depth k are expanded before any vertex at depth k+1 is dequeued.',
    highlightType: 'EXPLORED_FRONTIER',
    highlightLabel: 'Highlight BFS Hop Layers in 3D Scene',
  },

  EUCLIDEAN: {
    id: 'EUCLIDEAN',
    code: 'D',
    title: 'Euclidean Distance (2D & 3D)',
    category: 'Spatial Geometry',
    relevantAlgorithms: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    primaryFormula: 'd(p,q) = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2 + (z_2 - z_1)^2}',
    secondaryFormulas: [
      {
        label: 'Planar 2D Projection',
        latex: 'd_{\\text{2D}}(p,q) = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
      },
      {
        label: 'Piecewise Path Arc Length',
        latex: 'L(\\mathcal{P}) = \\sum_{i=0}^{N-1} \\lVert p_{i+1} - p_i \\rVert_2',
      },
    ],
    simpleExplanation:
      'Euclidean distance measures the straight-line ("as-the-crow-flies") distance between two points in space using the Pythagorean theorem.',
    technicalExplanation:
      'The L2 metric computes geometric arc length along piecewise-linear paths, evaluates obstacle surface clearance, serves as an admissible heuristic h(n) in Euclidean space, and determines nearest-neighbor selection in continuous RRT planning.',
    derivation:
      'Derived from orthogonality of Cartesian basis vectors in R^2 and R^3: ||p - q||_2 = sqrt(<p - q, p - q>). By the triangle inequality, straight-line Euclidean distance is a lower bound on any collision-free trajectory between p and q.',
    highlightType: 'STRAIGHT_LINE',
    highlightLabel: 'Highlight Euclidean Goal Vector in 3D Scene',
  },

  ROBOT_POSE: {
    id: 'ROBOT_POSE',
    code: 'E',
    title: 'Robot Pose & Configuration Space',
    category: 'Kinematics & Pose',
    relevantAlgorithms: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    primaryFormula: 'q = (x, y, \\theta) \\in SE(2) \\cong \\mathbb{R}^2 \\times S^1',
    secondaryFormulas: [
      {
        label: '3D Rigid-Body Pose in SE(3)',
        latex: 'T = \\begin{bmatrix} R & \\mathbf{p} \\\\ \\mathbf{0}^\\top & 1 \\end{bmatrix} \\in SE(3), \\quad R \\in SO(3) \\text{ or } \\mathbf{q} \\in S^3',
      },
    ],
    simpleExplanation:
      'For a mobile robot driving on a flat floor, its pose is defined by its position (x, y) and the direction it is facing (angle theta). In full 3D space, orientation requires a rotation matrix or quaternion.',
    technicalExplanation:
      'A planar mobile robot configuration lies in the Special Euclidean group SE(2), parameterized by two translational coordinates and heading angle theta. Important: three scalar values do NOT globally and uniquely describe an arbitrary 3D rigid-body pose in SE(3) without singularities (gimbal lock); full 3D orientation requires a 3x3 orthogonal rotation matrix R in SO(3) or a unit quaternion q in S^3.',
    derivation:
      'A planar rigid transformation maps body-frame coordinates p_b to world-frame coordinates p_w = R(theta) p_b + [x, y]^T. In 3D, SO(3) has 3 degrees of freedom but cannot be smoothly covered by a single 3-parameter chart without singular points.',
    highlightType: 'ROBOT_POSE',
    highlightLabel: 'Highlight Robot Pose Frame in 3D Scene',
  },

  DIFF_DRIVE: {
    id: 'DIFF_DRIVE',
    code: 'F',
    title: 'Differential-Drive Kinematics',
    category: 'Kinematics & Pose',
    relevantAlgorithms: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    primaryFormula:
      'v = \\frac{r(\\omega_R + \\omega_L)}{2}, \\qquad \\omega = \\frac{r(\\omega_R - \\omega_L)}{L}',
    secondaryFormulas: [
      {
        label: 'Planar Unicycle Pose Dynamics (Idealized)',
        latex: '\\dot{x} = v\\cos(\\theta), \\quad \\dot{y} = v\\sin(\\theta), \\quad \\dot{\\theta} = \\omega',
      },
      {
        label: 'Non-Holonomic Zero-Lateral-Slip Constraint',
        latex: '-\\dot{x}\\sin(\\theta) + \\dot{y}\\cos(\\theta) = 0',
      },
    ],
    simpleExplanation:
      'A differential-drive robot steers by spinning its left and right wheels at different speeds. Spinning both wheels equally drives straight (linear velocity v); spinning them in opposite directions turns the robot in place (angular velocity omega).',
    technicalExplanation:
      'For wheel radius r, wheel separation L, and wheel angular speeds omega_R, omega_L, forward speed v is the average of the two wheel rim velocities and yaw rate omega is their difference divided by track width L. Note: these are idealized kinematic equations assuming pure rolling without slip; they do not model actuator torque limits, tire slip, or full rigid-body inertia.',
    derivation:
      'Left and right wheel ground contact speeds are v_L = r * omega_L and v_R = r * omega_R. By rigid-body velocity kinematics of the axle midpoint, v = (v_R + v_L)/2 and omega = (v_R - v_L)/L.',
    highlightType: 'ROBOT_POSE',
    highlightLabel: 'Highlight Robot Chassis & Heading in 3D Scene',
  },

  COLLISION_CHECKING: {
    id: 'COLLISION_CHECKING',
    code: 'G',
    title: 'Collision Checking & C-Space Inflation',
    category: 'Safety & Validation',
    relevantAlgorithms: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    primaryFormula:
      '\\mathcal{C}_{\\text{obs}} = \\bigl\\{ q \\in \\mathcal{C} \\;\\big|\\; \\mathcal{A}(q) \\cap \\mathcal{O} \\neq \\emptyset \\bigr\\}',
    secondaryFormulas: [
      {
        label: 'Circular Footprint Clearance Criterion',
        latex: 'd_{\\text{signed}}(\\mathbf{p}(s), \\mathcal{O}_i) \\ge R_{\\text{robot}} + \\epsilon_{\\text{margin}}',
      },
    ],
    simpleExplanation:
      'A real robot is not a tiny dot—it has physical width. To prevent the robot edges from clipping obstacles, the planner expands every obstacle outward by the robot radius plus a safety buffer.',
    technicalExplanation:
      'Collision checking verifies that the robot occupied volume A(q) does not intersect any obstacle O. For a disc-approximated robot of radius R_robot, expanding obstacles by R_robot + epsilon (Minkowski sum O (+) B_R) transforms finite-footprint validation into point checks in C_free. A route valid for a point robot is NOT guaranteed to be collision-free for a finite-sized robot.',
    derivation:
      'For a circular footprint B(p, R) centered at p, B(p, R) intersects obstacle O if and only if inf_{x in O} ||p - x||_2 <= R. Continuous path validation checks this inequality along finely sampled points on every path segment.',
    highlightType: 'CSPACE_CLEARANCE',
    highlightLabel: 'Highlight C-Space Inflation & Clearance in 3D Scene',
  },

  RRT: {
    id: 'RRT',
    code: 'H',
    title: 'Rapidly-Exploring Random Tree (RRT)',
    category: 'Sampling-Based Planning',
    relevantAlgorithms: ['RRT'],
    primaryFormula:
      'q_{\\text{near}} = \\arg\\min_{q \\in T} d(q, q_{\\text{rand}}), \\quad q_{\\text{new}} = q_{\\text{near}} + \\Delta q \\frac{q_{\\text{rand}} - q_{\\text{near}}}{\\lVert q_{\\text{rand}} - q_{\\text{near}} \\rVert_2}',
    secondaryFormulas: [
      {
        label: 'Probabilistic Completeness (Non-Optimal)',
        latex: '\\lim_{K \\to \\infty} \\mathbb{P}(\\text{path found}) = 1, \\quad L(T) \\ge L^*',
      },
    ],
    simpleExplanation:
      'Instead of using a fixed grid, RRT grows a tree through continuous space by picking random points and taking a small collision-checked step toward each point from the closest existing tree branch.',
    technicalExplanation:
      'RRT biases exploration toward large unvisited Voronoi regions of C_free by sampling q_rand uniformly (with small goal bias p_goal), finding nearest tree vertex q_near, and steering by step size delta_q. Basic RRT is probabilistically complete but does NOT guarantee a globally shortest path.',
    derivation:
      'The probability that a random sample falls in the Voronoi region of a tree vertex is proportional to that region’s volume, naturally pulling the tree outward into unexplored continuous space without requiring grid discretization.',
    highlightType: 'RRT_TREE',
    highlightLabel: 'Highlight RRT Sample & Tree Branch in 3D Scene',
  },

  TRAJECTORY: {
    id: 'TRAJECTORY',
    code: 'I',
    title: 'Geometric Path vs. Trajectory Planning',
    category: 'Kinematics & Pose',
    relevantAlgorithms: ['BFS', 'DIJKSTRA', 'ASTAR', 'RRT'],
    primaryFormula:
      '\\text{Path: } \\mathbf{p}(s),\\; s \\in [0, 1] \\quad \\longrightarrow \\quad \\text{Trajectory: } \\mathbf{q}(t) = \\mathbf{p}\\bigl(s(t)\\bigr)',
    secondaryFormulas: [
      {
        label: 'Velocity & Acceleration Chain Rule',
        latex: '\\dot{\\mathbf{q}}(t) = \\frac{d\\mathbf{p}}{ds}\\dot{s}(t), \\qquad \\ddot{\\mathbf{q}}(t) = \\frac{d^2\\mathbf{p}}{ds^2}\\dot{s}^2 + \\frac{d\\mathbf{p}}{ds}\\ddot{s}(t)',
      },
    ],
    simpleExplanation:
      'A path is just the line on the floor showing where to go. A trajectory adds time—specifying how fast the robot moves and turns at every second along that line.',
    technicalExplanation:
      'Graph and sampling planners compute a geometric path p(s) parameterized by arc length. Executing motion on a robot requires a time-parameterized schedule s(t) that respects kinematic velocity bounds (v_max, omega_max) and heading alignment transitions.',
    derivation:
      'Given waypoints {p_0, ..., p_N}, piecewise kinematic scheduling assigns rotation intervals delta_t_rot = |delta_theta| / omega_max and translation intervals delta_t_trans = ||p_{i+1} - p_i||_2 / v_max.',
    highlightType: 'PLANNED_PATH',
    highlightLabel: 'Highlight Validated Trajectory Waypoints in 3D Scene',
  },
};

export function getRelevantMathConcepts(algorithm = 'ASTAR', robotModel = 'differential') {
  const algo = String(algorithm || 'ASTAR').toUpperCase();
  const orderedKeys = [];

  if (algo === 'ASTAR') orderedKeys.push('ASTAR');
  else if (algo === 'DIJKSTRA') orderedKeys.push('DIJKSTRA');
  else if (algo === 'BFS') orderedKeys.push('BFS');
  else if (algo === 'RRT') orderedKeys.push('RRT');

  orderedKeys.push('EUCLIDEAN', 'COLLISION_CHECKING', 'ROBOT_POSE');
  if (robotModel === 'differential') {
    orderedKeys.push('DIFF_DRIVE');
  } else {
    orderedKeys.push('DIFF_DRIVE'); // Still useful for comparison
  }
  orderedKeys.push('TRAJECTORY');

  // Append remaining planners for reference
  ['ASTAR', 'DIJKSTRA', 'BFS', 'RRT'].forEach((k) => {
    if (!orderedKeys.includes(k)) orderedKeys.push(k);
  });

  return orderedKeys.map((k) => MATH_CONCEPTS[k]).filter(Boolean);
}
