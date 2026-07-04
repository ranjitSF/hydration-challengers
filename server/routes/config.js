import express from 'express';
import { getAppConfig } from '../lib/config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const config = await getAppConfig();
    res.json({ lockAt: config.lockAt ?? null });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;
