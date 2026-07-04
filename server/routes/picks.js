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
  const realR32 = config.realR32 || {};
  const board = computePlayerBoard(r32Picks, realR32);
  const picksData = picksDoc.exists ? picksDoc.data() : {};
  return {
    exists: playerDoc.exists,
    board,
    realR32,
    picksBySlot: picksData.picksBySlot || {},
    submitted: picksData.submitted === true,
  };
}

// Options available to a player for one slot: R16 from their board, later rounds
// from the teams they've advanced so far (null-tolerant for dead/blank feeders).
function optionsForSlot(slot, board, resolved) {
  if (R16_SLOTS.includes(slot)) return board.options[slot] || [];
  const [fa, fb] = BRACKET_PAIRING[slot];
  return [resolved[fa], resolved[fb]].filter(Boolean);
}

// Validate + normalize a submitted picks map against the player's board. In draft
// mode blanks are allowed; in submit mode every OPEN slot must be filled.
function resolvePicks(picks, board, { requireComplete }) {
  const resolved = {};
  for (const slot of ALL_SLOTS) {
    const opts = optionsForSlot(slot, board, resolved);
    const submitted = picks[slot];
    if (opts.length === 0) {
      if (submitted) return { error: `${slot} has no available team to pick` };
      continue;
    }
    if (!submitted) {
      if (requireComplete) return { error: `Missing pick for ${slot}` };
      continue;
    }
    if (!opts.includes(submitted)) {
      return { error: `Invalid pick for ${slot}: must be one of ${opts.join(' or ')}` };
    }
    resolved[slot] = submitted;
  }
  return { resolved };
}

router.get('/me', verifyToken, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    const { board, picksBySlot, submitted } = await loadPlayerContext(email);
    res.json({ picksBySlot, submitted, board });
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// Save picks. body: { picks, submit }. submit:false = auto-saved draft (partial OK,
// doesn't count). submit:true = final (requires the Colombia/Ghana result to be in
// AND a complete bracket). Both are blocked once picks lock at R16 kickoff.
router.post('/', verifyToken, async (req, res) => {
  try {
    if (await isLocked()) {
      return res.status(423).json({ error: 'Picks are locked' });
    }

    const email = req.user.email?.toLowerCase();
    const { exists, board, realR32, submitted: alreadySubmitted } = await loadPlayerContext(email);
    if (!exists) return res.status(403).json({ error: 'Player not found' });

    const picks = req.body.picks;
    const submit = req.body.submit === true;
    if (!picks || typeof picks !== 'object') {
      return res.status(400).json({ error: 'Missing picks' });
    }

    // Final submission is gated on the Colombia/Ghana (M87) result being in, so no
    // one locks in an incomplete bracket whose M96 leg isn't decided yet.
    if (submit && !realR32.M87) {
      return res.status(425).json({ error: 'Submissions open once the Colombia–Ghana result is in.' });
    }

    const { resolved, error } = resolvePicks(picks, board, { requireComplete: submit });
    if (error) return res.status(400).json({ error });

    // A draft keeps whatever submitted-state you already had; submitting sets it true.
    const nowSubmitted = submit ? true : alreadySubmitted;

    await db().collection('picks').doc(email).set({
      picksBySlot: resolved,
      submitted: nowSubmitted,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, submitted: nowSubmitted });
  } catch (error) {
    console.error('Error saving picks:', error);
    res.status(500).json({ error: 'Failed to save picks' });
  }
});

export default router;
