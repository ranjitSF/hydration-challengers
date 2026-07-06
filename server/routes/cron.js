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
    // Return 200 (not 500) on a transient failure. External cron schedulers
    // (cron-job.org) auto-disable a job after repeated HTTP errors — but this poll
    // is idempotent and retries every couple of minutes, so a blip should never
    // take the whole schedule down. The error is still logged for debugging.
    console.error('Cron poll error:', error);
    res.status(200).json({ ok: false, error: String(error?.message || error) });
  }
});

export default router;
