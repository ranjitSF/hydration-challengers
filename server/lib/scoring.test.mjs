import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayerPicks, MAX_POSSIBLE_POINTS, POINTS_BY_ROUND } from './scoring.js';

test('max possible points matches the round point table (8/4/2/1 picks)', () => {
  // Note: the brief text claims 190; that arithmetic doesn't reconcile with its own
  // table (8*6 + 4*10 + 2*16 + 30 = 150). Treat the table as authoritative.
  assert.equal(MAX_POSSIBLE_POINTS, 150);
});

test('scores only correct picks at the right round value', () => {
  const matchesById = {
    1: { id: 1, round: 'R16', slot: 'M89' },
    2: { id: 2, round: 'QF', slot: 'QF1' },
    3: { id: 3, round: 'SF', slot: 'SF1' },
    4: { id: 4, round: 'F', slot: 'F1' },
  };
  const resultsByMatchId = { 1: 'France', 2: 'France', 3: 'Brazil' }; // match 4 unresolved
  const picks = [
    { match_id: 1, picked_team: 'France' }, // correct, +6
    { match_id: 2, picked_team: 'Paraguay' }, // wrong
    { match_id: 3, picked_team: 'Brazil' }, // correct, +16
    { match_id: 4, picked_team: 'Spain' }, // no result yet
  ];

  const { total, accuracyByRound } = scorePlayerPicks(picks, matchesById, resultsByMatchId);
  assert.equal(total, POINTS_BY_ROUND.R16 + POINTS_BY_ROUND.SF);
  assert.deepEqual(accuracyByRound.R16, { correct: 1, total: 1 });
  assert.deepEqual(accuracyByRound.QF, { correct: 0, total: 1 });
  assert.deepEqual(accuracyByRound.SF, { correct: 1, total: 1 });
  assert.deepEqual(accuracyByRound.F, { correct: 0, total: 1 });
});

test('a full perfect bracket scores MAX_POSSIBLE_POINTS', () => {
  const matchesById = {};
  const resultsByMatchId = {};
  const picks = [];
  let id = 1;
  const rounds = [['R16', 8], ['QF', 4], ['SF', 2], ['F', 1]];
  for (const [round, count] of rounds) {
    for (let i = 0; i < count; i++) {
      matchesById[id] = { id, round, slot: `${round}${i}` };
      resultsByMatchId[id] = 'Winner';
      picks.push({ match_id: id, picked_team: 'Winner' });
      id++;
    }
  }
  const { total } = scorePlayerPicks(picks, matchesById, resultsByMatchId);
  assert.equal(total, MAX_POSSIBLE_POINTS);
});
