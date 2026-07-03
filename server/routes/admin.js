import express from 'express';
import pool from '../database/db.js';
import { verifyToken } from '../config/firebase.js';
import { sanitizeString } from '../utils/validation.js';

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
router.put('/matches/:id', async (req, res) => {
  try {
    const { team_a, team_b } = req.body;
    const result = await pool.query(
      `UPDATE matches SET
         team_a = COALESCE($1, team_a),
         team_b = COALESCE($2, team_b)
       WHERE id = $3 RETURNING *`,
      [team_a ? sanitizeString(team_a) : null, team_b ? sanitizeString(team_b) : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Set or correct a result. Manual entries always take precedence, regardless of
// what wrote the row before (see server/jobs/scorePoller.js for the auto path).
router.put('/results/:matchId', async (req, res) => {
  try {
    const winner = sanitizeString(req.body.winner);
    if (!winner) return res.status(400).json({ error: 'winner is required' });

    const result = await pool.query(
      `INSERT INTO results (match_id, winner, source, updated_at)
       VALUES ($1, $2, 'manual', now())
       ON CONFLICT (match_id) DO UPDATE SET winner = EXCLUDED.winner, source = 'manual', updated_at = now()
       RETURNING *`,
      [req.params.matchId, winner]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting result:', error);
    res.status(500).json({ error: 'Failed to set result' });
  }
});

router.put('/players/:id/starting-points', async (req, res) => {
  try {
    const startingPoints = Number(req.body.startingPoints);
    if (!Number.isFinite(startingPoints)) {
      return res.status(400).json({ error: 'startingPoints must be a number' });
    }

    const result = await pool.query(
      'UPDATE players SET starting_points = $1 WHERE id = $2 RETURNING *',
      [startingPoints, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating starting points:', error);
    res.status(500).json({ error: 'Failed to update starting points' });
  }
});

// Matches whose kickoff has passed (+3h buffer) with no result yet
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.round, m.slot, m.team_a, m.team_b, m.kickoff_at
       FROM matches m
       LEFT JOIN results r ON r.match_id = m.id
       WHERE r.match_id IS NULL
         AND m.kickoff_at IS NOT NULL
         AND m.kickoff_at + INTERVAL '3 hours' < now()`
    );
    res.json({ needsResult: result.rows });
  } catch (error) {
    console.error('Error fetching admin status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
