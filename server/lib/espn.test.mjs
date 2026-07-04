import test from 'node:test';
import assert from 'node:assert/strict';
import { findEspnEvent, espnWinnerName, espnDateOf } from './espn.js';

// Fixtures mirroring real ESPN scoreboard events (captured from the live API).
const ev = (state, detail, comps) => ({
  status: { type: { state, detail } },
  competitions: [{ competitors: comps.map(([name, score, winner, shootoutScore]) => ({ team: { displayName: name }, score, winner, shootoutScore })) }],
});

const finalAET = ev('post', 'AET', [['Argentina', '3', true], ['Cape Verde', '2', false]]);
const finalPens = ev('post', 'FT-Pens', [['Australia', '1', false, 2], ['Egypt', '1', true, 4]]);
const inProgress = ev('in', 'HT', [['Colombia', '1', false], ['Ghana', '0', false]]);

test('winner after extra time', () => {
  assert.equal(espnWinnerName(finalAET), 'Argentina');
});

test('winner on penalties (uses ESPN winner flag, not the 1-1 score)', () => {
  assert.equal(espnWinnerName(finalPens), 'Egypt');
});

test('no winner while a game is still in progress', () => {
  assert.equal(espnWinnerName(inProgress), null);
});

test('no winner for a missing event', () => {
  assert.equal(espnWinnerName(undefined), null);
});

test('findEspnEvent matches regardless of home/away order', () => {
  const events = [finalAET, finalPens, inProgress];
  assert.equal(findEspnEvent(events, 'Ghana', 'Colombia'), inProgress);
  assert.equal(findEspnEvent(events, 'Argentina', 'Cape Verde'), finalAET);
  assert.equal(findEspnEvent(events, 'Nowhere', 'Noteam'), undefined);
});

test('espnDateOf uses the kickoff local date (matches ESPN indexing)', () => {
  assert.equal(espnDateOf('2026-07-05T20:00:00-04:00'), '20260705');
  assert.equal(espnDateOf('2026-07-04T13:00:00-04:00'), '20260704');
});
