import pool from '../database/db.js';

export async function getConfigValue(key) {
  const result = await pool.query('SELECT value FROM config WHERE key = $1', [key]);
  return result.rows[0]?.value ?? null;
}

export async function getLockAt() {
  const value = await getConfigValue('lock_at');
  return value ? new Date(value) : null;
}

export async function isLocked() {
  const lockAt = await getLockAt();
  return lockAt ? new Date() >= lockAt : false;
}
