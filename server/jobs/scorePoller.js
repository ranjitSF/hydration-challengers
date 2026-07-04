import { db } from '../database/firestore.js';
import { getAppConfig } from '../lib/config.js';

const API_FOOTBALL_BASE = 'https://v3.football.api-football.com';
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

// The one Round-of-32 game still to play; its result opens M96 for everyone who
// backed the winner and updates the R32 carry-in automatically.
const R32_WATCH = { game: 'M87', teamA: 'Colombia', teamB: 'Ghana', dates: ['2026-07-03', '2026-07-04'] };

async function getTeamNameMap() {
  const { teamNameMap } = await getAppConfig();
  return teamNameMap || {};
}

async function apiFixtures(query) {
  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?${query}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football request failed: ${res.status}`);
  const data = await res.json();
  return data.response || [];
}

const fetchLiveFixtures = () => apiFixtures('live=all');
const fetchFixturesByDate = (date) => apiFixtures(`league=1&season=2026&date=${date}`);

// Find the fixture for a matchup regardless of home/away order.
function findFixture(fixtures, apiA, apiB) {
  return fixtures.find((f) => {
    const home = f.teams.home.name;
    const away = f.teams.away.name;
    return (home === apiA && away === apiB) || (home === apiB && away === apiA);
  });
}

// Decide the winner of a finished fixture, mapping the API name back to ours.
// ourA/ourB are our names; apiA/apiB the API names for the same two teams.
function decideWinner(fixture, apiA, apiB, ourA, ourB) {
  const status = fixture.fixture.status.short;
  if (!FINISHED_STATUSES.has(status)) return null;
  const { home: hg, away: ag } = fixture.goals;
  const { home: ph, away: pa } = fixture.score.penalty;
  let winnerApi = null;
  if (ph !== null && pa !== null) winnerApi = ph > pa ? fixture.teams.home.name : fixture.teams.away.name;
  else if (hg !== ag) winnerApi = hg > ag ? fixture.teams.home.name : fixture.teams.away.name;
  else return null;
  return winnerApi === apiA ? ourA : ourB;
}

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
        m.team_a && m.team_a !== 'TBD' && !/winner/i.test(m.team_a) &&
        m.team_b && m.team_b !== 'TBD' && !/winner/i.test(m.team_b) &&
        m.kickoff_at &&
        now >= new Date(m.kickoff_at).getTime() &&
        now <= new Date(m.kickoff_at).getTime() + 3 * 60 * 60 * 1000
    );
}

async function writeAutoResult(slot, winner) {
  const ref = db().collection('results').doc(slot);
  const existing = await ref.get();
  if (existing.exists && existing.data().source === 'manual') return; // manual always wins
  await ref.set({ winner, source: 'auto', updatedAt: new Date().toISOString() });
}

// Auto-resolve the Colombia/Ghana R32 game → config.realR32.M87.
export async function pollR32M87() {
  const { realR32 = {} } = await getAppConfig();
  if (realR32[R32_WATCH.game]) return { m87: 'already set' };

  const map = await getTeamNameMap();
  const apiA = map[R32_WATCH.teamA] || R32_WATCH.teamA;
  const apiB = map[R32_WATCH.teamB] || R32_WATCH.teamB;

  // Live feed catches it while playing; dated queries catch it once it's finished.
  let fixture = findFixture(await fetchLiveFixtures(), apiA, apiB);
  for (const date of R32_WATCH.dates) {
    if (fixture) break;
    fixture = findFixture(await fetchFixturesByDate(date), apiA, apiB);
  }
  if (!fixture) return { m87: 'fixture not found' };

  const winner = decideWinner(fixture, apiA, apiB, R32_WATCH.teamA, R32_WATCH.teamB);
  if (!winner) return { m87: 'not finished' };

  await db().collection('config').doc('app').set({ realR32: { ...realR32, [R32_WATCH.game]: winner } }, { merge: true });
  console.log(`✓ Auto-resolved R32 ${R32_WATCH.game}: ${winner}`);
  return { m87: winner };
}

// One poll: resolve any finished R16→Final matches AND the pending R32 game.
export async function pollOnce() {
  if (!process.env.API_FOOTBALL_KEY) return { skipped: 'API_FOOTBALL_KEY not set' };

  const out = { checked: 0, updated: 0 };
  const map = await getTeamNameMap();

  const pending = await matchesInWindow();
  if (pending.length > 0) {
    const fixtures = await fetchLiveFixtures();
    out.checked = pending.length;
    for (const match of pending) {
      const apiA = map[match.team_a] || match.team_a;
      const apiB = map[match.team_b] || match.team_b;
      const fixture = findFixture(fixtures, apiA, apiB);
      if (!fixture) continue;
      const winner = decideWinner(fixture, apiA, apiB, match.team_a, match.team_b);
      if (!winner) continue;
      await writeAutoResult(match.slot, winner);
      out.updated += 1;
      console.log(`✓ Auto-recorded ${match.slot}: ${winner}`);
    }
  }

  try {
    out.r32 = (await pollR32M87()).m87;
  } catch (err) {
    out.r32 = `error: ${err.message}`;
  }

  return out;
}
