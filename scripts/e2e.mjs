// End-to-end test of the continuation-bracket model against a LOCAL server + REAL
// Firestore. Mints real Firebase tokens (no email needed). Exercises per-player
// board (forced/choice/dead/pending), validation, the M87 resolve, scoring, and
// lock. Cleans up after itself. Run: node scripts/e2e.mjs  (server on :3001)
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { initializeFirebase, admin } from '../server/config/firebase.js';
import { BRACKET_PAIRING, R16_SLOTS, ALL_SLOTS } from '../server/lib/bracket.js';
initializeFirebase();

const API = 'http://localhost:3001/api';
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const PLAYER = 'appunni.nair@gmail.com'; // Kulapulli Appan — 10/14 R32, good test spread

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

async function idTokenFor(email) {
  let user;
  try { user = await admin.auth().getUserByEmail(email); } catch { user = await admin.auth().createUser({ email }); }
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
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// Build a valid resolved bracket from the player's R16 options + choices for 2-way slots.
function buildBracket(r16Options, choices = {}) {
  const resolved = {};
  for (const slot of ALL_SLOTS) {
    const opts = R16_SLOTS.includes(slot)
      ? r16Options[slot] || []
      : [resolved[BRACKET_PAIRING[slot][0]], resolved[BRACKET_PAIRING[slot][1]]].filter(Boolean);
    if (opts.length === 0) continue;
    resolved[slot] = opts.length === 1 ? opts[0] : (choices[slot] ?? opts[0]);
  }
  return resolved;
}

async function run() {
  const playerToken = await idTokenFor(PLAYER);
  const adminToken = await idTokenFor(ADMIN_EMAIL);
  const cfg = admin.firestore().collection('config').doc('app');

  console.log('\n1. Sync + board shape (M87 still pending)');
  await api('/players/sync', { method: 'POST', token: playerToken });
  let me = (await api('/picks/me', { token: playerToken })).data;
  check('M89 forced to France (backed France, not Paraguay)', JSON.stringify(me.board.options.M89) === '["France"]', JSON.stringify(me.board.options.M89));
  check('M92 is a real 2-way choice (Mexico/England)', JSON.stringify(me.board.options.M92) === '["Mexico","England"]');
  check('M90 auto-includes Canada (missing R32 game)', me.board.options.M90.includes('Canada'));
  check('M96 pending with no option yet (M87 undecided)', me.board.pending.M96 === true && me.board.options.M96.length === 0);

  console.log('\n2. Validation');
  const badTeam = buildBracket(me.board.options);
  badTeam.M89 = 'Paraguay'; // real survivor he did NOT back
  check('pick of an un-backed team rejected', (await api('/picks', { method: 'POST', token: playerToken, body: { picks: badTeam } })).status === 400);
  const withPending = buildBracket(me.board.options); withPending.M96 = 'Colombia';
  check('pick for a pending/dead slot rejected', (await api('/picks', { method: 'POST', token: playerToken, body: { picks: withPending } })).status === 400);

  console.log('\n3. Valid submit before M87 (M96 omitted)');
  const pre = buildBracket(me.board.options, { M92: 'Mexico', M93: 'Spain', M94: 'USA', M95: 'Argentina' });
  check('valid bracket (dead M96 skipped) accepted', (await api('/picks', { method: 'POST', token: playerToken, body: { picks: pre } })).status === 200, JSON.stringify(pre));

  console.log('\n4. Admin resolves M87 → Colombia, M96 opens up');
  check('non-admin cannot set R32', (await api('/admin/r32/M87', { method: 'PUT', token: playerToken, body: { winner: 'Colombia' } })).status === 403);
  await api('/admin/r32/M87', { method: 'PUT', token: adminToken, body: { winner: 'Colombia' } });
  me = (await api('/picks/me', { token: playerToken })).data;
  check('M96 now offers Colombia, not pending', JSON.stringify(me.board.options.M96) === '["Colombia"]' && me.board.pending.M96 === false, JSON.stringify(me.board.options.M96));

  console.log('\n5. Full submit + scoring');
  const full = buildBracket(me.board.options, { M92: 'Mexico', M93: 'Spain', M94: 'USA', M95: 'Argentina' });
  check('full bracket (incl. M96 Colombia) accepted', (await api('/picks', { method: 'POST', token: playerToken, body: { picks: full } })).status === 200);
  await api('/admin/results/M89', { method: 'PUT', token: adminToken, body: { winner: 'France' } });  // he picked France +6
  await api('/admin/results/M92', { method: 'PUT', token: adminToken, body: { winner: 'Mexico' } });  // +6
  await api('/admin/results/QF1', { method: 'PUT', token: adminToken, body: { winner: full.QF1 } });  // his QF1 pick +10
  await api('/admin/results/F1', { method: 'PUT', token: adminToken, body: { winner: full.F1 } });     // his champion +30
  const st = (await api('/standings')).data.find((s) => s.playerId === PLAYER);
  check('pick points = 6+6+10+30 = 52', st.pickPoints === 52, `got ${st.pickPoints}`);

  console.log('\n6. Wrong result scores nobody');
  await api('/admin/results/M90', { method: 'PUT', token: adminToken, body: { winner: 'Morocco' } }); // he was forced Canada
  const st2 = (await api('/standings')).data.find((s) => s.playerId === PLAYER);
  check('no points for a losing forced pick', st2.pickPoints === 52);

  console.log('\n7. Lock enforcement');
  const orig = (await cfg.get()).data();
  await cfg.set({ ...orig, lockAt: '2020-01-01T00:00:00-07:00' });
  check('submit after lock rejected (423)', (await api('/picks', { method: 'POST', token: playerToken, body: { picks: full } })).status === 423);
  await cfg.set(orig);

  // cleanup: remove test picks/results and the M87 we set (keep launch state pristine)
  await admin.firestore().collection('picks').doc(PLAYER).delete().catch(() => {});
  const rs = await admin.firestore().collection('results').get();
  const b = admin.firestore().batch(); rs.docs.forEach((d) => b.delete(d.ref)); if (rs.size) await b.commit();
  await cfg.update({ 'realR32.M87': admin.firestore.FieldValue.delete() });
  console.log('  (cleaned up test picks/results + M87)');

  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch((err) => { console.error('E2E crashed:', err); process.exit(1); });
