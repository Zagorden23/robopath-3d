import mongoose from 'mongoose';

const obstacleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: 'Obstacle' },
    shape: { type: String, enum: ['box', 'cylinder'], default: 'box' },
    x: { type: Number, required: true },
    z: { type: Number, required: true },
    width: { type: Number, default: 1.5 },
    depth: { type: Number, default: 1.5 },
    radius: { type: Number },
    height: { type: Number, default: 1.8 },
    color: { type: String, default: '#38bdf8' },
  },
  { _id: false }
);

const terrainZoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: 'Weighted Terrain' },
    x: { type: Number, required: true },
    z: { type: Number, required: true },
    width: { type: Number, default: 4 },
    depth: { type: Number, default: 4 },
    costMultiplier: { type: Number, default: 2.5 },
    color: { type: String, default: '#f59e0b' },
  },
  { _id: false }
);

const scenarioSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: [true, 'Scenario ownerId is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Scenario name is required'],
      trim: true,
      minlength: [1, 'Scenario name cannot be empty'],
      maxlength: [100, 'Scenario name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    environment: {
      width: { type: Number, default: 20, min: 4, max: 60 },
      depth: { type: Number, default: 20, min: 4, max: 60 },
      resolution: { type: Number, default: 0.5, min: 0.2, max: 2.0 },
      seed: { type: String, default: 'CUSTOM_2026' },
      start: {
        x: { type: Number, required: true },
        z: { type: Number, required: true },
        theta: { type: Number, default: 0 },
      },
      goal: {
        x: { type: Number, required: true },
        z: { type: Number, required: true },
        theta: { type: Number, default: 0 },
      },
      obstacles: { type: [obstacleSchema], default: [] },
      terrainZones: { type: [terrainZoneSchema], default: [] },
    },
    gridState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sceneSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    robotConfig: {
      model: {
        type: String,
        enum: ['differential', 'holonomic', 'point', 'wheeled', 'autonomous'],
        default: 'differential',
      },
      footprintRadius: { type: Number, default: 0.45 },
      clearanceMargin: { type: Number, default: 0.08 },
      maxLinearSpeed: { type: Number, default: 2.2 },
      maxAngularSpeed: { type: Number, default: 2.8 },
    },
    algorithmConfig: {
      algorithm: {
        type: String,
        enum: ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'],
        default: 'ASTAR',
      },
      allowDiagonal: { type: Boolean, default: true },
      movementMode: { type: String, default: 'eight' },
      heuristic: {
        type: String,
        lowercase: true,
        enum: ['manhattan', 'euclidean', 'octile', 'auto', 'none'],
        default: 'octile',
      },
      heuristicWeight: { type: Number, default: 1.0 },
      rrtStepSize: { type: Number, default: 1.15 },
      rrtMaxIterations: { type: Number, default: 900 },
      rrtGoalBias: { type: Number, default: 0.16 },
    },
    lastMetrics: {
      pathLength: { type: Number, default: 0 },
      traversalCost: { type: Number, default: 0 },
      nodesExpanded: { type: Number, default: 0 },
      planningTimeMs: { type: Number, default: 0 },
      minClearance: { type: Number, default: 0 },
      resultStatus: { type: String, default: 'PATH_FOUND' },
    },
  },
  {
    timestamps: true,
  }
);

export const Scenario =
  mongoose.models.Scenario || mongoose.model('Scenario', scenarioSchema);
