import { ALL_SLOTS, ROUND_BY_SLOT } from './bracket.js';

// Points awarded per correct pick, by round.
export const POINTS_BY_ROUND = {
  R16: 6,
  QF: 10,
  SF: 16,
  F: 30,
};

// picksBySlot: { [slot]: teamName } for a single player
// resultsBySlot: { [slot]: winnerTeamName }
export function scorePlayerPicks(picksBySlot, resultsBySlot) {
  let total = 0;
  const accuracyByRound = {
    R16: { correct: 0, total: 0 },
    QF: { correct: 0, total: 0 },
    SF: { correct: 0, total: 0 },
    F: { correct: 0, total: 0 },
  };

  for (const slot of ALL_SLOTS) {
    const round = ROUND_BY_SLOT[slot];
    const pick = picksBySlot[slot];
    if (!pick) continue;
    accuracyByRound[round].total += 1;

    const winner = resultsBySlot[slot];
    if (winner && winner === pick) {
      total += POINTS_BY_ROUND[round];
      accuracyByRound[round].correct += 1;
    }
  }

  return { total, accuracyByRound };
}

export const MAX_POSSIBLE_POINTS =
  8 * POINTS_BY_ROUND.R16 + 4 * POINTS_BY_ROUND.QF + 2 * POINTS_BY_ROUND.SF + 1 * POINTS_BY_ROUND.F;
