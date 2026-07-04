import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayerPicks, MAX_POSSIBLE_POINTS, POINTS_BY_ROUND, r32CarryIn } from './scoring.js';

test('max possible points matches the round point table (8/4/2/1 picks)', () => {
  // Note: the brief text claims 190; that arithmetic doesn't reconcile with its own
  // table (8*6 + 4*10 + 2*16 + 30 = 150). Treat the table as authoritative.
  assert.equal(MAX_POSSIBLE_POINTS, 150);
});

test('scores only correct picks at the right round value', () => {
  const picksBySlot = {
    M89: 'France', // R16, correct, +6
    QF2: 'Paraguay', // QF, wrong
    SF1: 'Brazil', // SF, correct, +16
    F1: 'Spain', // F, no result yet
  };
  const resultsBySlot = { M89: 'France', QF2: 'France', SF1: 'Brazil' };

  const { total, accuracyByRound } = scorePlayerPicks(picksBySlot, resultsBySlot);
  assert.equal(total, POINTS_BY_ROUND.R16 + POINTS_BY_ROUND.SF);
  assert.deepEqual(accuracyByRound.R16, { correct: 1, total: 1 });
  assert.deepEqual(accuracyByRound.QF, { correct: 0, total: 1 });
  assert.deepEqual(accuracyByRound.SF, { correct: 1, total: 1 });
  assert.deepEqual(accuracyByRound.F, { correct: 0, total: 1 });
});

test('r32 carry-in is 3 per correct pick, ignoring unpicked/missing games', () => {
  const realR32 = { M73: 'Canada', M74: 'Paraguay', M75: 'Morocco', M77: 'France' };
  // Picked France (right) + Paraguay (right) + Netherlands (wrong); never picked M73.
  const picks = { M74: 'Paraguay', M75: 'Netherlands', M77: 'France' };
  assert.equal(r32CarryIn(picks, realR32), 6); // 2 correct × 3
});

test('r32 carry-in grows when a new result (M87) lands', () => {
  const picks = { M87: 'Colombia' };
  assert.equal(r32CarryIn(picks, {}), 0); // M87 not decided yet
  assert.equal(r32CarryIn(picks, { M87: 'Colombia' }), 3); // decided in their favor
  assert.equal(r32CarryIn(picks, { M87: 'Ghana' }), 0); // decided against them
});

test('a full perfect bracket scores MAX_POSSIBLE_POINTS', () => {
  const slots = ['M89', 'M90', 'M91', 'M92', 'M93', 'M94', 'M95', 'M96', 'QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F1'];
  const picksBySlot = Object.fromEntries(slots.map((s) => [s, 'Winner']));
  const resultsBySlot = Object.fromEntries(slots.map((s) => [s, 'Winner']));

  const { total } = scorePlayerPicks(picksBySlot, resultsBySlot);
  assert.equal(total, MAX_POSSIBLE_POINTS);
});
