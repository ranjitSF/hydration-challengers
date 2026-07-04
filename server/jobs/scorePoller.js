import { db } from '../database/firestore.js';
import { getAppConfig, resolveM87 } from '../lib/config.js';
import { fetchEspnEvents, findEspnEvent, espnWinnerName, espnTotalGoals, espnDateOf } from '../lib/espn.js';

// The last Round-of-32 game (Colombia/Ghana). Its result opens M96 and updates the
// R32 carry-in. Stop auto-polling it after this deadline (then manual entry).
const R32_WATCH = { game: 'M87', teamA: 'Colombia', teamB: 'Ghana', dates: ['20260703', '20260704'] };
const M87_DEADLINE = Date.parse('2026-07-05T00:00:00Z');

const toEspn = (name, map) => map[name] || name;
const buildReverse = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

// Matches that still need a result (real teams, not a TBD/placeholder). No time-window
// gating is needed: because ESPN keeps finished games queryable, a delayed or
// rescheduled kickoff still resolves — we just keep asking its date until it's final.
async function unresolvedMatches() {
  const [matchesSnap, resultsSnap] = await Promise.all([
    db().collection('matches').get(),
    db().collection('results').get(),
  ]);
  const resolved = new Set(resultsSnap.docs.map((d) => d.id));
  return matchesSnap.docs
    .map((d) => d.data())
    .filter(
      (m) =>
        !resolved.has(m.slot) &&
        m.kickoff_at &&
        m.team_a && m.team_a !== 'TBD' && !/winner/i.test(m.team_a) &&
        m.team_b && m.team_b !== 'TBD' && !/winner/i.test(m.team_b)
    );
}

async function writeAutoResult(slot, winner) {
  const ref = db().collection('results').doc(slot);
  const existing = await ref.get();
  if (existing.exists && existing.data().source === 'manual') return; // manual always wins
  await ref.set({ winner, source: 'auto', updatedAt: new Date().toISOString() });
}

// One poll: look up ESPN only for the dates of matches that still need a result
// (zero network calls when everything's resolved). Resolves finished R16→Final
// matches and the pending R32 game from the authoritative `winner` flag.
export async function pollOnce() {
  const [pending, config] = await Promise.all([unresolvedMatches(), getAppConfig()]);
  const realR32 = config.realR32 || {};
  const map = config.teamNameMap || {};
  const reverse = buildReverse(map);
  const needM87 = !realR32[R32_WATCH.game] && Date.now() < M87_DEADLINE;

  if (pending.length === 0 && !needM87) return { checked: 0, updated: 0 };

  const dates = new Set(pending.map((m) => espnDateOf(m.kickoff_at)));
  if (needM87) R32_WATCH.dates.forEach((d) => dates.add(d));

  const events = await fetchEspnEvents([...dates]);
  const out = { checked: pending.length, updated: 0 };

  for (const match of pending) {
    const event = findEspnEvent(events, toEspn(match.team_a, map), toEspn(match.team_b, map));
    const espnWinner = espnWinnerName(event);
    if (!espnWinner) continue;
    const winner = reverse[espnWinner] || espnWinner;
    await writeAutoResult(match.slot, winner);
    out.updated += 1;
    console.log(`✓ Auto-recorded ${match.slot}: ${winner}`);

    // Capture the Final's total goals for the tiebreaker.
    if (match.slot === 'F1') {
      const goals = espnTotalGoals(event);
      if (goals !== null) {
        await db().collection('config').doc('app').set({ finalTotalGoals: goals }, { merge: true });
        console.log(`✓ Final total goals: ${goals}`);
      }
    }
  }

  if (needM87) {
    const event = findEspnEvent(events, toEspn(R32_WATCH.teamA, map), toEspn(R32_WATCH.teamB, map));
    const espnWinner = espnWinnerName(event);
    if (espnWinner) {
      const winner = reverse[espnWinner] || espnWinner;
      await resolveM87(winner);
      out.r32 = winner;
      console.log(`✓ Auto-resolved R32 ${R32_WATCH.game}: ${winner}`);
    } else {
      out.r32 = event ? `live (${event.status?.type?.detail})` : 'not final';
    }
  }

  return out;
}
