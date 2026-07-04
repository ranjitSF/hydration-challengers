import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { getAppConfig, isLocked } from '../lib/config.js';
import { ALL_SLOTS, ROUND_BY_SLOT } from '../lib/bracket.js';
import { POINTS_BY_ROUND } from '../lib/scoring.js';
import { isValidEmail, sanitizeString } from '../utils/validation.js';

const router = express.Router();

// Public: is this email on the roster? (checked before triggering Firebase's email-link send)
router.post('/login-check', async (req, res) => {
  try {
    const email = sanitizeString(req.body.email).toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const doc = await db().collection('players').doc(email).get();
    if (!doc.exists) return res.json({ found: false });
    res.json({ found: true, displayName: doc.data().display_name });
  } catch (error) {
    console.error('Error checking roster:', error);
    res.status(500).json({ error: 'Failed to check roster' });
  }
});

// Auth required: link the Firebase account to the roster row after a successful sign-in.
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    const ref = db().collection('players').doc(email);
    const doc = await ref.get();
    if (!doc.exists) return res.status(403).json({ error: 'Email not on roster' });
    await ref.update({ firebase_uid: req.user.uid });
    const updated = await ref.get();
    const { display_name, starting_points } = updated.data();
    res.json({ email, display_name, starting_points });
  } catch (error) {
    console.error('Error syncing player:', error);
    res.status(500).json({ error: 'Failed to sync player' });
  }
});

// Public: roster list (safe fields only — never expose r32Picks / firebase_uid).
router.get('/', async (req, res) => {
  try {
    const snapshot = await db().collection('players').orderBy('display_name').get();
    res.json(snapshot.docs.map((d) => {
      const p = d.data();
      return { email: p.email, display_name: p.display_name, starting_points: p.starting_points || 0 };
    }));
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Public but ONLY after picks lock: a player's submitted bracket with, for each
// pick, the real result and the points it earned. Keeps everyone's picks private
// until the deadline, then lets the group see how each other did.
router.get('/:id/bracket', async (req, res) => {
  try {
    if (!(await isLocked())) {
      return res.status(403).json({ error: 'Brackets become visible once picks lock' });
    }
    const email = req.params.id.toLowerCase();
    const [playerDoc, picksDoc, resultsSnap, config] = await Promise.all([
      db().collection('players').doc(email).get(),
      db().collection('picks').doc(email).get(),
      db().collection('results').get(),
      getAppConfig(),
    ]);
    if (!playerDoc.exists) return res.status(404).json({ error: 'Player not found' });

    const picksData = picksDoc.exists ? picksDoc.data() : {};
    const submitted = picksData.submitted === true;
    const picksBySlot = submitted ? picksData.picksBySlot || {} : {};
    const resultsBySlot = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));

    const bracket = ALL_SLOTS.map((slot) => {
      const round = ROUND_BY_SLOT[slot];
      const picked = picksBySlot[slot] || null;
      const winner = resultsBySlot[slot] || null;
      const correct = !!winner && picked === winner;
      return { slot, round, picked, winner, decided: !!winner, correct, points: correct ? POINTS_BY_ROUND[round] : 0 };
    });

    res.json({
      displayName: playerDoc.data().display_name,
      submitted,
      finalGoalsPrediction: submitted && Number.isInteger(picksData.finalGoals) ? picksData.finalGoals : null,
      finalTotalGoals: Number.isInteger(config.finalTotalGoals) ? config.finalTotalGoals : null,
      bracket,
    });
  } catch (error) {
    console.error('Error fetching bracket:', error);
    res.status(500).json({ error: 'Failed to fetch bracket' });
  }
});

export default router;
