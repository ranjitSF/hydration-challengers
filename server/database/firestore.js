import { admin } from '../config/firebase.js';

// Lazily accessed so this only touches admin.firestore() after initializeFirebase() has run.
export function db() {
  return admin.firestore();
}
