import { ALL_SLOTS, R16_SLOTS, R32_FEEDERS, BRACKET_PAIRING, ROUND_BY_SLOT } from './bracket.js';
import { POINTS_BY_ROUND, r32Accuracy, scorePlayerPicks } from './scoring.js';

// The two real teams contesting a slot. R16 slots are fed by two R32 games (real
// winners known once those play); later slots are fed by two earlier slots, whose
// winners come from `realResults` (or a hypothetical assignment during enumeration).
export function realMatchup(slot, realResults, realR32) {
  if (R16_SLOTS.includes(slot)) return R32_FEEDERS[slot].map((g) => realR32[g] || null);
  const [a, b] = BRACKET_PAIRING[slot];
  return [realResults[a] || null, realResults[b] || null];
}

// Teams knocked out in reality so far: the loser of every decided match. A player
// can still earn points on a pick only if that team is NOT in here.
export function computeEliminated(realResults, realR32) {
  const out = new Set();
  for (const slot of ALL_SLOTS) {
    const winner = realResults[slot];
    if (!winner) continue;
    const [a, b] = realMatchup(slot, realResults, realR32);
    const loser = winner === a ? b : a;
    if (loser) out.add(loser);
  }
  return out;
}

// One player's projection: current total, point ceiling, and the exact remaining
// wins needed to reach it. A future pick is "winnable" iff its match isn't decided
// yet and the team the player backed is still alive.
export function projectPlayer(player, realResults, realR32, eliminated) {
  const picks = player.picksBySlot || {};
  const r32 = r32Accuracy(player.r32Picks || {}, realR32);
  const adjustment = player.starting_points || 0;
  const { total: decidedPickPoints } = scorePlayerPicks(picks, realResults);
  const currentTotal = r32.points + adjustment + decidedPickPoints;

  const path = [];
  let remaining = 0;
  for (const slot of ALL_SLOTS) {
    if (realResults[slot]) continue; // already decided
    const pick = picks[slot];
    if (!pick || eliminated.has(pick)) continue; // no pick, or their team is out
    const round = ROUND_BY_SLOT[slot];
    remaining += POINTS_BY_ROUND[round];
    path.push({ slot, round, team: pick, points: POINTS_BY_ROUND[round] });
  }
  return { currentTotal, ceiling: currentTotal + remaining, remaining, path };
}

// Best standings rank each player can still finish in. Exhaustively enumerates
// every way the remaining real bracket can play out (<= 2^15, and shrinking as
// games finish), scores all players under each, and records each player's best
// (lowest) rank. Correctly handles shared games — a team can't both win and lose.
//
// players: [{ playerId, picksBySlot, base }] where base is the current total.
// Returns a map playerId -> best achievable rank (1 = first).
export function computeBestRanks(players, realResults, realR32) {
  const undecided = ALL_SLOTS.filter((s) => !realResults[s]); // bracket order (feeders first)
  const n = players.length;
  const bestRank = new Array(n).fill(Infinity);
  const championAtBest = new Array(n).fill(null); // Final winner in the best-rank scenario
  const firstPlace = new Array(n).fill(0); // how many scenarios put this player 1st
  let total = 0;
  const bases = players.map((p) => p.base);
  const variablePts = undecided.map((s) => POINTS_BY_ROUND[ROUND_BY_SLOT[s]]);
  const W = {}; // hypothetical winners for undecided slots

  const scoreLeaf = () => {
    total += 1;
    const champion = W.F1 ?? realResults.F1 ?? null;
    const totals = new Array(n);
    for (let p = 0; p < n; p++) {
      let t = bases[p];
      const picks = players[p].picksBySlot;
      for (let k = 0; k < undecided.length; k++) {
        if (picks[undecided[k]] === W[undecided[k]]) t += variablePts[k];
      }
      totals[p] = t;
    }
    for (let p = 0; p < n; p++) {
      let rank = 1;
      for (let q = 0; q < n; q++) if (totals[q] > totals[p]) rank++;
      if (rank === 1) firstPlace[p] += 1;
      if (rank < bestRank[p]) { bestRank[p] = rank; championAtBest[p] = champion; }
    }
  };

  const merged = { ...realResults }; // realResults + W, kept in sync for matchup lookups
  const recurse = (i) => {
    if (i === undecided.length) return scoreLeaf();
    const slot = undecided[i];
    const [a, b] = realMatchup(slot, merged, realR32);
    const options = [a, b].filter(Boolean);
    for (const w of options.length ? options : [null]) {
      W[slot] = w;
      merged[slot] = w;
      recurse(i + 1);
    }
    delete W[slot];
    delete merged[slot];
  };
  recurse(0);

  const map = {};
  players.forEach((p, i) => {
    map[p.playerId] = {
      rank: bestRank[i] === Infinity ? null : bestRank[i],
      champion: championAtBest[i],
      firstPlaceScenarios: firstPlace[i],
      totalScenarios: total,
    };
  });
  return map;
}
