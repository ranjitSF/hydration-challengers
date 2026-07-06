import express from 'express';
import { getAppConfig } from '../lib/config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const config = await getAppConfig();
    res.json({
      lockAt: config.lockAt ?? null,
      // Whether the Colombia/Ghana (M87) result is in — gates final submission.
      m87Resolved: !!(config.realR32 && config.realR32.M87),
      // Heartbeat of the last score poll (for the subtle "synced X ago" line).
      lastPollAt: config.lastPollAt ?? null,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;
