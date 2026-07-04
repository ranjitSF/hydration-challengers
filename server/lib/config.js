import { db } from '../database/firestore.js';

export async function getAppConfig() {
  const doc = await db().collection('config').doc('app').get();
  return doc.exists ? doc.data() : {};
}

// Fail-closed: if lock_at is missing or malformed, treat picks as LOCKED rather
// than silently leaving them open forever. A transient Firestore read failure
// throws (caught upstream as a 500) instead of returning a false "open".
export async function isLocked() {
  const { lockAt } = await getAppConfig();
  if (!lockAt) return true;
  const lockDate = new Date(lockAt);
  if (Number.isNaN(lockDate.getTime())) return true;
  return new Date() >= lockDate;
}

// Record the Colombia/Ghana (M87) result. Sets config.realR32.M87 (which opens M96
// on every board + updates the R32 carry-in) AND fills M96's placeholder opponent
// in `matches` so that R16 game's own result can be auto-pulled later. Used by both
// the poller and the admin control. Player picks reference the real team via the
// board, never the placeholder, so no pick migration is needed.
export async function resolveM87(winner) {
  const ref = db().collection('config').doc('app');
  const doc = await ref.get();
  const realR32 = { ...(doc.exists ? doc.data().realR32 || {} : {}) };
  realR32.M87 = winner;
  await ref.set({ realR32 }, { merge: true });

  const m96 = db().collection('matches').doc('M96');
  const m96doc = await m96.get();
  if (m96doc.exists && /winner|tbd/i.test(m96doc.data().team_b || '')) {
    await m96.update({ team_b: winner });
  }
  return realR32;
}
