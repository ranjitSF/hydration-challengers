import express from 'express';
import pool from '../database/db.js';
import { scorePlayerPicks } from '../lib/scoring.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [playersRes, matchesRes, resultsRes, picksRes] = await Promise.all([
      pool.query('SELECT id, display_name, starting_points FROM players ORDER BY display_name'),
      pool.query('SELECT id, round, slot FROM matches'),
      pool.query('SELECT match_id, winner FROM results'),
      pool.query('SELECT player_id, match_id, picked_team FROM picks'),
    ]);

    const matchesById = Object.fromEntries(matchesRes.rows.map((m) => [m.id, m]));
    const resultsByMatchId = Object.fromEntries(resultsRes.rows.map((r) => [r.match_id, r.winner]));
    const picksByPlayer = {};
    for (const pick of picksRes.rows) {
      (picksByPlayer[pick.player_id] ||= []).push(pick);
    }

    const standings = playersRes.rows.map((player) => {
      const picks = picksByPlayer[player.id] || [];
      const { total, accuracyByRound } = scorePlayerPicks(picks, matchesById, resultsByMatchId);
      return {
        playerId: player.id,
        displayName: player.display_name,
        startingPoints: player.starting_points,
        pickPoints: total,
        totalPoints: player.starting_points + total,
        accuracyByRound,
        hasSubmitted: picks.length > 0,
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
