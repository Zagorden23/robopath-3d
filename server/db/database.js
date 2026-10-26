import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { Scenario } from '../models/Scenario.js';
import { SimulationResult } from '../models/SimulationResult.js';
import { OtpRecord } from '../models/OtpRecord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../.data');
const DEFAULT_STORE_PATH = path.join(DATA_DIR, 'robopath-store.json');

export function getStorePath() {
  return process.env.ROBOPATH_STORE_PATH || DEFAULT_STORE_PATH;
}

let isMongoConnected = false;

const EMPTY_STORE = {
  users: [],
  scenarios: [],
  simulations: [],
  otps: [],
  passwordResets: [],
};

function ensureLocalStore() {
  const storePath = getStorePath();
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

function readLocalStore() {
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
      simulations: Array.isArray(parsed.simulations) ? parsed.simulations : [],
      otps: Array.isArray(parsed.otps) ? parsed.otps : [],
      passwordResets: Array.isArray(parsed.passwordResets)
        ? parsed.passwordResets
        : [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function writeLocalStore(data) {
  ensureLocalStore();
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf8');
}

export async function connectDatabase(customUri) {
  const uri =
    customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/robopath';

  if (process.env.FORCE_LOCAL_STORE === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FORCE_LOCAL_STORE cannot be enabled in production. Configure MongoDB instead.');
    }
    isMongoConnected = false;
    ensureLocalStore();
    return { mode: 'mongoose-validated-local-store' };
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
    isMongoConnected = true;
    console.log('[RoboPath DB] Connected to MongoDB via Mongoose.');
    return { mode: 'mongodb' };
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `MongoDB connection failed in production: ${err.code || err.message}`
      );
    }
    isMongoConnected = false;
    ensureLocalStore();
    console.log(
      `[RoboPath DB] MongoDB daemon not reachable (${err.code || err.message}) — active mode: Mongoose Schema Validation + Persistent Store.`
    );
    return { mode: 'mongoose-validated-local-store' };
  }
}

export function clearLocalStoreForTests() {
  writeLocalStore({
    users: [],
    scenarios: [],
    simulations: [],
    otps: [],
    passwordResets: [],
  });
}

export function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  const connected = Boolean(isMongoConnected && readyState === 1);
  return {
    connected,
    mode: connected ? 'mongodb' : 'mongoose-validated-local-store',
    readyState,
  };
}

function formatUserDoc(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id || obj.id),
    name: obj.name,
    email: obj.email,
    phone: obj.phone || null,
    emailVerified: Boolean(obj.emailVerified),
    phoneVerified: Boolean(obj.phoneVerified),
    passwordHash: obj.passwordHash,
    tokenVersion: obj.tokenVersion ?? 1,
    preferences: obj.preferences || {},
    exploredConcepts: obj.exploredConcepts || ['ASTAR', 'EUCLIDEAN', 'DIFF_DRIVE'],
    completedDemos: obj.completedDemos || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function formatScenarioDoc(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id || obj.id),
    ownerId: String(obj.ownerId),
    name: obj.name,
    description: obj.description || '',
    environment: obj.environment,
    gridState: obj.gridState || null,
    sceneSettings: obj.sceneSettings || null,
    robotConfig: obj.robotConfig,
    algorithmConfig: obj.algorithmConfig,
    lastMetrics: obj.lastMetrics || {},
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function formatSimulationDoc(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id || obj.id),
    ownerId: String(obj.ownerId),
    runId: obj.runId,
    scenarioId: obj.scenarioId || 'custom',
    scenarioName: obj.scenarioName || 'Custom Environment',
    planner: obj.planner,
    plannerFamily: obj.plannerFamily || 'graph',
    heuristic: obj.heuristic || 'none',
    movementMode: obj.movementMode || 'eight',
    pathFound: Boolean(obj.pathFound),
    resultStatus: obj.resultStatus,
    pathLength: Number(obj.pathLength ?? 0),
    pathCost: Number(obj.pathCost ?? 0),
    nodesExpanded: Number(obj.nodesExpanded ?? 0),
    nodesGenerated: Number(obj.nodesGenerated ?? 0),
    planningTimeMs: Number(obj.planningTimeMs ?? 0),
    gridDimensions: obj.gridDimensions || { rows: 20, cols: 20, cellSize: 1 },
    simulatorMode: obj.simulatorMode || '3D',
    timestamp: obj.timestamp || obj.createdAt || new Date().toISOString(),
    createdAt: obj.createdAt,
  };
}

export const dbRepo = {
  async findUserByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email: normalized });
      return formatUserDoc(user);
    }
    const store = readLocalStore();
    const found = store.users.find((u) => u.email === normalized);
    return formatUserDoc(found);
  },

  async findUserByPhone(phone) {
    const normalized = String(phone || '').trim();
    if (!normalized) return null;
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const user = await User.findOne({ phone: normalized });
      return formatUserDoc(user);
    }
    const store = readLocalStore();
    const found = store.users.find((u) => u.phone === normalized);
    return formatUserDoc(found);
  },

  async findUserById(id) {
    const strId = String(id || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(strId)) return null;
      const user = await User.findById(strId);
      return formatUserDoc(user);
    }
    const store = readLocalStore();
    const found = store.users.find((u) => String(u._id || u.id) === strId);
    return formatUserDoc(found);
  },

  async createUser({
    name,
    email,
    passwordHash,
    phone = null,
    emailVerified = false,
    phoneVerified = false,
  }) {
    const mongooseInstance = new User({
      name: String(name || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      emailVerified: Boolean(emailVerified),
      phoneVerified: Boolean(phoneVerified),
      passwordHash,
      tokenVersion: 1,
    });
    const validationErr = mongooseInstance.validateSync();
    if (validationErr) {
      const firstMsg =
        Object.values(validationErr.errors)[0]?.message || 'Invalid user data';
      const err = new Error(firstMsg);
      err.status = 400;
      throw err;
    }

    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const saved = await mongooseInstance.save();
      return formatUserDoc(saved);
    }

    const store = readLocalStore();
    if (store.users.some((u) => u.email === mongooseInstance.email)) {
      const err = new Error('An account with this email already exists.');
      err.status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const rawObj = mongooseInstance.toObject();
    const record = {
      ...rawObj,
      _id: String(rawObj._id),
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(record);
    writeLocalStore(store);
    return formatUserDoc(record);
  },

  async updateUser(id, updates) {
    const strId = String(id || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const updated = await User.findByIdAndUpdate(
        strId,
        { $set: updates },
        { new: true, runValidators: true }
      );
      return formatUserDoc(updated);
    }

    const store = readLocalStore();
    const idx = store.users.findIndex((u) => String(u._id || u.id) === strId);
    if (idx === -1) return null;

    const current = store.users[idx];
    const merged = {
      ...current,
      ...updates,
      preferences: updates.preferences
        ? { ...(current.preferences || {}), ...updates.preferences }
        : current.preferences,
      updatedAt: new Date().toISOString(),
    };

    const tempDoc = new User(merged);
    const valErr = tempDoc.validateSync();
    if (valErr) {
      const firstMsg =
        Object.values(valErr.errors)[0]?.message || 'Validation failed';
      const err = new Error(firstMsg);
      err.status = 400;
      throw err;
    }

    store.users[idx] = merged;
    writeLocalStore(store);
    return formatUserDoc(merged);
  },

  // OTP Management (Email & Phone — stored hashed with expiration & retry limits)
  async upsertOtpRecord({
    identifier,
    channel,
    otpHash = null,
    provider = 'local',
    expiresAt,
    cooldownUntil,
  }) {
    const key = `${channel}:${String(identifier).toLowerCase()}`;
    const normalizedIdentifier = String(identifier).toLowerCase();
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      return OtpRecord.findOneAndUpdate(
        { identifier: normalizedIdentifier, channel },
        {
          $set: {
            otpHash,
            provider,
            attempts: 0,
            maxAttempts: 5,
            expiresAt,
            cooldownUntil,
          },
          $setOnInsert: { identifier: normalizedIdentifier, channel },
        },
        { new: true, upsert: true, runValidators: true }
      ).lean();
    }
    const store = readLocalStore();
    const existingIdx = store.otps.findIndex((o) => o.key === key);
    const record = {
      key,
      identifier: normalizedIdentifier,
      channel,
      otpHash,
      provider,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      cooldownUntil,
      createdAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      store.otps[existingIdx] = record;
    } else {
      store.otps.push(record);
    }
    writeLocalStore(store);
    return record;
  },

  async findOtpRecord(identifier, channel) {
    const key = `${channel}:${String(identifier).toLowerCase()}`;
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      return OtpRecord.findOne({
        identifier: String(identifier).toLowerCase(),
        channel,
      }).lean();
    }
    const store = readLocalStore();
    return store.otps.find((o) => o.key === key) || null;
  },

  async incrementOtpAttempts(identifier, channel) {
    const key = `${channel}:${String(identifier).toLowerCase()}`;
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      return OtpRecord.findOneAndUpdate(
        { identifier: String(identifier).toLowerCase(), channel },
        { $inc: { attempts: 1 } },
        { new: true }
      ).lean();
    }
    const store = readLocalStore();
    const idx = store.otps.findIndex((o) => o.key === key);
    if (idx === -1) return null;
    store.otps[idx].attempts = (store.otps[idx].attempts || 0) + 1;
    writeLocalStore(store);
    return store.otps[idx];
  },

  async deleteOtpRecord(identifier, channel) {
    const key = `${channel}:${String(identifier).toLowerCase()}`;
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      await OtpRecord.deleteOne({
        identifier: String(identifier).toLowerCase(),
        channel,
      });
      return;
    }
    const store = readLocalStore();
    store.otps = store.otps.filter((o) => o.key !== key);
    writeLocalStore(store);
  },

  // Password Reset Tokens (stored hashed with expiration)
  async upsertPasswordReset({ email, tokenHash, expiresAt }) {
    const cleanEmail = String(email).toLowerCase();
    const store = readLocalStore();
    store.passwordResets = store.passwordResets.filter(
      (r) => r.email !== cleanEmail
    );
    const record = {
      email: cleanEmail,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    store.passwordResets.push(record);
    writeLocalStore(store);
    return record;
  },

  async findPasswordReset(email) {
    const cleanEmail = String(email).toLowerCase();
    const store = readLocalStore();
    return store.passwordResets.find((r) => r.email === cleanEmail) || null;
  },

  async deletePasswordReset(email) {
    const cleanEmail = String(email).toLowerCase();
    const store = readLocalStore();
    store.passwordResets = store.passwordResets.filter(
      (r) => r.email !== cleanEmail
    );
    writeLocalStore(store);
  },

  // Scenarios / Saved Environments
  async listScenariosByOwner(ownerId) {
    const strOwner = String(ownerId || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const docs = await Scenario.find({ ownerId: strOwner }).sort({
        updatedAt: -1,
      });
      return docs.map(formatScenarioDoc);
    }

    const store = readLocalStore();
    return store.scenarios
      .filter((s) => String(s.ownerId) === strOwner)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(formatScenarioDoc);
  },

  async findScenarioById(id) {
    const strId = String(id || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(strId)) return null;
      const doc = await Scenario.findById(strId);
      return formatScenarioDoc(doc);
    }

    const store = readLocalStore();
    const found = store.scenarios.find((s) => String(s._id || s.id) === strId);
    return formatScenarioDoc(found);
  },

  async createScenario(payload) {
    const mongooseScenario = new Scenario(payload);
    const valErr = mongooseScenario.validateSync();
    if (valErr) {
      const firstMsg =
        Object.values(valErr.errors)[0]?.message || 'Invalid scenario payload';
      const err = new Error(firstMsg);
      err.status = 400;
      throw err;
    }

    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const saved = await mongooseScenario.save();
      return formatScenarioDoc(saved);
    }

    const store = readLocalStore();
    const now = new Date().toISOString();
    const rawObj = mongooseScenario.toObject();
    const record = {
      ...rawObj,
      _id: String(rawObj._id),
      createdAt: now,
      updatedAt: now,
    };
    store.scenarios.push(record);
    writeLocalStore(store);
    return formatScenarioDoc(record);
  },

  async updateScenario(id, updates) {
    const strId = String(id || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const updated = await Scenario.findByIdAndUpdate(
        strId,
        { $set: updates },
        { new: true, runValidators: true }
      );
      return formatScenarioDoc(updated);
    }

    const store = readLocalStore();
    const idx = store.scenarios.findIndex((s) => String(s._id || s.id) === strId);
    if (idx === -1) return null;

    const merged = {
      ...store.scenarios[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const tempDoc = new Scenario(merged);
    const valErr = tempDoc.validateSync();
    if (valErr) {
      const firstMsg =
        Object.values(valErr.errors)[0]?.message || 'Invalid scenario update';
      const err = new Error(firstMsg);
      err.status = 400;
      throw err;
    }

    store.scenarios[idx] = merged;
    writeLocalStore(store);
    return formatScenarioDoc(merged);
  },

  async deleteScenario(id) {
    const strId = String(id || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      await Scenario.findByIdAndDelete(strId);
      return true;
    }

    const store = readLocalStore();
    const next = store.scenarios.filter((s) => String(s._id || s.id) !== strId);
    const deleted = next.length < store.scenarios.length;
    store.scenarios = next;
    writeLocalStore(store);
    return deleted;
  },

  // Simulation Experiment Run History & Results
  async listResultsByOwner(ownerId) {
    const strOwner = String(ownerId || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const docs = await SimulationResult.find({ ownerId: strOwner }).sort({
        createdAt: -1,
      });
      return docs.map(formatSimulationDoc);
    }

    const store = readLocalStore();
    return store.simulations
      .filter((r) => String(r.ownerId) === strOwner)
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
      .map(formatSimulationDoc);
  },

  async createResult(payload) {
    const instance = new SimulationResult(payload);
    const valErr = instance.validateSync();
    if (valErr) {
      const firstMsg =
        Object.values(valErr.errors)[0]?.message || 'Invalid simulation result';
      const err = new Error(firstMsg);
      err.status = 400;
      throw err;
    }

    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const saved = await instance.save();
      return formatSimulationDoc(saved);
    }

    const store = readLocalStore();
    const now = new Date().toISOString();
    const rawObj = instance.toObject();
    const record = {
      ...rawObj,
      _id: String(rawObj._id),
      timestamp: payload.timestamp || now,
      createdAt: now,
      updatedAt: now,
    };
    store.simulations.push(record);
    writeLocalStore(store);
    return formatSimulationDoc(record);
  },

  async deleteResult(id, ownerId) {
    const strId = String(id || '');
    const strOwner = String(ownerId || '');
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      const doc = await SimulationResult.findById(strId);
      if (!doc) return { status: 404 };
      if (String(doc.ownerId) !== strOwner) return { status: 403 };
      await SimulationResult.findByIdAndDelete(strId);
      return { status: 200 };
    }

    const store = readLocalStore();
    const found = store.simulations.find((r) => String(r._id || r.id) === strId || r.runId === strId);
    if (!found) return { status: 404 };
    if (String(found.ownerId) !== strOwner) return { status: 403 };
    store.simulations = store.simulations.filter(
      (r) => String(r._id || r.id) !== strId && r.runId !== strId
    );
    writeLocalStore(store);
    return { status: 200 };
  },
};
