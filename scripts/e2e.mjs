// End-to-end test of the continuation bracket + two-phase (draft → gated submit)
// flow against a LOCAL server + REAL Firestore. Mints real Firebase tokens.
// Cleans up after itself. Run: node scripts/e2e.mjs  (server on :3001)
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

import { initializeFirebase, admin } from '../server/config/firebase.js';
import { BRACKET_PAIRING, R16_SLOTS, ALL_SLOTS } from '../server/lib/bracket.js';
initializeFirebase();

const API = 'http://localhost:3001/api';
const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const PLAYER = 'appunni.nair@gmail.com';

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
const draft = (picks, token) => api('/picks', { method: 'POST', token, body: { picks, submit: false } });
const submit = (picks, token) => api('/picks', { method: 'POST', token, body: { picks, submit: true } });
const standingsFor = async (email) => (await api('/standings')).data.find((s) => s.playerId === email);

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
const CHOICES = { M92: 'Mexico', M93: 'Spain', M94: 'USA', M95: 'Argentina' };

async function run() {
  const playerToken = await idTokenFor(PLAYER);
  const adminToken = await idTokenFor(ADMIN_EMAIL);
  const cfg = admin.firestore().collection('config').doc('app');

  console.log('\n1. Board shape (M87 pending)');
  let me = (await api('/picks/me', { token: playerToken })).data;
  await api('/players/sync', { method: 'POST', token: playerToken });
  me = (await api('/picks/me', { token: playerToken })).data;
  check('M89 forced to France', JSON.stringify(me.board.options.M89) === '["France"]');
  check('M92 a real 2-way choice', JSON.stringify(me.board.options.M92) === '["Mexico","England"]');
  check('M96 pending (no option yet)', me.board.pending.M96 === true && me.board.options.M96.length === 0);
  check('config exposes m87Resolved=false', (await api('/config')).data.m87Resolved === false);

  console.log('\n2. Draft phase (before Colombia–Ghana)');
  const badTeam = { ...buildBracket(me.board.options, CHOICES), M89: 'Paraguay' };
  check('draft with un-backed team rejected', (await draft(badTeam, playerToken)).status === 400);
  const pre = buildBracket(me.board.options, CHOICES); // M96 line absent (pending)
  check('valid partial draft saved', (await draft(pre, playerToken)).status === 200);
  check('draft does NOT count as submitted', (await standingsFor(PLAYER)).hasSubmitted === false);
  check('SUBMIT blocked before M87 (425)', (await submit(pre, playerToken)).status === 425);

  console.log('\n3. Admin resolves M87 → Colombia');
  check('non-admin cannot set R32', (await api('/admin/r32/M87', { method: 'PUT', token: playerToken, body: { winner: 'Colombia' } })).status === 403);
  await api('/admin/r32/M87', { method: 'PUT', token: adminToken, body: { winner: 'Colombia' } });
  me = (await api('/picks/me', { token: playerToken })).data;
  check('M96 opens to Colombia', JSON.stringify(me.board.options.M96) === '["Colombia"]');
  check('config now m87Resolved=true', (await api('/config')).data.m87Resolved === true);
  check('draft picks survived the resolve', me.picksBySlot.M89 === 'France');

  console.log('\n4. Submit + scoring (only submitted counts)');
  const full = buildBracket(me.board.options, CHOICES);
  check('draft full bracket still not counted', (await draft(full, playerToken)).status === 200 && (await standingsFor(PLAYER)).hasSubmitted === false);
  await api('/admin/results/M89', { method: 'PUT', token: adminToken, body: { winner: 'France' } });
  await api('/admin/results/M92', { method: 'PUT', token: adminToken, body: { winner: 'Mexico' } });
  await api('/admin/results/QF1', { method: 'PUT', token: adminToken, body: { winner: full.QF1 } });
  await api('/admin/results/F1', { method: 'PUT', token: adminToken, body: { winner: full.F1 } });
  check('a drafted (unsubmitted) bracket scores 0', (await standingsFor(PLAYER)).pickPoints === 0);
  check('SUBMIT now accepted', (await submit(full, playerToken)).status === 200);
  const st = await standingsFor(PLAYER);
  check('submitted bracket scores 6+6+10+30 = 52', st.pickPoints === 52, `got ${st.pickPoints}`);
  check('now marked submitted', st.hasSubmitted === true);

  console.log('\n5. Incomplete submit rejected');
  const missing = { ...full }; delete missing.M92;
  check('submit with a missing open match rejected', (await submit(missing, playerToken)).status === 400);

  console.log('\n6. Lock enforcement (draft AND submit)');
  const orig = (await cfg.get()).data();
  await cfg.set({ ...orig, lockAt: '2020-01-01T00:00:00-07:00' });
  check('draft after lock rejected (423)', (await draft(full, playerToken)).status === 423);
  check('submit after lock rejected (423)', (await submit(full, playerToken)).status === 423);
  await cfg.set(orig);

  // cleanup
  await admin.firestore().collection('picks').doc(PLAYER).delete().catch(() => {});
  const rs = await admin.firestore().collection('results').get();
  const b = admin.firestore().batch(); rs.docs.forEach((d) => b.delete(d.ref)); if (rs.size) await b.commit();
  await cfg.update({ 'realR32.M87': admin.firestore.FieldValue.delete() });
  console.log('  (cleaned up test picks/results + M87)');

  console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch((err) => { console.error('E2E crashed:', err); process.exit(1); });
