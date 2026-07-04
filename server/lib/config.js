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
