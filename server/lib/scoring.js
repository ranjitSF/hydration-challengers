// Points awarded per correct pick, by round.
export const POINTS_BY_ROUND = {
  R16: 6,
  QF: 10,
  SF: 16,
  F: 30,
};

// matches: [{ id, round, slot }]
// results: Map or object keyed by match_id -> winner team name
// picks: [{ match_id, picked_team }] for a single player
export function scorePlayerPicks(picks, matchesById, resultsByMatchId) {
  let total = 0;
  const accuracyByRound = { R16: { correct: 0, total: 0 }, QF: { correct: 0, total: 0 }, SF: { correct: 0, total: 0 }, F: { correct: 0, total: 0 } };

  for (const pick of picks) {
    const match = matchesById[pick.match_id];
    if (!match) continue;
    accuracyByRound[match.round].total += 1;

    const winner = resultsByMatchId[pick.match_id];
    if (winner && winner === pick.picked_team) {
      total += POINTS_BY_ROUND[match.round];
      accuracyByRound[match.round].correct += 1;
    }
  }

  return { total, accuracyByRound };
}

export const MAX_POSSIBLE_POINTS =
  8 * POINTS_BY_ROUND.R16 + 4 * POINTS_BY_ROUND.QF + 2 * POINTS_BY_ROUND.SF + 1 * POINTS_BY_ROUND.F;
