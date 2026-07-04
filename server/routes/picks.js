import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { isLocked } from '../lib/config.js';
import { BRACKET_PAIRING, ALL_SLOTS } from '../lib/bracket.js';

const router = express.Router();

router.get('/me', verifyToken, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    const doc = await db().collection('picks').doc(email).get();
    res.json({ picksBySlot: doc.exists ? doc.data().picksBySlot : {} });
  } catch (error) {
    console.error('Error fetching picks:', error);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// All-or-nothing submit/resubmit of all 15 picks. body: { picks: { [slot]: teamName } }
router.post('/', verifyToken, async (req, res) => {
  try {
    if (await isLocked()) {
      return res.status(423).json({ error: 'Picks are locked' });
    }

    const email = req.user.email?.toLowerCase();
    const playerDoc = await db().collection('players').doc(email).get();
    if (!playerDoc.exists) return res.status(403).json({ error: 'Player not found' });

    const picks = req.body.picks;
    if (!picks || typeof picks !== 'object') {
      return res.status(400).json({ error: 'Missing picks' });
    }

    const matchesSnap = await db().collection('matches').get();
    const matchBySlot = Object.fromEntries(matchesSnap.docs.map((d) => [d.id, d.data()]));

    const resolvedTeamBySlot = {};

    for (const slot of ALL_SLOTS) {
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

    await db().collection('picks').doc(email).set({
      picksBySlot: resolvedTeamBySlot,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving picks:', error);
    res.status(500).json({ error: 'Failed to save picks' });
  }
});

export default router;
