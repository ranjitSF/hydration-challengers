import { db } from '../database/firestore.js';
import { getAppConfig } from '../lib/config.js';

// Direct API-Football host (dashboard key uses x-apisports-key). NOTE: the Free
// plan can't query a season/date for 2026, but the un-scoped `live=all` feed DOES
// include World Cup 2026 games while they're being played — so we resolve results
// from the live feed and must poll often enough to catch full-time.
const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

// The one Round-of-32 game still to play. Its result opens M96 and updates the
// R32 carry-in. Poll for it only until this deadline, then fall back to manual.
const R32_WATCH = { game: 'M87', teamA: 'Colombia', teamB: 'Ghana' };
const M87_DEADLINE = Date.parse('2026-07-04T08:00:00Z');

async function getTeamNameMap() {
  const { teamNameMap } = await getAppConfig();
  return teamNameMap || {};
}

async function fetchLiveFixtures() {
  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?live=all`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football request failed: ${res.status}`);
  const data = await res.json();
  return data.response || [];
}

function findFixture(fixtures, apiA, apiB) {
  return fixtures.find((f) => {
    const home = f.teams.home.name;
    const away = f.teams.away.name;
    return (home === apiA && away === apiB) || (home === apiB && away === apiA);
  });
}

// Winner of a finished fixture, mapped from the API name back to ours.
function decideWinner(fixture, apiA, apiB, ourA, ourB) {
  if (!FINISHED_STATUSES.has(fixture.fixture.status.short)) return null;
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

// One poll = at most ONE API request (mindful of the 100/day free cap): fetch the
// live feed once and resolve any in-window R16→Final match AND the pending R32 game.
export async function pollOnce() {
  if (!process.env.API_FOOTBALL_KEY) return { skipped: 'API_FOOTBALL_KEY not set' };

  const [pending, { realR32 = {} }] = await Promise.all([matchesInWindow(), getAppConfig()]);
  const needM87 = !realR32[R32_WATCH.game] && Date.now() < M87_DEADLINE;
  if (pending.length === 0 && !needM87) return { checked: 0, updated: 0 };

  const map = await getTeamNameMap();
  const fixtures = await fetchLiveFixtures();
  const out = { checked: pending.length, updated: 0 };

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

  if (needM87) {
    const apiA = map[R32_WATCH.teamA] || R32_WATCH.teamA;
    const apiB = map[R32_WATCH.teamB] || R32_WATCH.teamB;
    const fixture = findFixture(fixtures, apiA, apiB);
    if (!fixture) {
      out.r32 = 'not live';
    } else {
      const winner = decideWinner(fixture, apiA, apiB, R32_WATCH.teamA, R32_WATCH.teamB);
      if (winner) {
        await db().collection('config').doc('app').set({ realR32: { ...realR32, [R32_WATCH.game]: winner } }, { merge: true });
        out.r32 = winner;
        console.log(`✓ Auto-resolved R32 ${R32_WATCH.game}: ${winner}`);
      } else {
        out.r32 = `live (${fixture.fixture.status.short})`;
      }
    }
  }

  return out;
}
