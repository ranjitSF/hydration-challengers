// Reset Firestore to a clean pre-launch state: wipe all picks + results, then
// re-seed matches/config/players. Run after the E2E test, before going live.
// Run: node scripts/reset.mjs
import dotenv from 'dotenv';
dotenv.config();

import { initializeFirebase, admin } from '../server/config/firebase.js';
initializeFirebase();

async function clearCollection(name) {
  const snap = await admin.firestore().collection(name).get();
  const batch = admin.firestore().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.size) await batch.commit();
  console.log(`✓ cleared ${snap.size} docs from ${name}`);
}

await clearCollection('picks');
await clearCollection('results');
console.log('Now run: npm run db:seed   (re-seeds matches/config/players)');
process.exit(0);
