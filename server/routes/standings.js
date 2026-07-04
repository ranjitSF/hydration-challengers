import express from 'express';
import { db } from '../database/firestore.js';
import { scorePlayerPicks, r32CarryIn } from '../lib/scoring.js';
import { compareStandings } from '../lib/standings.js';
import { getAppConfig } from '../lib/config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [playersSnap, resultsSnap, picksSnap, config] = await Promise.all([
      db().collection('players').get(),
      db().collection('results').get(),
      db().collection('picks').get(),
      getAppConfig(),
    ]);

    const realR32 = config.realR32 || {};
    const resultsBySlot = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));
    const picksByEmail = Object.fromEntries(picksSnap.docs.map((d) => [d.id, d.data().picksBySlot || {}]));

    const standings = playersSnap.docs.map((doc) => {
      const player = doc.data();
      const picksBySlot = picksByEmail[doc.id] || {};
      const { total, accuracyByRound } = scorePlayerPicks(picksBySlot, resultsBySlot);
      const r32Points = r32CarryIn(player.r32Picks || {}, realR32); // live from data
      const adjustment = player.starting_points || 0; // optional manual tweak
      return {
        playerId: doc.id,
        displayName: player.display_name,
        r32Points,
        adjustment,
        pickPoints: total,
        totalPoints: r32Points + adjustment + total,
        accuracyByRound,
        hasSubmitted: Object.keys(picksBySlot).length > 0,
      };
    });

    standings.sort(compareStandings);
    res.json(standings);
  } catch (error) {
    console.error('Error computing standings:', error);
    res.status(500).json({ error: 'Failed to compute standings' });
  }
});

export default router;
