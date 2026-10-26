import express from 'express';
import crypto from 'crypto';
import { dbRepo } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

export function formatRunsToCsv(runs = []) {
  const header =
    'runId,scenarioId,planner,heuristic,movementMode,pathFound,resultStatus,pathLength,nodesExpanded,planningTimeMs,timestamp';
  const rows = runs.map((r) => {
    const fields = [
      r.runId || r.id || '',
      r.scenarioId || 'custom',
      r.planner || 'ASTAR',
      r.heuristic || 'none',
      r.movementMode || 'eight',
      Boolean(r.pathFound),
      r.resultStatus || (r.pathFound ? 'PATH_FOUND' : 'NO_PATH'),
      Number(r.pathLength ?? 0).toFixed(4),
      Number(r.nodesExpanded ?? 0),
      Number(r.planningTimeMs ?? 0).toFixed(3),
      r.timestamp || r.createdAt || new Date().toISOString(),
    ];
    return fields
      .map((val) => {
        const str = String(val);
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(',');
  });
  return [header, ...rows].join('\n');
}

router.get('/', async (req, res) => {
  try {
    const results = await dbRepo.listResultsByOwner(req.user.id);
    return res.status(200).json({
      ok: true,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to fetch simulation results.',
    });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const results = await dbRepo.listResultsByOwner(req.user.id);
    const csv = formatRunsToCsv(results);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="robopath-3d-results.csv"'
    );
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to export CSV.',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.runs) ? body.runs : [body];

    const createdList = [];
    for (const item of items) {
      const planner = String(item.planner || 'ASTAR').toUpperCase();
      const pathFound = Boolean(item.pathFound);
      const resultStatus =
        item.resultStatus || (pathFound ? 'PATH_FOUND' : 'NO_PATH');

      const record = await dbRepo.createResult({
        ownerId: String(req.user.id),
        runId:
          item.runId ||
          `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        scenarioId: String(item.scenarioId || 'custom'),
        scenarioName: String(item.scenarioName || 'Custom Environment'),
        planner,
        plannerFamily:
          planner === 'RRT' || planner === 'RRT_STAR' ? 'sampling' : 'graph',
        heuristic: String(item.heuristic || 'none'),
        movementMode: String(item.movementMode || 'eight'),
        pathFound,
        resultStatus,
        pathLength: Number(item.pathLength ?? 0),
        pathCost: Number(item.pathCost ?? item.pathLength ?? 0),
        nodesExpanded: Number(item.nodesExpanded ?? 0),
        nodesGenerated: Number(item.nodesGenerated ?? item.nodesExpanded ?? 0),
        planningTimeMs: Number(item.planningTimeMs ?? 0),
        gridDimensions: item.gridDimensions || {
          rows: 20,
          cols: 20,
          cellSize: 1,
        },
        simulatorMode: item.simulatorMode || '3D',
        timestamp: item.timestamp || new Date().toISOString(),
      });
      createdList.push(record);
    }

    return res.status(201).json({
      ok: true,
      result: createdList[0],
      results: createdList,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to record simulation result.',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const outcome = await dbRepo.deleteResult(req.params.id, req.user.id);
    if (outcome.status === 404) {
      return res.status(404).json({
        ok: false,
        error: 'Simulation result not found.',
      });
    }
    if (outcome.status === 403) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: You cannot delete another user’s simulation record.',
      });
    }
    return res.status(200).json({
      ok: true,
      deletedId: req.params.id,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to delete simulation result.',
    });
  }
});

export default router;
