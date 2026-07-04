import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken, admin } from '../config/firebase.js';
import { getAppConfig, isLocked } from '../lib/config.js';
import { ALL_SLOTS, ROUND_BY_SLOT, R16_SLOTS, R32_FEEDERS, AUTO_R32_GAME } from '../lib/bracket.js';
import { POINTS_BY_ROUND, R32_POINTS_PER_CORRECT } from '../lib/scoring.js';
import { computeEliminated, projectPlayer, computeBestRanks, realMatchup } from '../lib/projection.js';
import { sendSignInEmail, emailConfigured } from '../utils/email.js';
import { isValidEmail, sanitizeString } from '../utils/validation.js';

const router = express.Router();

const APP_URL = process.env.APP_URL || 'https://hydration-challengers.vercel.app';

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

// Public: generate a passwordless sign-in link server-side (Admin SDK — no email
// quota) and deliver it through our own SMTP. This bypasses Firebase's capped,
// spam-flagged built-in email sender entirely.
router.post('/request-link', async (req, res) => {
  try {
    const email = sanitizeString(req.body.email).toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email is required' });

    const doc = await db().collection('players').doc(email).get();
    if (!doc.exists) return res.json({ found: false }); // not on roster

    if (!emailConfigured()) return res.status(500).json({ error: 'Email sending is not configured' });

    const rawLink = await admin.auth().generateSignInWithEmailLink(email, {
      url: `${APP_URL}/login`,
      handleCodeInApp: true,
    });
    // Rebuild in the direct format our client (isSignInWithEmailLink) completes with.
    const u = new URL(rawLink);
    const link = new URL(u.searchParams.get('continueUrl'));
    link.searchParams.set('apiKey', u.searchParams.get('apiKey'));
    link.searchParams.set('oobCode', u.searchParams.get('oobCode'));
    link.searchParams.set('mode', 'signIn');

    await sendSignInEmail(email, link.toString());
    res.json({ found: true, sent: true });
  } catch (error) {
    console.error('Error sending sign-in link:', error);
    res.status(500).json({ error: 'Failed to send sign-in email' });
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

// Post-lock only: full projection for one player — their bracket (R32 → Final with
// real results), point ceiling + the exact remaining wins to reach it, and the best
// standings rank they can still finish in (exact, via bracket enumeration).
router.get('/:id/projection', async (req, res) => {
  try {
    if (!(await isLocked())) {
      return res.status(403).json({ error: 'Projections become visible once picks lock' });
    }
    const email = req.params.id.toLowerCase();
    const [playersSnap, picksSnap, resultsSnap, config] = await Promise.all([
      db().collection('players').get(),
      db().collection('picks').get(),
      db().collection('results').get(),
      getAppConfig(),
    ]);
    const targetDoc = playersSnap.docs.find((d) => d.id === email);
    if (!targetDoc) return res.status(404).json({ error: 'Player not found' });

    const realR32 = config.realR32 || {};
    const realResults = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data().winner]));
    const picksByEmail = Object.fromEntries(picksSnap.docs.map((d) => [d.id, d.data()]));
    const eliminated = computeEliminated(realResults, realR32);

    const buildPlayer = (doc) => {
      const p = doc.data();
      const pk = picksByEmail[doc.id] || {};
      const submitted = pk.submitted === true;
      return {
        playerId: doc.id,
        display_name: p.display_name,
        r32Picks: p.r32Picks || {},
        starting_points: p.starting_points || 0,
        picksBySlot: submitted ? pk.picksBySlot || {} : {},
        submitted,
      };
    };
    const allPlayers = playersSnap.docs.map(buildPlayer);
    const target = buildPlayer(targetDoc);
    const proj = projectPlayer(target, realResults, realR32, eliminated);

    // Best achievable rank needs everyone's current total as the base.
    const withBase = allPlayers.map((pl) => ({
      playerId: pl.playerId,
      picksBySlot: pl.picksBySlot,
      base: projectPlayer(pl, realResults, realR32, eliminated).currentTotal,
    }));
    const bestRanks = computeBestRanks(withBase, realResults, realR32);

    const statusOf = (picked, winner, decided, correct) => {
      if (!picked) return 'none';
      if (decided) return correct ? 'won' : 'out';
      return eliminated.has(picked) ? 'dead' : 'alive';
    };

    // R32 column: 16 games in bracket order, grouped by the R16 slot they feed.
    const r32 = [];
    for (const slot of R16_SLOTS) {
      for (const game of R32_FEEDERS[slot]) {
        const auto = game === AUTO_R32_GAME;
        const winner = realR32[game] || null;
        const picked = auto ? winner : target.r32Picks[game] || null;
        const correct = !!winner && picked === winner;
        r32.push({
          game, feedsR16: slot, picked, winner, decided: !!winner, correct, auto,
          points: correct && !auto ? R32_POINTS_PER_CORRECT : 0,
          status: auto ? 'auto' : statusOf(picked, winner, !!winner, correct),
        });
      }
    }

    // R16 → Final bracket for the target.
    const bracket = ALL_SLOTS.map((slot) => {
      const round = ROUND_BY_SLOT[slot];
      const picked = target.picksBySlot[slot] || null;
      const winner = realResults[slot] || null;
      const correct = !!winner && picked === winner;
      return {
        slot, round, picked, winner, decided: !!winner, correct,
        points: correct ? POINTS_BY_ROUND[round] : 0,
        status: statusOf(picked, winner, !!winner, correct),
        teams: realMatchup(slot, realResults, realR32),
      };
    });

    res.json({
      displayName: target.display_name,
      submitted: target.submitted,
      r32,
      bracket,
      currentTotal: proj.currentTotal,
      ceiling: proj.ceiling,
      remaining: proj.remaining,
      path: proj.path,
      bestRank: bestRanks[target.playerId],
      playerCount: allPlayers.length,
    });
  } catch (error) {
    console.error('Error computing projection:', error);
    res.status(500).json({ error: 'Failed to compute projection' });
  }
});

export default router;
