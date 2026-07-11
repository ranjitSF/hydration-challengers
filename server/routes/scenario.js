import express from 'express';
import { db } from '../database/firestore.js';
import { getAppConfig, isLocked } from '../lib/config.js';
import { ALL_SLOTS } from '../lib/bracket.js';
import { computeEliminated, projectPlayer } from '../lib/projection.js';

const router = express.Router();

// Post-lock only: everything the "what-if" simulator needs to recompute standings
// entirely client-side — current results, each player's base total, and their picks
// for the still-undecided slots. Picks are public post-lock (same as the bracket view).
router.get('/', async (req, res) => {
  try {
    if (!(await isLocked())) return res.status(403).json({ error: 'Available once picks lock' });

    const [playersSnap, picksSnap, resultsSnap, config] = await Promise.all([
      db().collection('players').get(),
      db().collection('picks').get(),
      db().collection('results').get(),
      getAppConfig(),
    ]);
    const realR32 = config.realR32 || {};
    const realResults = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));
    const picksByEmail = Object.fromEntries(picksSnap.docs.map((d) => [d.id, d.data()]));
    const eliminated = computeEliminated(realResults, realR32);
    const undecidedSlots = ALL_SLOTS.filter((s) => !realResults[s]);

    const players = playersSnap.docs.map((doc) => {
      const p = doc.data();
      const pk = picksByEmail[doc.id] || {};
      const submitted = pk.submitted === true;
      const picksBySlot = submitted ? pk.picksBySlot || {} : {};
      const base = projectPlayer(
        { r32Picks: p.r32Picks || {}, starting_points: p.starting_points || 0, picksBySlot },
        realResults, realR32, eliminated
      ).currentTotal;
      const picks = {};
      for (const s of undecidedSlots) if (picksBySlot[s]) picks[s] = picksBySlot[s];
      return { playerId: doc.id, name: p.display_name, base, picks, submitted };
    });

    res.json({ decided: realResults, realR32, undecidedSlots, players });
  } catch (error) {
    console.error('Error building scenario data:', error);
    res.status(500).json({ error: 'Failed to load scenario data' });
  }
});

export default router;
