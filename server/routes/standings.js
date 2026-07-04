import express from 'express';
import { db } from '../database/firestore.js';
import { scorePlayerPicks, r32Accuracy } from '../lib/scoring.js';
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
    const finalTotalGoals = Number.isInteger(config.finalTotalGoals) ? config.finalTotalGoals : null;
    const resultsBySlot = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));
    const picksByEmail = Object.fromEntries(picksSnap.docs.map((d) => [d.id, d.data()]));

    const standings = playersSnap.docs.map((doc) => {
      const player = doc.data();
      const picksDoc = picksByEmail[doc.id] || {};
      const submitted = picksDoc.submitted === true;
      // Only a submitted bracket scores; an auto-saved draft counts for nothing.
      const picksBySlot = submitted ? picksDoc.picksBySlot || {} : {};
      const { total, accuracyByRound } = scorePlayerPicks(picksBySlot, resultsBySlot);
      // R32 carry-in, live from data — applies to everyone regardless of R16 submission.
      const r32 = r32Accuracy(player.r32Picks || {}, realR32);
      const r32Points = r32.points;
      const adjustment = player.starting_points || 0; // optional manual tweak
      const prediction = submitted && Number.isInteger(picksDoc.finalGoals) ? picksDoc.finalGoals : null;
      const goalsDiff =
        finalTotalGoals !== null && prediction !== null ? Math.abs(prediction - finalTotalGoals) : null;
      return {
        playerId: doc.id,
        displayName: player.display_name,
        r32Points,
        r32Correct: r32.correct,
        r32Total: r32.total,
        adjustment,
        pickPoints: total,
        totalPoints: r32Points + adjustment + total,
        accuracyByRound,
        finalGoalsPrediction: prediction,
        goalsDiff,
        hasSubmitted: submitted,
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
