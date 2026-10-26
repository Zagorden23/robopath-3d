import express from 'express';
import { dbRepo } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All scenario & environment routes require authentication
router.use(requireAuth);

// List current user's saved scenarios / environments
router.get('/', async (req, res) => {
  try {
    const scenarios = await dbRepo.listScenariosByOwner(req.user.id);
    return res.status(200).json({
      ok: true,
      scenarios,
      environments: scenarios,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to fetch saved scenarios.',
    });
  }
});

// Get single scenario (enforcing strict user ownership)
router.get('/:id', async (req, res) => {
  try {
    const scenario = await dbRepo.findScenarioById(req.params.id);
    if (!scenario) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found.',
      });
    }
    if (String(scenario.ownerId) !== String(req.user.id)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: You do not have permission to access this scenario.',
      });
    }
    return res.status(200).json({
      ok: true,
      scenario,
      environment: scenario,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to retrieve scenario.',
    });
  }
});

// Create new saved scenario / environment
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      environment,
      gridState,
      sceneSettings,
      robotConfig,
      algorithmConfig,
      lastMetrics,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({
        ok: false,
        error: 'Scenario name is required.',
      });
    }

    let resolvedEnv = environment;
    if ((!resolvedEnv || !resolvedEnv.start || !resolvedEnv.goal) && gridState?.start && gridState?.goal) {
      const cellSize = Number(gridState.cellSize || 1);
      resolvedEnv = {
        width: Number(gridState.cols || 20) * cellSize,
        depth: Number(gridState.rows || 20) * cellSize,
        resolution: cellSize,
        start: {
          x: Number(gridState.start.col ?? 0) * cellSize,
          z: Number(gridState.start.row ?? 0) * cellSize,
          theta: 0,
        },
        goal: {
          x: Number(gridState.goal.col ?? 10) * cellSize,
          z: Number(gridState.goal.row ?? 10) * cellSize,
          theta: 0,
        },
        obstacles: [],
        terrainZones: [],
      };
    }

    if (!resolvedEnv || !resolvedEnv.start || !resolvedEnv.goal) {
      return res.status(400).json({
        ok: false,
        error: 'Valid environment with start and goal coordinates is required.',
      });
    }

    const created = await dbRepo.createScenario({
      ownerId: String(req.user.id),
      name: cleanName,
      description: String(description || '').trim(),
      environment: resolvedEnv,
      gridState: gridState || null,
      sceneSettings: sceneSettings || null,
      robotConfig: robotConfig || {},
      algorithmConfig: algorithmConfig || {},
      lastMetrics: lastMetrics || {},
    });

    return res.status(201).json({
      ok: true,
      scenario: created,
      environment: created,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to save scenario.',
    });
  }
});

// Duplicate an owned scenario
router.post('/:id/duplicate', async (req, res) => {
  try {
    const existing = await dbRepo.findScenarioById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found.',
      });
    }
    if (String(existing.ownerId) !== String(req.user.id)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: You cannot duplicate another user’s scenario.',
      });
    }

    const customName = req.body?.name
      ? String(req.body.name).trim()
      : `${existing.name} (Copy)`;

    const duplicated = await dbRepo.createScenario({
      ownerId: String(req.user.id),
      name: customName.slice(0, 100),
      description: existing.description,
      environment: existing.environment,
      gridState: existing.gridState,
      sceneSettings: existing.sceneSettings,
      robotConfig: existing.robotConfig,
      algorithmConfig: existing.algorithmConfig,
      lastMetrics: existing.lastMetrics,
    });

    return res.status(201).json({
      ok: true,
      scenario: duplicated,
      environment: duplicated,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to duplicate scenario.',
    });
  }
});

// Update / rename an owned scenario
router.put('/:id', async (req, res) => {
  try {
    const existing = await dbRepo.findScenarioById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found.',
      });
    }
    if (String(existing.ownerId) !== String(req.user.id)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: You cannot modify another user’s scenario.',
      });
    }

    const {
      name,
      description,
      environment,
      gridState,
      sceneSettings,
      robotConfig,
      algorithmConfig,
      lastMetrics,
    } = req.body || {};

    const updates = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          error: 'Scenario name cannot be empty.',
        });
      }
      updates.name = cleanName;
    }
    if (description !== undefined) updates.description = String(description).trim();
    if (environment !== undefined) updates.environment = environment;
    if (gridState !== undefined) updates.gridState = gridState;
    if (sceneSettings !== undefined) updates.sceneSettings = sceneSettings;
    if (robotConfig !== undefined) updates.robotConfig = robotConfig;
    if (algorithmConfig !== undefined) updates.algorithmConfig = algorithmConfig;
    if (lastMetrics !== undefined) updates.lastMetrics = lastMetrics;

    const updated = await dbRepo.updateScenario(existing.id, updates);
    return res.status(200).json({
      ok: true,
      scenario: updated,
      environment: updated,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to update scenario.',
    });
  }
});

// Delete an owned scenario
router.delete('/:id', async (req, res) => {
  try {
    const existing = await dbRepo.findScenarioById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found.',
      });
    }
    if (String(existing.ownerId) !== String(req.user.id)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: You cannot delete another user’s scenario.',
      });
    }

    await dbRepo.deleteScenario(existing.id);
    return res.status(200).json({
      ok: true,
      deletedId: existing.id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to delete scenario.',
    });
  }
});

export default router;
