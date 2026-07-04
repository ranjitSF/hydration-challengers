import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { getAppConfig, isLocked } from '../lib/config.js';
import { computePlayerBoard } from '../lib/board.js';
import { BRACKET_PAIRING, R16_SLOTS, ALL_SLOTS } from '../lib/bracket.js';

const router = express.Router();

async function loadPlayerContext(email) {
  const [playerDoc, config, picksDoc] = await Promise.all([
    db().collection('players').doc(email).get(),
    getAppConfig(),
    db().collection('picks').doc(email).get(),
  ]);
  const r32Picks = playerDoc.exists ? playerDoc.data().r32Picks || {} : {};
  const board = computePlayerBoard(r32Picks, config.realR32 || {});
  const picksBySlot = picksDoc.exists ? picksDoc.data().picksBySlot || {} : {};
  return { exists: playerDoc.exists, board, picksBySlot };
}

// Options available to a player for one slot, given their R16 board and the picks
// they've resolved so far (QF/SF/F feed from their own prior picks).
function optionsForSlot(slot, board, resolved) {
  if (R16_SLOTS.includes(slot)) return board.options[slot] || [];
  const [fa, fb] = BRACKET_PAIRING[slot];
  return [resolved[fa], resolved[fb]].filter(Boolean);
}

router.get('/me', verifyToken, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    const { board, picksBySlot } = await loadPlayerContext(email);
    res.json({ picksBySlot, board });
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// All-or-nothing submit of every OPEN slot (slots with >=1 available team). Dead
// slots (both feeders knocked out) carry no pick. body: { picks: { [slot]: team } }
router.post('/', verifyToken, async (req, res) => {
  try {
    if (await isLocked()) {
      return res.status(423).json({ error: 'Picks are locked' });
    }

    const email = req.user.email?.toLowerCase();
    const { exists, board } = await loadPlayerContext(email);
    if (!exists) return res.status(403).json({ error: 'Player not found' });

    const picks = req.body.picks;
    if (!picks || typeof picks !== 'object') {
      return res.status(400).json({ error: 'Missing picks' });
    }

    const resolved = {};
    for (const slot of ALL_SLOTS) {
      const opts = optionsForSlot(slot, board, resolved);
      const submitted = picks[slot];

      if (opts.length === 0) {
        // Dead (or pending) slot — must not carry a pick.
        if (submitted) return res.status(400).json({ error: `${slot} has no available team to pick` });
        continue;
      }
      if (!submitted) {
        return res.status(400).json({ error: `Missing pick for ${slot}` });
      }
      if (!opts.includes(submitted)) {
        return res.status(400).json({ error: `Invalid pick for ${slot}: must be one of ${opts.join(' or ')}` });
      }
      resolved[slot] = submitted;
    }

    await db().collection('picks').doc(email).set({
      picksBySlot: resolved,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving picks:', error);
    res.status(500).json({ error: 'Failed to save picks' });
  }
});

export default router;
