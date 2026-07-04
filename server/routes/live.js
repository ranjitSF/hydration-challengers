import express from 'express';
import { db } from '../database/firestore.js';
import { admin } from '../config/firebase.js';
import { featuredMatch } from '../jobs/scorePoller.js';
import { POINTS_BY_ROUND } from '../lib/scoring.js';

const router = express.Router();

// What the signed-in caller needs from the featured match, tailored to its state.
function stakeFor(state, match, pick) {
  if (!pick || !match) return null;
  const inMatch = pick === match.teamA || pick === match.teamB;
  const points = POINTS_BY_ROUND[match.round];
  if (state === 'live') {
    if (!inMatch) return { status: 'out' };
    const mine = pick === match.teamA ? match.scoreA : match.scoreB;
    const theirs = pick === match.teamA ? match.scoreB : match.scoreA;
    return { need: pick, points, status: mine > theirs ? 'ahead' : mine < theirs ? 'behind' : 'level' };
  }
  if (state === 'recent') {
    if (!inMatch) return { result: 'out' };
    return { need: pick, points, result: pick === match.winner ? 'won' : 'missed' };
  }
  if (state === 'upcoming') {
    if (!match.known) return null;
    if (!inMatch) return { status: 'out' };
    return { need: pick, points };
  }
  return null;
}

// Public: the featured match (live / recent / upcoming). With a valid Bearer token,
// it also carries the caller's stake. `nextPollSeconds` lets the client back off.
router.get('/', async (req, res) => {
  try {
    const featured = await featuredMatch();

    let picks = {};
    const header = req.headers.authorization;
    if (featured.match && header?.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth().verifyIdToken(header.slice(7));
        const email = decoded.email?.toLowerCase();
        const doc = email ? await db().collection('picks').doc(email).get() : null;
        if (doc?.exists && doc.data().submitted) picks = doc.data().picksBySlot || {};
      } catch {
        /* invalid/expired token → just omit the personal stake */
      }
    }

    if (featured.match) {
      featured.match.you = stakeFor(featured.state, featured.match, picks[featured.match.slot] || null);
    }
    res.json(featured);
  } catch (error) {
    console.error('Error fetching featured match:', error);
    res.status(500).json({ error: 'Failed to fetch featured match' });
  }
});

export default router;
