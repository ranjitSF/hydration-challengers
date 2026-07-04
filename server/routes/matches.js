import express from 'express';
import { db } from '../database/firestore.js';

const router = express.Router();

const ROUND_ORDER = { R16: 1, QF: 2, SF: 3, F: 4 };

// Public: full bracket skeleton + any known results
router.get('/', async (req, res) => {
  try {
    const [matchesSnap, resultsSnap] = await Promise.all([
      db().collection('matches').get(),
      db().collection('results').get(),
    ]);

    const resultsBySlot = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data()]));

    const matches = matchesSnap.docs
      .map((d) => {
        const result = resultsBySlot[d.id];
        return { ...d.data(), winner: result?.winner ?? null, source: result?.source ?? null };
      })
      .sort((a, b) => ROUND_ORDER[a.round] - ROUND_ORDER[b.round] || a.slot.localeCompare(b.slot));

    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;
