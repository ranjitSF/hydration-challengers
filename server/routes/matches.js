import express from 'express';
import pool from '../database/db.js';

const router = express.Router();

// Public: full bracket skeleton + any known results
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.round, m.slot, m.team_a, m.team_b, m.kickoff_at, m.venue,
              r.winner, r.source
       FROM matches m
       LEFT JOIN results r ON r.match_id = m.id
       ORDER BY
         CASE m.round WHEN 'R16' THEN 1 WHEN 'QF' THEN 2 WHEN 'SF' THEN 3 WHEN 'F' THEN 4 END,
         m.slot`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;
