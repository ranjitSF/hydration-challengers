import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEliminated, projectPlayer, computeBestRanks } from './projection.js';
import { ALL_SLOTS } from './bracket.js';

// Real R32 winners → defines every R16 matchup.
const realR32 = {
  M73: 'CAN', M74: 'A', M75: 'B', M76: 'C', M77: 'D', M78: 'E', M79: 'F', M80: 'G',
  M81: 'H', M82: 'I', M83: 'J', M84: 'K', M85: 'L', M86: 'M', M87: 'N', M88: 'O',
};
// R16: M89[A,D] M90[CAN,B] M91[C,E] M92[F,G] M93[J,K] M94[H,I] M95[M,O] M96[L,N]

// A player whose bracket rides team A to the title.
const P1 = {
  playerId: 'p1',
  r32Picks: {}, // 0 carry-in, to isolate R16+ math
  picksBySlot: {
    M89: 'A', M90: 'CAN', M91: 'C', M92: 'F', M93: 'J', M94: 'H', M95: 'M', M96: 'L',
    QF1: 'A', QF2: 'J', QF3: 'C', QF4: 'M', SF1: 'A', SF2: 'C', F1: 'A',
  },
};

test('eliminated set = losers of decided matches', () => {
  const results = { M89: 'A', M90: 'CAN' }; // A beat D, CAN beat B
  const elim = computeEliminated(results, realR32);
  assert.deepEqual([...elim].sort(), ['B', 'D']);
});

test('ceiling with a clean path = full 150 (0 carry-in)', () => {
  const results = { M89: 'A', M90: 'CAN' };
  const elim = computeEliminated(results, realR32);
  const proj = projectPlayer(P1, results, realR32, elim);
  assert.equal(proj.currentTotal, 12); // two correct R16 = 12
  assert.equal(proj.ceiling, 150); // nothing on A's path is out
  assert.equal(proj.path.length, 13); // 6 R16 + 4 QF + 2 SF + 1 F still to win
});

test('a knocked-out pick removes that slot AND its downstream from the ceiling', () => {
  const results = { M89: 'A', M90: 'CAN', M91: 'E' }; // C loses in R16
  const elim = computeEliminated(results, realR32);
  assert.ok(elim.has('C'));
  const proj = projectPlayer(P1, results, realR32, elim);
  // Lost: M91 (6) + QF3 pick C (10) + SF2 pick C (16) = 32. But F1 pick is A (alive).
  assert.equal(proj.ceiling, 150 - 32);
  assert.ok(!proj.path.some((s) => s.slot === 'QF3' || s.slot === 'SF2' || s.slot === 'M91'));
  assert.ok(proj.path.some((s) => s.slot === 'F1')); // champion A still alive
});

test('best rank: both finalists-backers can still finish 1st', () => {
  // Everything decided except the Final; SF1→X, SF2→Y so the Final is X vs Y.
  const results = {};
  for (const s of ALL_SLOTS) if (s !== 'F1') results[s] = 'z';
  results.SF1 = 'X';
  results.SF2 = 'Y';
  const players = [
    { playerId: 'a', base: 100, picksBySlot: { F1: 'X' } },
    { playerId: 'b', base: 100, picksBySlot: { F1: 'Y' } },
  ];
  const best = computeBestRanks(players, results, realR32);
  assert.equal(best.a, 1); // if X wins the Final
  assert.equal(best.b, 1); // if Y wins the Final
});

test('best rank: a trailing player who cannot catch up tops out at 2nd', () => {
  const results = {};
  for (const s of ALL_SLOTS) if (s !== 'F1') results[s] = 'z';
  results.SF1 = 'X';
  results.SF2 = 'Y';
  const players = [
    { playerId: 'a', base: 100, picksBySlot: { F1: 'X' } }, // ceiling 130
    { playerId: 'b', base: 200, picksBySlot: { F1: 'Y' } }, // already ahead, ceiling 230
  ];
  const best = computeBestRanks(players, results, realR32);
  assert.equal(best.a, 2); // 100+30 = 130 < 200, never first
  assert.equal(best.b, 1);
});
