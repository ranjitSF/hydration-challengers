// Full end-to-end test against a LOCAL server + REAL Firestore/Firebase Auth.
// Mints real Firebase ID tokens (no email needed) to exercise the authenticated
// pick-submit, admin, cascade, scoring, lock and validation paths exactly as a
// browser would. Run: node scripts/e2e.mjs  (server must be running on :3001)
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { initializeFirebase, admin } from '../server/config/firebase.js';
initializeFirebase();

const API = 'http://localhost:3001/api';
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const PLAYER_EMAIL = 'test1@example.com';

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

async function idTokenFor(email) {
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch { user = await admin.auth().createUser({ email }); }
  const customToken = await admin.auth().createCustomToken(user.uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error('token exchange failed: ' + JSON.stringify(data));
  return data.idToken;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const FULL_BRACKET = {
  M89: 'France', M90: 'Canada', M91: 'Brazil', M92: 'England',
  M93: 'Spain', M94: 'USA', M95: 'Argentina', M96: 'Colombia/Ghana Winner',
  QF1: 'France', QF2: 'Spain', QF3: 'Brazil', QF4: 'Colombia/Ghana Winner',
  SF1: 'France', SF2: 'Colombia/Ghana Winner', F1: 'Colombia/Ghana Winner',
};

async function run() {
  console.log('Minting tokens…');
  const playerToken = await idTokenFor(PLAYER_EMAIL);
  const adminToken = await idTokenFor(ADMIN_EMAIL);

  console.log('\n1. Roster gate');
  check('known email is on roster', (await api('/players/login-check', { method: 'POST', body: { email: PLAYER_EMAIL } })).data.found === true);
  check('unknown email rejected', (await api('/players/login-check', { method: 'POST', body: { email: 'stranger@nope.com' } })).data.found === false);

  console.log('\n2. Sync links account to roster');
  const sync = await api('/players/sync', { method: 'POST', token: playerToken });
  check('sync returns player', sync.status === 200 && sync.data.email === PLAYER_EMAIL, JSON.stringify(sync.data));

  console.log('\n3. Pick validation');
  const badTbd = await api('/picks', { method: 'POST', token: playerToken, body: { picks: { ...FULL_BRACKET, M89: 'TBD' } } });
  check("literal 'TBD' pick rejected", badTbd.status === 400, JSON.stringify(badTbd.data));
  const partial = await api('/picks', { method: 'POST', token: playerToken, body: { picks: { M89: 'France' } } });
  check('partial (<15) submit rejected', partial.status === 400);
  const badFeeder = await api('/picks', { method: 'POST', token: playerToken, body: { picks: { ...FULL_BRACKET, QF1: 'Brazil' } } });
  check('QF pick not from that player\'s R16 winners rejected', badFeeder.status === 400);

  console.log('\n4. Full valid submit (incl. placeholder advanced to champion)');
  const submit = await api('/picks', { method: 'POST', token: playerToken, body: { picks: FULL_BRACKET } });
  check('full 15-pick bracket accepted', submit.status === 200, JSON.stringify(submit.data));
  const mine = await api('/picks/me', { token: playerToken });
  check('picks persisted', mine.data.picksBySlot?.F1 === 'Colombia/Ghana Winner');

  console.log('\n5. Admin gate');
  const gate = await api('/admin/results/M89', { method: 'PUT', token: playerToken, body: { winner: 'France' } });
  check('non-admin blocked (403)', gate.status === 403);

  console.log('\n6. Admin result validation');
  const typo = await api('/admin/results/M89', { method: 'PUT', token: adminToken, body: { winner: 'Portgual' } });
  check('typo winner rejected', typo.status === 400, JSON.stringify(typo.data));

  console.log('\n7. Placeholder resolution cascade (M96 -> Ghana)');
  const resolve = await api('/admin/matches/M96', { method: 'PUT', token: adminToken, body: { team_b: 'Ghana' } });
  check('M96 team_b set to Ghana', resolve.data.team_b === 'Ghana', JSON.stringify(resolve.data));
  check('cascade migrated this player\'s picks', resolve.data.migratedPicks >= 1, `migrated=${resolve.data.migratedPicks}`);
  const after = await api('/picks/me', { token: playerToken });
  check('champion pick now reads Ghana', after.data.picksBySlot?.F1 === 'Ghana', JSON.stringify(after.data.picksBySlot));
  check('QF4 + SF2 also migrated', after.data.picksBySlot?.QF4 === 'Ghana' && after.data.picksBySlot?.SF2 === 'Ghana');

  console.log('\n8. Results + scoring');
  await api('/admin/results/M89', { method: 'PUT', token: adminToken, body: { winner: 'France' } });   // +6
  await api('/admin/results/M96', { method: 'PUT', token: adminToken, body: { winner: 'Ghana' } });     // +6
  await api('/admin/results/QF4', { method: 'PUT', token: adminToken, body: { winner: 'Ghana' } });     // +10
  await api('/admin/results/F1', { method: 'PUT', token: adminToken, body: { winner: 'Ghana' } });      // +30
  await api(`/admin/players/${PLAYER_EMAIL}/starting-points`, { method: 'PUT', token: adminToken, body: { startingPoints: 15 } });

  const standings = await api('/standings');
  const me = standings.data.find((s) => s.playerId === PLAYER_EMAIL);
  check('pick points = 6+6+10+30 = 52', me.pickPoints === 52, `got ${me.pickPoints}`);
  check('total = starting 15 + 52 = 67', me.totalPoints === 67, `got ${me.totalPoints}`);
  check('R16 accuracy 2/8', me.accuracyByRound.R16.correct === 2);
  check('Champion correct 1/1', me.accuracyByRound.F.correct === 1);
  check('standings sorted desc + deterministic', standings.data.every((s, i, a) => i === 0 || a[i - 1].totalPoints >= s.totalPoints));

  console.log('\n9. Wrong-winner scores nobody (M90 result = Morocco, player picked Canada)');
  await api('/admin/results/M90', { method: 'PUT', token: adminToken, body: { winner: 'Morocco' } });
  const st2 = await api('/standings');
  check('player did NOT gain points for wrong pick', st2.data.find((s) => s.playerId === PLAYER_EMAIL).pickPoints === 52);

  console.log('\n10. Lock enforcement (temporarily move lock into the past)');
  const cfgRef = admin.firestore().collection('config').doc('app');
  const orig = (await cfgRef.get()).data();
  await cfgRef.set({ ...orig, lockAt: '2020-01-01T00:00:00-07:00' });
  const lockedSubmit = await api('/picks', { method: 'POST', token: playerToken, body: { picks: FULL_BRACKET } });
  check('submit after lock rejected (423)', lockedSubmit.status === 423, JSON.stringify(lockedSubmit.data));
  await cfgRef.set(orig); // restore
  console.log('  (lock restored)');

  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((err) => { console.error('E2E crashed:', err); process.exit(1); });
