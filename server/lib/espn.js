// Results come from ESPN's public World Cup scoreboard. Unlike a live-only feed,
// this is queryable BY DATE and finished games persist — so we look results up
// AFTER a match is over rather than having to catch it live. No API key, no cap.
export const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// Find the ESPN event for a matchup by team names (order-independent).
export function findEspnEvent(events, apiA, apiB) {
  return (events || []).find((e) => {
    const names = (e.competitions?.[0]?.competitors || []).map((c) => c.team?.displayName);
    return names.includes(apiA) && names.includes(apiB);
  });
}

// Winner's ESPN name if the game is FINAL, else null. ESPN's `winner` flag already
// accounts for extra time and penalty shootouts, so no score math is needed.
export function espnWinnerName(event) {
  if (!event || event.status?.type?.state !== 'post') return null;
  const winner = (event.competitions?.[0]?.competitors || []).find((c) => c.winner === true);
  return winner?.team?.displayName || null;
}

// ESPN indexes a game under the local (kickoff-timezone) date, which is exactly the
// date part of our stored kickoff_at ISO string. e.g. '2026-07-05T20:00:00-04:00'.
export function espnDateOf(kickoffIso) {
  return kickoffIso.slice(0, 10).replace(/-/g, '');
}

export async function fetchEspnEvents(dates, fetchImpl = fetch) {
  const events = [];
  for (const d of dates) {
    try {
      const res = await fetchImpl(`${ESPN_SCOREBOARD}?dates=${d}`);
      if (!res.ok) continue;
      const data = await res.json();
      events.push(...(data.events || []));
    } catch {
      /* skip a failed date, others still resolve */
    }
  }
  return events;
}
