import mongoose from 'mongoose';

const simulationResultSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    runId: {
      type: String,
      required: true,
      index: true,
    },
    scenarioId: {
      type: String,
      default: 'custom',
    },
    scenarioName: {
      type: String,
      default: 'Custom Environment',
    },
    planner: {
      type: String,
      required: true,
      enum: ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'],
    },
    plannerFamily: {
      type: String,
      enum: ['graph', 'sampling'],
      default: 'graph',
    },
    heuristic: {
      type: String,
      default: 'none',
    },
    movementMode: {
      type: String,
      default: 'eight',
    },
    pathFound: {
      type: Boolean,
      required: true,
    },
    resultStatus: {
      type: String,
      required: true,
      enum: ['PATH_FOUND', 'NO_PATH', 'SEARCH_LIMIT_REACHED', 'CANCELLED', 'ERROR'],
    },
    pathLength: {
      type: Number,
      default: 0,
    },
    pathCost: {
      type: Number,
      default: 0,
    },
    nodesExpanded: {
      type: Number,
      default: 0,
    },
    nodesGenerated: {
      type: Number,
      default: 0,
    },
    planningTimeMs: {
      type: Number,
      default: 0,
    },
    gridDimensions: {
      rows: { type: Number, default: 20 },
      cols: { type: Number, default: 20 },
      cellSize: { type: Number, default: 1 },
    },
    simulatorMode: {
      type: String,
      enum: ['3D', '2D', 'COMPARISON'],
      default: '3D',
    },
    timestamp: {
      type: String,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: true,
  }
);

export const SimulationResult =
  mongoose.models.SimulationResult ||
  mongoose.model('SimulationResult', simulationResultSchema);
