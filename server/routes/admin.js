import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { sanitizeString } from '../utils/validation.js';
import { pollOnce } from '../jobs/scorePoller.js';

const router = express.Router();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL || req.user?.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

router.use(verifyToken, requireAdmin);

// Fill in TBD teams (or correct a team name) for a match
router.put('/matches/:slot', async (req, res) => {
  try {
    const { team_a, team_b } = req.body;
    const update = {};
    if (team_a) update.team_a = sanitizeString(team_a);
    if (team_b) update.team_b = sanitizeString(team_b);

    const ref = db().collection('matches').doc(req.params.slot);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Match not found' });

    await ref.update(update);
    const updated = await ref.get();
    res.json(updated.data());
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Set or correct a result. Manual entries always take precedence, regardless of
// what wrote the row before (see server/jobs/scorePoller.js for the auto path).
router.put('/results/:slot', async (req, res) => {
  try {
    const winner = sanitizeString(req.body.winner);
    if (!winner) return res.status(400).json({ error: 'winner is required' });

    const result = { winner, source: 'manual', updatedAt: new Date().toISOString() };
    await db().collection('results').doc(req.params.slot).set(result);
    res.json(result);
  } catch (error) {
    console.error('Error setting result:', error);
    res.status(500).json({ error: 'Failed to set result' });
  }
});

router.put('/players/:email/starting-points', async (req, res) => {
  try {
    const startingPoints = Number(req.body.startingPoints);
    if (!Number.isFinite(startingPoints)) {
      return res.status(400).json({ error: 'startingPoints must be a number' });
    }

    const ref = db().collection('players').doc(req.params.email.toLowerCase());
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Player not found' });

    await ref.update({ starting_points: startingPoints });
    const updated = await ref.get();
    res.json(updated.data());
  } catch (error) {
    console.error('Error updating starting points:', error);
    res.status(500).json({ error: 'Failed to update starting points' });
  }
});

// Manual trigger for the API-Football poll (Vercel Hobby cron only runs once/day,
// so the admin can force a check right after a match ends instead of waiting).
router.post('/poll-scores', async (req, res) => {
  try {
    const result = await pollOnce();
    res.json(result);
  } catch (error) {
    console.error('Manual poll error:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

// Matches whose kickoff has passed (+3h buffer) with no result yet
router.get('/status', async (req, res) => {
  try {
    const [matchesSnap, resultsSnap] = await Promise.all([
      db().collection('matches').get(),
      db().collection('results').get(),
    ]);
    const resultSlots = new Set(resultsSnap.docs.map((d) => d.id));
    const now = Date.now();

    const needsResult = matchesSnap.docs
      .map((d) => d.data())
      .filter((m) => !resultSlots.has(m.slot) && m.kickoff_at && now > new Date(m.kickoff_at).getTime() + 3 * 60 * 60 * 1000);

    res.json({ needsResult });
  } catch (error) {
    console.error('Error fetching admin status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
