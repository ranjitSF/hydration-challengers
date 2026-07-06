import { db } from '../database/firestore.js';
import { getAppConfig, resolveM87 } from '../lib/config.js';
import { fetchEspnEvents, findEspnEvent, espnWinnerName, espnTotalGoals, espnDateOf } from '../lib/espn.js';
import { ROUND_BY_SLOT } from '../lib/bracket.js';

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

async function writeAutoResult(slot, winner, scores = {}) {
  const ref = db().collection('results').doc(slot);
  const existing = await ref.get();
  if (existing.exists && existing.data().source === 'manual') return; // manual always wins
  await ref.set({ winner, source: 'auto', updatedAt: new Date().toISOString(), ...scores }, { merge: true });
}

// Per-team final score for a match, keyed to our team names (for the result recap).
function scoresFor(match, event, map) {
  const comps = event?.competitions?.[0]?.competitors || [];
  const scoreOf = (our) => {
    const c = comps.find((x) => x.team?.displayName === (map[our] || our));
    return c && c.score != null ? Number(c.score) : null;
  };
  return { scoreA: scoreOf(match.team_a), scoreB: scoreOf(match.team_b) };
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
    await writeAutoResult(match.slot, winner, scoresFor(match, event, map));
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

const hasRealTeams = (m) =>
  m.team_a && !/winner|tbd/i.test(m.team_a) && m.team_b && !/winner|tbd/i.test(m.team_b);
const RECAP_MS = 12 * 60 * 1000; // show a finished game's result for 12 minutes

// The single most relevant match to feature at the top of the page, one of:
//   live     — a game in progress (ESPN 'in'), with the running score
//   recent   — a game that finished within the last 12 min, with the final score
//   upcoming — the next scheduled game, with its kickoff time (for a countdown)
//   none     — nothing left
// ESPN is only queried when a game is actually in its live window (kickoff passed,
// not yet resolved); otherwise this is Firestore-only. `nextPollSeconds` tells the
// client how soon to check again so idle periods stay cheap.
export async function featuredMatch(nowMs = Date.parse(new Date().toISOString())) {
  const [matchesSnap, resultsSnap, config] = await Promise.all([
    db().collection('matches').get(),
    db().collection('results').get(),
    getAppConfig(),
  ]);
  const matches = matchesSnap.docs.map((d) => d.data());
  const results = Object.fromEntries(resultsSnap.docs.map((d) => [d.id, d.data()]));
  const map = config.teamNameMap || {};
  const reverse = buildReverse(map);
  const core = (m, extra) => ({ slot: m.slot, round: ROUND_BY_SLOT[m.slot], teamA: m.team_a, teamB: m.team_b, ...extra });

  // 1) A match whose kickoff has passed but has no result yet → ask ESPN.
  const inWindow = matches
    .filter((m) => hasRealTeams(m) && !results[m.slot] && m.kickoff_at && Date.parse(m.kickoff_at) <= nowMs)
    .sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at));
  if (inWindow.length) {
    const events = await fetchEspnEvents([...new Set(inWindow.map((m) => espnDateOf(m.kickoff_at)))]);
    for (const m of inWindow) {
      const e = findEspnEvent(events, toEspn(m.team_a, map), toEspn(m.team_b, map));
      const state = e?.status?.type?.state;
      if (state === 'in') {
        const { scoreA, scoreB } = scoresFor(m, e, map);
        return { state: 'live', nextPollSeconds: 45, match: core(m, { scoreA, scoreB, detail: e.status.type.detail || 'LIVE' }) };
      }
      if (state === 'post') {
        const { scoreA, scoreB } = scoresFor(m, e, map);
        const winner = reverse[espnWinnerName(e)] || espnWinnerName(e);
        // Self-heal: record the result the instant we observe it final, rather than
        // waiting for the next scheduled poll. Any page with the live box open triggers
        // this, so scores update within a poll cycle of the final whistle.
        if (winner) {
          await writeAutoResult(m.slot, winner, { scoreA, scoreB });
          if (m.slot === 'F1') {
            const goals = espnTotalGoals(e);
            if (goals !== null) await db().collection('config').doc('app').set({ finalTotalGoals: goals }, { merge: true });
          }
        }
        return { state: 'recent', nextPollSeconds: 60, match: core(m, { scoreA, scoreB, winner }) };
      }
    }
  }

  // 2) A result recorded within the recap window.
  const recent = Object.entries(results)
    .map(([slot, r]) => ({ slot, ...r }))
    .filter((r) => r.updatedAt && nowMs - Date.parse(r.updatedAt) < RECAP_MS)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (recent) {
    const m = matches.find((x) => x.slot === recent.slot) || { slot: recent.slot };
    return { state: 'recent', nextPollSeconds: 60, match: core(m, { scoreA: recent.scoreA ?? null, scoreB: recent.scoreB ?? null, winner: recent.winner }) };
  }

  // 3) Next scheduled game (teams may still be TBD for later rounds).
  const upcoming = matches
    .filter((m) => !results[m.slot] && m.kickoff_at && Date.parse(m.kickoff_at) > nowMs)
    .sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
  if (upcoming) {
    const mins = (Date.parse(upcoming.kickoff_at) - nowMs) / 60000;
    const nextPollSeconds = mins < 3 ? 60 : mins < 15 ? 120 : 600;
    const known = hasRealTeams(upcoming);
    return {
      state: 'upcoming', nextPollSeconds,
      match: { slot: upcoming.slot, round: ROUND_BY_SLOT[upcoming.slot], teamA: known ? upcoming.team_a : null, teamB: known ? upcoming.team_b : null, kickoff: upcoming.kickoff_at, known },
    };
  }

  return { state: 'none', nextPollSeconds: 3600, match: null };
}
