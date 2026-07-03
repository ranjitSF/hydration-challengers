import express from 'express';
import pool from '../database/db.js';
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

    const result = await pool.query(
      'SELECT display_name FROM players WHERE lower(email) = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ found: false });
    }

    res.json({ found: true, displayName: result.rows[0].display_name });
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

    const existing = await pool.query('SELECT * FROM players WHERE lower(email) = $1', [email]);
    if (existing.rows.length === 0) {
      return res.status(403).json({ error: 'Email not on roster' });
    }

    const updated = await pool.query(
      'UPDATE players SET firebase_uid = $1 WHERE id = $2 RETURNING id, email, display_name, starting_points',
      [req.user.uid, existing.rows[0].id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Error syncing player:', error);
    res.status(500).json({ error: 'Failed to sync player' });
  }
});

// Public: roster list for standings display
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, display_name, starting_points FROM players ORDER BY display_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

export default router;
