import express from 'express';
import { getLockAt } from '../lib/config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const lockAt = await getLockAt();
    res.json({ lockAt: lockAt ? lockAt.toISOString() : null });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;
