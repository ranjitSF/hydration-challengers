// Upsert the real roster from the git-ignored roster.local.json and remove the
// placeholder test players. Preserves any starting_points already set.
// Run: node scripts/seed-roster.mjs
import fs from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

import { initializeFirebase, admin } from '../server/config/firebase.js';
initializeFirebase();

const roster = JSON.parse(fs.readFileSync(new URL('../roster.local.json', import.meta.url)));
const db = admin.firestore();

// Remove placeholder test players.
for (const email of ['test1@example.com', 'test2@example.com', 'test3@example.com']) {
  await db.collection('players').doc(email).delete().catch(() => {});
}

let created = 0;
let updated = 0;
for (const { email, display_name } of roster) {
  const id = email.toLowerCase();
  const ref = db.collection('players').doc(id);
  const doc = await ref.get();
  if (doc.exists) {
    await ref.set({ email: id, display_name }, { merge: true }); // keep starting_points
    updated += 1;
  } else {
    await ref.set({ email: id, display_name, starting_points: 0 });
    created += 1;
  }
}

console.log(`✓ Roster seeded: ${created} created, ${updated} updated, ${roster.length} total`);
process.exit(0);
