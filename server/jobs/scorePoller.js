import { db } from '../database/firestore.js';
import { getAppConfig } from '../lib/config.js';

const API_FOOTBALL_BASE = 'https://v3.football.api-football.com';
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

async function matchesInWindow() {
  const [matchesSnap, resultsSnap] = await Promise.all([
    db().collection('matches').get(),
    db().collection('results').get(),
  ]);
  const resultSlots = new Set(resultsSnap.docs.map((d) => d.id));
  const now = Date.now();

  return matchesSnap.docs
    .map((d) => d.data())
    .filter(
      (m) =>
        !resultSlots.has(m.slot) &&
        m.team_a && m.team_a !== 'TBD' &&
        m.team_b && m.team_b !== 'TBD' &&
        m.kickoff_at &&
        now >= new Date(m.kickoff_at).getTime() &&
        now <= new Date(m.kickoff_at).getTime() + 3 * 60 * 60 * 1000
    );
}

async function fetchLiveFixtures() {
  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?live=all`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football request failed: ${res.status}`);
  const data = await res.json();
  return data.response || [];
}

async function writeAutoResult(slot, winner) {
  const ref = db().collection('results').doc(slot);
  const existing = await ref.get();
  if (existing.exists && existing.data().source === 'manual') return; // manual always wins
  await ref.set({ winner, source: 'auto', updatedAt: new Date().toISOString() });
}

export async function pollOnce() {
  if (!process.env.API_FOOTBALL_KEY) {
    return { skipped: 'API_FOOTBALL_KEY not set' };
  }

  const pending = await matchesInWindow();
  if (pending.length === 0) return { checked: 0, updated: 0 };

  const { teamNameMap = {} } = await getAppConfig();
  const fixtures = await fetchLiveFixtures();
  let updated = 0;

  for (const match of pending) {
    const apiNameA = teamNameMap[match.team_a] || match.team_a;
    const apiNameB = teamNameMap[match.team_b] || match.team_b;

    const fixture = fixtures.find((f) => {
      const home = f.teams.home.name;
      const away = f.teams.away.name;
      return (home === apiNameA && away === apiNameB) || (home === apiNameB && away === apiNameA);
    });
    if (!fixture) continue;

    const status = fixture.fixture.status.short;
    if (!FINISHED_STATUSES.has(status)) continue;

    const { home: homeGoals, away: awayGoals } = fixture.goals;
    const { home: penHome, away: penAway } = fixture.score.penalty;

    let winnerApiName = null;
    if (penHome !== null && penAway !== null) {
      winnerApiName = penHome > penAway ? fixture.teams.home.name : fixture.teams.away.name;
    } else if (homeGoals !== awayGoals) {
      winnerApiName = homeGoals > awayGoals ? fixture.teams.home.name : fixture.teams.away.name;
    } else {
      continue; // no winner determined yet
    }

    const winner = winnerApiName === apiNameA ? match.team_a : match.team_b;
    await writeAutoResult(match.slot, winner);
    updated += 1;
    console.log(`✓ Auto-recorded result for ${match.slot}: ${winner}`);
  }

  return { checked: pending.length, updated };
}
