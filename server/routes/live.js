import express from 'express';
import { db } from '../database/firestore.js';
import { admin } from '../config/firebase.js';
import { liveGames } from '../jobs/scorePoller.js';
import { POINTS_BY_ROUND } from '../lib/scoring.js';

const router = express.Router();

// Public: currently-live games with scores. If a valid Bearer token is present, each
// game also carries the caller's stake — which team they need and whether it's on track.
router.get('/', async (req, res) => {
  try {
    const games = await liveGames();

    // Optional auth: attach the caller's picks if they're signed in.
    let picks = {};
    const header = req.headers.authorization;
    if (games.length && header?.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth().verifyIdToken(header.slice(7));
        const email = decoded.email?.toLowerCase();
        const doc = email ? await db().collection('picks').doc(email).get() : null;
        if (doc?.exists && doc.data().submitted) picks = doc.data().picksBySlot || {};
      } catch {
        /* invalid/expired token → just omit the personal stake */
      }
    }

    const withStake = games.map((g) => {
      const pick = picks[g.slot] || null;
      const inMatch = pick === g.teamA || pick === g.teamB;
      let you = null;
      if (pick) {
        if (inMatch) {
          const mine = pick === g.teamA ? g.scoreA : g.scoreB;
          const theirs = pick === g.teamA ? g.scoreB : g.scoreA;
          you = {
            need: pick,
            points: POINTS_BY_ROUND[g.round],
            status: mine > theirs ? 'ahead' : mine < theirs ? 'behind' : 'level',
          };
        } else {
          you = { need: null, status: 'out' }; // their pick isn't in this match (bracket line already gone)
        }
      }
      return { ...g, you };
    });

    res.json({ games: withStake });
  } catch (error) {
    console.error('Error fetching live games:', error);
    res.status(500).json({ error: 'Failed to fetch live games' });
  }
});

export default router;
