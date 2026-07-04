import { db } from '../database/firestore.js';

export async function getAppConfig() {
  const doc = await db().collection('config').doc('app').get();
  return doc.exists ? doc.data() : {};
}

export async function isLocked() {
  const { lockAt } = await getAppConfig();
  return lockAt ? new Date() >= new Date(lockAt) : false;
}
