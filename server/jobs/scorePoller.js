import cron from 'node-cron';
import pool from '../database/db.js';
import { getConfigValue } from '../lib/config.js';

const API_FOOTBALL_BASE = 'https://v3.football.api-football.com';
const POLL_INTERVAL_CRON = '*/20 * * * * *'; // every 20s, but only acts within match windows

async function matchesInWindow() {
  const result = await pool.query(
    `SELECT m.id, m.slot, m.team_a, m.team_b, m.kickoff_at
     FROM matches m
     LEFT JOIN results r ON r.match_id = m.id
     WHERE r.match_id IS NULL
       AND m.team_a IS NOT NULL AND m.team_a != 'TBD'
       AND m.team_b IS NOT NULL AND m.team_b != 'TBD'
       AND m.kickoff_at IS NOT NULL
       AND now() BETWEEN m.kickoff_at AND m.kickoff_at + INTERVAL '3 hours'`
  );
  return result.rows;
}

async function getTeamNameMap() {
  const raw = await getConfigValue('team_name_map');
  return raw ? JSON.parse(raw) : {};
}

async function fetchLiveFixtures() {
  const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?live=all`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API-Football request failed: ${res.status}`);
  const data = await res.json();
  return data.response || [];
}

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

async function writeAutoResult(matchId, winner) {
  await pool.query(
    `INSERT INTO results (match_id, winner, source, updated_at)
     VALUES ($1, $2, 'auto', now())
     ON CONFLICT (match_id) DO UPDATE SET
       winner = EXCLUDED.winner, updated_at = now()
     WHERE results.source = 'auto'`,
    [matchId, winner]
  );
}

export async function pollOnce() {
  const pending = await matchesInWindow();
  if (pending.length === 0) return;

  const teamNameMap = await getTeamNameMap();
  const fixtures = await fetchLiveFixtures();

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

    const homeGoals = fixture.goals.home;
    const awayGoals = fixture.goals.away;
    const penHome = fixture.score.penalty.home;
    const penAway = fixture.score.penalty.away;

    let winnerApiName = null;
    if (penHome !== null && penAway !== null) {
      winnerApiName = penHome > penAway ? fixture.teams.home.name : fixture.teams.away.name;
    } else if (homeGoals !== awayGoals) {
      winnerApiName = homeGoals > awayGoals ? fixture.teams.home.name : fixture.teams.away.name;
    } else {
      continue; // no winner determined yet
    }

    const winner = winnerApiName === apiNameA ? match.team_a : match.team_b;
    await writeAutoResult(match.id, winner);
    console.log(`✓ Auto-recorded result for ${match.slot}: ${winner}`);
  }
}

export function initScorePoller() {
  if (!process.env.API_FOOTBALL_KEY) {
    console.log('API_FOOTBALL_KEY not set — auto score polling disabled, manual entry only');
    return;
  }
  cron.schedule(POLL_INTERVAL_CRON, () => {
    pollOnce().catch((err) => console.error('Score poller error:', err));
  });
  console.log('✓ Score poller scheduled (polls during match windows)');
}
