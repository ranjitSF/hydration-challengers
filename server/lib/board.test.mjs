import test from 'node:test';
import assert from 'node:assert/strict';
import { computePlayerBoard } from './board.js';

// Real R32 winners (M87 = Colombia here for the resolved cases).
const REAL = {
  M73: 'Canada', M74: 'Paraguay', M75: 'Morocco', M76: 'Brazil', M77: 'France',
  M78: 'Norway', M79: 'Mexico', M80: 'England', M81: 'USA', M82: 'Belgium',
  M83: 'Portugal', M84: 'Spain', M85: 'Switzerland', M86: 'Argentina',
  M87: 'Colombia', M88: 'Egypt',
};

// Kulapulli Appan's real R32 form picks.
const APPAN = {
  M74: 'Germany', M75: 'Netherlands', M76: 'Japan', M77: 'France', M78: 'Norway',
  M79: 'Mexico', M80: 'England', M81: 'USA', M82: 'Belgium', M83: 'Portugal',
  M84: 'Spain', M85: 'Algeria', M86: 'Argentina', M87: 'Colombia', M88: 'Egypt',
};

test('forced pick when only one feeder was backed correctly (M89)', () => {
  const { options } = computePlayerBoard(APPAN, REAL);
  // M89 ← M74 (Germany, wrong) + M77 (France, right) → only France
  assert.deepEqual(options.M89, ['France']);
});

test('real 2-way choice when both feeders were backed correctly (M92)', () => {
  const { options } = computePlayerBoard(APPAN, REAL);
  // M92 ← M79 (Mexico ✓) + M80 (England ✓)
  assert.deepEqual(options.M92, ['Mexico', 'England']);
});

test('the auto game (M73 → Canada) is granted to everyone (M90)', () => {
  const { options } = computePlayerBoard(APPAN, REAL);
  // M90 ← M73 (auto Canada) + M75 (Netherlands, wrong) → just Canada
  assert.deepEqual(options.M90, ['Canada']);
});

test('dead line when both feeders were missed → 0 options', () => {
  // A player who picked Germany (M74) and Sweden (M77), both eliminated.
  const board = computePlayerBoard({ M74: 'Germany', M77: 'Sweden' }, REAL);
  assert.deepEqual(board.options.M89, []);
});

test('M87 undecided → M96 pending and Colombia not yet available', () => {
  const realNoM87 = { ...REAL };
  delete realNoM87.M87;
  const { options, pending } = computePlayerBoard(APPAN, realNoM87);
  // M96 ← M85 (Algeria, wrong) + M87 (pending) → no options yet, flagged pending
  assert.deepEqual(options.M96, []);
  assert.equal(pending.M96, true);
  // Once M87 resolves to Colombia (which Appan backed), it opens up:
  const resolved = computePlayerBoard(APPAN, REAL);
  assert.deepEqual(resolved.options.M96, ['Colombia']);
  assert.equal(resolved.pending.M96, false);
});

test('realTeams reflects the actual matchup for display', () => {
  const { realTeams } = computePlayerBoard(APPAN, REAL);
  assert.deepEqual(realTeams.M89, ['Paraguay', 'France']);
  assert.deepEqual(realTeams.M90, ['Canada', 'Morocco']);
});
