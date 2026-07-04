import express from 'express';
import { pollOnce } from '../jobs/scorePoller.js';

const router = express.Router();

// Hit by Vercel Cron (see vercel.json) and usable for a manual local trigger.
// Guarded by CRON_SECRET so it can't be spammed by randoms.
router.post('/poll-scores', async (req, res) => {
  try {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await pollOnce();
    res.json(result);
  } catch (error) {
    console.error('Cron poll error:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

export default router;
