import express from 'express';
import { db } from '../database/firestore.js';
import { scorePlayerPicks } from '../lib/scoring.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [playersSnap, resultsSnap, picksSnap] = await Promise.all([
      db().collection('players').get(),
      db().collection('results').get(),
      db().collection('picks').get(),
    ]);

    const resultsBySlot = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));
    const picksByEmail = Object.fromEntries(picksSnap.docs.map((d) => [d.id, d.data().picksBySlot || {}]));

    const standings = playersSnap.docs.map((doc) => {
      const player = doc.data();
      const picksBySlot = picksByEmail[doc.id] || {};
      const { total, accuracyByRound } = scorePlayerPicks(picksBySlot, resultsBySlot);
      const startingPoints = player.starting_points || 0;
      return {
        playerId: doc.id,
        displayName: player.display_name,
        startingPoints,
        pickPoints: total,
        totalPoints: startingPoints + total,
        accuracyByRound,
        hasSubmitted: Object.keys(picksBySlot).length > 0,
      };
    });

    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    res.json(standings);
  } catch (error) {
    console.error('Error computing standings:', error);
    res.status(500).json({ error: 'Failed to compute standings' });
  }
});

export default router;
