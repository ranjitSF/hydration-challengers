import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { getAppConfig, isLocked } from '../lib/config.js';
import { computePlayerBoard } from '../lib/board.js';
import { BRACKET_PAIRING, R16_SLOTS, ALL_SLOTS } from '../lib/bracket.js';

const router = express.Router();

const isValidGoals = (g) => Number.isInteger(g) && g >= 0 && g <= 20;

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
    finalGoals: Number.isInteger(picksData.finalGoals) ? picksData.finalGoals : null,
    submitted: picksData.submitted === true,
  };
}

function optionsForSlot(slot, board, resolved) {
  if (R16_SLOTS.includes(slot)) return board.options[slot] || [];
  const [fa, fb] = BRACKET_PAIRING[slot];
  return [resolved[fa], resolved[fb]].filter(Boolean);
}

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
    const { board, picksBySlot, finalGoals, submitted } = await loadPlayerContext(email);
    res.json({ picksBySlot, finalGoals, submitted, board });
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// Save picks. body: { picks, finalGoals, submit }. Draft (submit:false) allows a
// partial bracket + no goals guess. Submit (submit:true) requires the Colombia/Ghana
// result to be in, a complete bracket, AND a Final total-goals prediction (tiebreak).
router.post('/', verifyToken, async (req, res) => {
  try {
    if (await isLocked()) return res.status(423).json({ error: 'Picks are locked' });

    const email = req.user.email?.toLowerCase();
    const { exists, board, realR32, submitted: alreadySubmitted, finalGoals: existingGoals } = await loadPlayerContext(email);
    if (!exists) return res.status(403).json({ error: 'Player not found' });

    const picks = req.body.picks;
    const submit = req.body.submit === true;
    if (!picks || typeof picks !== 'object') return res.status(400).json({ error: 'Missing picks' });

    // Final total-goals tiebreaker prediction (optional on a draft, required to submit).
    let finalGoals = existingGoals;
    if (req.body.finalGoals !== undefined && req.body.finalGoals !== null && req.body.finalGoals !== '') {
      const g = Number(req.body.finalGoals);
      if (!isValidGoals(g)) return res.status(400).json({ error: 'Final total goals must be a whole number 0–20' });
      finalGoals = g;
    }

    if (submit && !realR32.M87) {
      return res.status(425).json({ error: 'Submissions open once the Colombia–Ghana result is in.' });
    }

    const { resolved, error } = resolvePicks(picks, board, { requireComplete: submit });
    if (error) return res.status(400).json({ error });

    if (submit && !isValidGoals(finalGoals)) {
      return res.status(400).json({ error: 'Predict the total goals in the Final before submitting (tiebreaker).' });
    }

    const nowSubmitted = submit ? true : alreadySubmitted;
    await db().collection('picks').doc(email).set({
      picksBySlot: resolved,
      finalGoals: Number.isInteger(finalGoals) ? finalGoals : null,
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
