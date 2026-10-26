import express from 'express';
import { dbRepo } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/preferences', async (req, res) => {
  return res.status(200).json({
    ok: true,
    preferences: req.user.preferences || {},
  });
});

router.put('/preferences', async (req, res) => {
  try {
    const incoming = req.body?.preferences || req.body || {};
    const mergedPreferences = {
      ...(req.user.preferences || {}),
      ...incoming,
    };

    const updated = await dbRepo.updateUser(req.user.id, {
      preferences: mergedPreferences,
    });

    return res.status(200).json({
      ok: true,
      preferences: updated.preferences,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to update user preferences.',
    });
  }
});

export default router;
