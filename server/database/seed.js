// Seeds Firestore with the Round of 16 field, bracket skeleton, and config.
// Safe to re-run: uses set({ merge: true }) so it won't clobber picks/results.
// Usage: node server/database/seed.js
import dotenv from 'dotenv';
dotenv.config();

import { initializeFirebase } from '../config/firebase.js';
import { db } from './firestore.js';

initializeFirebase();

const MATCHES = [
  { slot: 'M89', round: 'R16', team_a: 'Paraguay', team_b: 'France', kickoff_at: '2026-07-04T17:00:00-04:00', venue: 'Philadelphia' },
  { slot: 'M90', round: 'R16', team_a: 'Canada', team_b: 'Morocco', kickoff_at: '2026-07-04T13:00:00-04:00', venue: 'Houston' },
  { slot: 'M91', round: 'R16', team_a: 'Brazil', team_b: 'Norway', kickoff_at: '2026-07-05T16:00:00-04:00', venue: 'New Jersey' },
  { slot: 'M92', round: 'R16', team_a: 'Mexico', team_b: 'England', kickoff_at: '2026-07-05T20:00:00-04:00', venue: 'Mexico City' },
  { slot: 'M93', round: 'R16', team_a: 'Spain', team_b: 'Portugal', kickoff_at: '2026-07-06T15:00:00-04:00', venue: 'Arlington' },
  { slot: 'M94', round: 'R16', team_a: 'USA', team_b: 'Belgium', kickoff_at: '2026-07-06T20:00:00-04:00', venue: 'Seattle' },
  { slot: 'M95', round: 'R16', team_a: 'TBD', team_b: 'Egypt', kickoff_at: '2026-07-07T12:00:00-04:00', venue: 'Atlanta' },
  { slot: 'M96', round: 'R16', team_a: 'Switzerland', team_b: 'TBD', kickoff_at: '2026-07-07T16:00:00-04:00', venue: 'Vancouver' },
  // QF pairing verified against FIFA's official bracket (M97-M100):
  // QF1 = W(M89) v W(M90), QF2 = W(M93) v W(M94), QF3 = W(M91) v W(M92), QF4 = W(M95) v W(M96)
  { slot: 'QF1', round: 'QF', team_a: null, team_b: null, kickoff_at: '2026-07-09T15:00:00-04:00', venue: 'Boston' },
  { slot: 'QF2', round: 'QF', team_a: null, team_b: null, kickoff_at: '2026-07-10T15:00:00-04:00', venue: 'Los Angeles' },
  { slot: 'QF3', round: 'QF', team_a: null, team_b: null, kickoff_at: '2026-07-11T15:00:00-04:00', venue: 'Miami' },
  { slot: 'QF4', round: 'QF', team_a: null, team_b: null, kickoff_at: '2026-07-11T15:00:00-04:00', venue: 'Kansas City' },
  // SF1 = W(QF1) v W(QF2), SF2 = W(QF3) v W(QF4)
  { slot: 'SF1', round: 'SF', team_a: null, team_b: null, kickoff_at: '2026-07-14T15:00:00-04:00', venue: 'Dallas' },
  { slot: 'SF2', round: 'SF', team_a: null, team_b: null, kickoff_at: '2026-07-15T15:00:00-04:00', venue: 'Atlanta' },
  { slot: 'F1', round: 'F', team_a: null, team_b: null, kickoff_at: '2026-07-19T15:00:00-04:00', venue: 'East Rutherford' },
];

// Placeholder roster - replace with the real ~12-person list before launch
const PLAYERS = [
  { email: 'test1@example.com', display_name: 'Test Player One' },
  { email: 'test2@example.com', display_name: 'Test Player Two' },
  { email: 'test3@example.com', display_name: 'Test Player Three' },
];

async function seed() {
  const firestore = db();
  const batch = firestore.batch();

  for (const match of MATCHES) {
    batch.set(firestore.collection('matches').doc(match.slot), match, { merge: true });
  }

  for (const player of PLAYERS) {
    const email = player.email.toLowerCase();
    batch.set(
      firestore.collection('players').doc(email),
      { email, display_name: player.display_name, starting_points: 0 },
      { merge: true }
    );
  }

  batch.set(
    firestore.collection('config').doc('app'),
    { lockAt: '2026-07-04T09:45:00-07:00', teamNameMap: {} },
    { merge: true }
  );

  await batch.commit();
  console.log(`✓ Seeded ${MATCHES.length} matches, ${PLAYERS.length} players, and config`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
