import mongoose from 'mongoose';

const userPreferencesSchema = new mongoose.Schema(
  {
    defaultAlgorithm: {
      type: String,
      enum: ['BFS', 'DIJKSTRA', 'ASTAR', 'GREEDY', 'RRT', 'RRT_STAR'],
      default: 'ASTAR',
    },
    defaultRobotModel: {
      type: String,
      enum: ['differential', 'holonomic', 'point', 'wheeled', 'autonomous'],
      default: 'differential',
    },
    explanationLayout: {
      type: String,
      enum: ['floating', 'dock-right', 'dock-bottom', 'expanded'],
      default: 'floating',
    },
    renderQuality: {
      type: String,
      enum: ['high', 'balanced', 'performance'],
      default: 'high',
    },
    theme: {
      type: String,
      enum: ['lemon-cream', 'navy-lab', 'blueprint'],
      default: 'lemon-cream',
    },
    reducedMotion: {
      type: Boolean,
      default: false,
    },
    showGridByDefault: {
      type: Boolean,
      default: true,
    },
    showExploredByDefault: {
      type: Boolean,
      default: true,
    },
    showCSpaceByDefault: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    tokenVersion: {
      type: Number,
      default: 1,
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({}),
    },
    exploredConcepts: {
      type: [String],
      default: ['ASTAR', 'EUCLIDEAN', 'DIFF_DRIVE'],
    },
    completedDemos: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
