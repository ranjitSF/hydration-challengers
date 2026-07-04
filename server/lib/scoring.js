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

// Round-of-32 carry-in, computed live from a player's R32 form picks vs the real
// R32 results. 3 points per correct pick. Games the player didn't pick (e.g. the
// one missing from the form) award nothing. Computing this from data means it
// self-updates the moment a new R32 result (M87) lands — no manual bump.
export const R32_POINTS_PER_CORRECT = 3;

// Per-player R32 accuracy: only games the player actually had on their form count
// toward the total (the auto-granted game missing from the form is excluded), so
// the denominator reflects real predictions.
export function r32Accuracy(r32Picks = {}, realR32 = {}) {
  let correct = 0;
  let total = 0;
  for (const [game, winner] of Object.entries(realR32)) {
    if (!(game in r32Picks)) continue; // player had no pick here (e.g. the auto game)
    total += 1;
    if (r32Picks[game] === winner) correct += 1;
  }
  return { correct, total, points: correct * R32_POINTS_PER_CORRECT };
}

export function r32CarryIn(r32Picks = {}, realR32 = {}) {
  return r32Accuracy(r32Picks, realR32).points;
}
