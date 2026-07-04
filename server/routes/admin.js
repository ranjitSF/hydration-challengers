import express from 'express';
import { db } from '../database/firestore.js';
import { verifyToken } from '../config/firebase.js';
import { sanitizeString } from '../utils/validation.js';
import { renameInPicks } from '../lib/standings.js';
import { getAppConfig, resolveM87 } from '../lib/config.js';
import { pollOnce } from '../jobs/scorePoller.js';

const router = express.Router();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

// Case-insensitive admin gate — Firebase returns the email in whatever case the
// user typed at sign-in, so we normalize both sides (matches players.js/picks.js).
function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL || req.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

router.use(verifyToken, requireAdmin);

// The set of real teams that can ever be a valid result winner (the full R16 field).
async function getFieldTeams() {
  const snap = await db().collection('matches').where('round', '==', 'R16').get();
  const teams = new Set();
  for (const doc of snap.docs) {
    const m = doc.data();
    if (m.team_a && m.team_a !== 'TBD') teams.add(m.team_a);
    if (m.team_b && m.team_b !== 'TBD') teams.add(m.team_b);
  }
  return teams;
}

// When a match's team name changes (e.g. resolving the Colombia/Ghana placeholder),
// rewrite that team string everywhere it appears in every player's bracket so their
// picks — and any downstream rounds they advanced it to — stay correct and scorable.
async function cascadeRename(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  const picksSnap = await db().collection('picks').get();
  const batch = db().batch();
  let touched = 0;
  for (const doc of picksSnap.docs) {
    const { picksBySlot, changed } = renameInPicks(doc.data().picksBySlot || {}, oldName, newName);
    if (changed) {
      batch.update(doc.ref, { picksBySlot });
      touched += 1;
    }
  }
  if (touched > 0) await batch.commit();
  return touched;
}

// Fill in TBD teams (or correct a team name) for a match, cascading the rename into picks.
router.put('/matches/:slot', async (req, res) => {
  try {
    const ref = db().collection('matches').doc(req.params.slot);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Match not found' });
    const prev = doc.data();

    const newA = req.body.team_a ? sanitizeString(req.body.team_a) : null;
    const newB = req.body.team_b ? sanitizeString(req.body.team_b) : null;

    const update = {};
    if (newA) update.team_a = newA;
    if (newB) update.team_b = newB;
    await ref.update(update);

    let migrated = 0;
    if (newA) migrated += (await cascadeRename(prev.team_a, newA)) || 0;
    if (newB) migrated += (await cascadeRename(prev.team_b, newB)) || 0;

    const updated = await ref.get();
    res.json({ ...updated.data(), migratedPicks: migrated });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Set or correct a result. Manual entries always take precedence over auto-pulled
// ones. The winner MUST be one of that match's two teams (R16) or a real team in
// the field (later rounds) — this makes a typo that silently zeroes everyone's
// score impossible.
router.put('/results/:slot', async (req, res) => {
  try {
    const winner = sanitizeString(req.body.winner);
    if (!winner) return res.status(400).json({ error: 'winner is required' });

    const matchDoc = await db().collection('matches').doc(req.params.slot).get();
    if (!matchDoc.exists) return res.status(404).json({ error: 'Match not found' });
    const match = matchDoc.data();

    let allowed;
    if (match.round === 'R16') {
      allowed = new Set([match.team_a, match.team_b].filter((t) => t && t !== 'TBD'));
    } else {
      allowed = await getFieldTeams();
    }
    if (!allowed.has(winner)) {
      return res.status(400).json({ error: `"${winner}" isn't a valid team for ${req.params.slot}` });
    }

    const result = { winner, source: 'manual', updatedAt: new Date().toISOString() };
    await db().collection('results').doc(req.params.slot).set(result);

    // For the Final, optionally capture total goals for the tiebreaker.
    if (req.params.slot === 'F1' && req.body.totalGoals !== undefined && req.body.totalGoals !== '') {
      const goals = Number(req.body.totalGoals);
      if (Number.isInteger(goals) && goals >= 0) {
        await db().collection('config').doc('app').set({ finalTotalGoals: goals }, { merge: true });
      }
    }
    res.json(result);
  } catch (error) {
    console.error('Error setting result:', error);
    res.status(500).json({ error: 'Failed to set result' });
  }
});

router.put('/players/:email/starting-points', async (req, res) => {
  try {
    const startingPoints = Number(req.body.startingPoints);
    if (!Number.isFinite(startingPoints)) {
      return res.status(400).json({ error: 'startingPoints must be a number' });
    }

    const ref = db().collection('players').doc(req.params.email.toLowerCase());
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Player not found' });

    await ref.update({ starting_points: startingPoints });
    const updated = await ref.get();
    res.json(updated.data());
  } catch (error) {
    console.error('Error updating starting points:', error);
    res.status(500).json({ error: 'Failed to update starting points' });
  }
});

// Set a Round-of-32 result (used for M87 Colombia/Ghana, which decides tonight).
// This resolves every player's M96 board — a real survivor they backed becomes
// pickable, so it parallels the R16+ result flow.
router.put('/r32/:game', async (req, res) => {
  try {
    const winner = sanitizeString(req.body.winner);
    if (!winner) return res.status(400).json({ error: 'winner is required' });
    if (req.params.game !== 'M87') return res.status(400).json({ error: 'Only M87 is settable' });

    const realR32 = await resolveM87(winner);
    res.json({ realR32 });
  } catch (error) {
    console.error('Error setting R32 result:', error);
    res.status(500).json({ error: 'Failed to set R32 result' });
  }
});

// Manual trigger for the API-Football poll (Vercel Hobby cron only runs once/day,
// so the admin can force a check right after a match ends instead of waiting).
router.post('/poll-scores', async (req, res) => {
  try {
    const result = await pollOnce();
    res.json(result);
  } catch (error) {
    console.error('Manual poll error:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

// Matches whose kickoff has passed (+3h buffer) with no result yet, plus any
// matches still carrying an unresolved placeholder team.
router.get('/status', async (req, res) => {
  try {
    const [matchesSnap, resultsSnap] = await Promise.all([
      db().collection('matches').get(),
      db().collection('results').get(),
    ]);
    const resultSlots = new Set(resultsSnap.docs.map((d) => d.id));
    const now = Date.now();
    const matches = matchesSnap.docs.map((d) => d.data());

    const needsResult = matches.filter(
      (m) => !resultSlots.has(m.slot) && m.kickoff_at && now > new Date(m.kickoff_at).getTime() + 3 * 60 * 60 * 1000
    );
    const unresolvedTeams = matches.filter(
      (m) => /winner/i.test(m.team_a || '') || /winner/i.test(m.team_b || '') || m.team_a === 'TBD' || m.team_b === 'TBD'
    );

    const config = await getAppConfig();
    const realR32 = config.realR32 || {};
    const r32M87 = realR32.M87 || null; // the one R32 result still pending (Colombia/Ghana)

    res.json({ needsResult, unresolvedTeams, r32M87 });
  } catch (error) {
    console.error('Error fetching admin status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
