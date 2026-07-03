import express from 'express';
import pool from '../database/db.js';
import { verifyToken } from '../config/firebase.js';
import { isLocked } from '../lib/config.js';
import { BRACKET_PAIRING, R16_SLOTS, QF_SLOTS, SF_SLOTS, FINAL_SLOT } from '../lib/bracket.js';

const router = express.Router();

async function getPlayerIdForRequest(req) {
  const result = await pool.query('SELECT id FROM players WHERE firebase_uid = $1', [req.user.uid]);
  return result.rows[0]?.id ?? null;
}

router.get('/me', verifyToken, async (req, res) => {
  try {
    const playerId = await getPlayerIdForRequest(req);
    if (!playerId) return res.status(403).json({ error: 'Player not found' });

    const result = await pool.query(
      `SELECT match_id, picked_team FROM picks WHERE player_id = $1`,
      [playerId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// All-or-nothing submit/resubmit of all 15 picks. body: { picks: { [slot]: teamName } }
router.post('/', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    if (await isLocked()) {
      return res.status(423).json({ error: 'Picks are locked' });
    }

    const playerId = await getPlayerIdForRequest(req);
    if (!playerId) return res.status(403).json({ error: 'Player not found' });

    const picks = req.body.picks;
    if (!picks || typeof picks !== 'object') {
      return res.status(400).json({ error: 'Missing picks' });
    }

    const matchesResult = await pool.query('SELECT id, round, slot, team_a, team_b FROM matches');
    const matchBySlot = Object.fromEntries(matchesResult.rows.map((m) => [m.slot, m]));

    const allSlots = [...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, FINAL_SLOT];
    const resolvedTeamBySlot = {};

    for (const slot of allSlots) {
      const match = matchBySlot[slot];
      if (!match) return res.status(500).json({ error: `Match ${slot} not seeded` });

      const submitted = picks[slot];
      if (!submitted || typeof submitted !== 'string') {
        return res.status(400).json({ error: `Missing pick for ${slot}` });
      }

      let validOptions;
      if (match.round === 'R16') {
        validOptions = [match.team_a, match.team_b];
      } else {
        const [feederA, feederB] = BRACKET_PAIRING[slot];
        validOptions = [resolvedTeamBySlot[feederA], resolvedTeamBySlot[feederB]];
      }

      if (!validOptions.includes(submitted)) {
        return res.status(400).json({ error: `Invalid pick for ${slot}: must be one of ${validOptions.join(' or ')}` });
      }

      resolvedTeamBySlot[slot] = submitted;
    }

    await client.query('BEGIN');
    for (const slot of allSlots) {
      const match = matchBySlot[slot];
      await client.query(
        `INSERT INTO picks (player_id, match_id, picked_team, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (player_id, match_id) DO UPDATE SET picked_team = EXCLUDED.picked_team, updated_at = now()`,
        [playerId, match.id, resolvedTeamBySlot[slot]]
      );
    }
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving picks:', error);
    res.status(500).json({ error: 'Failed to save picks' });
  } finally {
    client.release();
  }
});

export default router;
