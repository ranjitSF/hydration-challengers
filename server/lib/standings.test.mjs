import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStandings, renameInPicks } from './standings.js';

const mk = (id, name, total, acc = {}) => ({
  playerId: id,
  displayName: name,
  totalPoints: total,
  accuracyByRound: {
    R16: { correct: acc.R16 ?? 0, total: 8 },
    QF: { correct: acc.QF ?? 0, total: 4 },
    SF: { correct: acc.SF ?? 0, total: 2 },
    F: { correct: acc.F ?? 0, total: 1 },
  },
});

test('higher total points ranks first', () => {
  const players = [mk('a@x', 'A', 40), mk('b@x', 'B', 90), mk('c@x', 'C', 60)];
  players.sort(compareStandings);
  assert.deepEqual(players.map((p) => p.displayName), ['B', 'C', 'A']);
});

test('ties broken by later-round correctness (Champion first)', () => {
  // Same total; player who nailed the champion outranks one who nailed more R16.
  const champ = mk('champ@x', 'Champ', 60, { F: 1, R16: 5 });
  const early = mk('early@x', 'Early', 60, { F: 0, R16: 10 });
  const [first, second] = [early, champ].sort(compareStandings);
  assert.equal(first.displayName, 'Champ');
  assert.equal(second.displayName, 'Early');
});

test('fully identical brackets sort deterministically by name then id', () => {
  const p1 = mk('z@x', 'Zoe', 30, { R16: 5 });
  const p2 = mk('a@x', 'Adam', 30, { R16: 5 });
  // Regardless of input order, Adam (alphabetical) comes first — stable across polls.
  assert.equal([p1, p2].sort(compareStandings)[0].displayName, 'Adam');
  assert.equal([p2, p1].sort(compareStandings)[0].displayName, 'Adam');
});

test('renameInPicks resolves a placeholder everywhere it was advanced', () => {
  const before = { M96: 'Colombia/Ghana Winner', QF4: 'Colombia/Ghana Winner', F1: 'Brazil' };
  const { picksBySlot, changed } = renameInPicks(before, 'Colombia/Ghana Winner', 'Ghana');
  assert.equal(changed, true);
  assert.deepEqual(picksBySlot, { M96: 'Ghana', QF4: 'Ghana', F1: 'Brazil' });
  // original object not mutated
  assert.equal(before.M96, 'Colombia/Ghana Winner');
});

test('renameInPicks is a no-op when the old name is absent', () => {
  const before = { M89: 'France' };
  const { changed } = renameInPicks(before, 'Colombia/Ghana Winner', 'Ghana');
  assert.equal(changed, false);
});
