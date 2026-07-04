import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
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
// Rejects if the email isn't on the (closed) roster.
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    const ref = db().collection('players').doc(email);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(403).json({ error: 'Email not on roster' });
    }

    await ref.update({ firebase_uid: req.user.uid });
    const updated = await ref.get();
    res.json(updated.data());
  } catch (error) {
    console.error('Error syncing player:', error);
    res.status(500).json({ error: 'Failed to sync player' });
  }
});

// Public: roster list for standings display
router.get('/', async (req, res) => {
  try {
    const snapshot = await db().collection('players').orderBy('display_name').get();
    res.json(snapshot.docs.map((d) => d.data()));
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

export default router;
