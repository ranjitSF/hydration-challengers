// Deterministic standings order. Primary: total points. Tiebreak (a real bracket
// rule that also keeps ordering stable across the client's 25s poll so ranks don't
// flicker): whoever got more correct in the LATER rounds wins the tie — Champion,
// then Semifinals, then Quarterfinals, then Round of 16 — finally by name/email so
// the result is fully deterministic even for identical brackets.
export function compareStandings(a, b) {
  const acc = (p, r) => p.accuracyByRound[r].correct;
  return (
    b.totalPoints - a.totalPoints ||
    // Closest Final total-goals prediction wins (Infinity when the Final isn't
    // played yet or a player didn't predict, so it has no effect until then).
    (a.goalsDiff ?? Infinity) - (b.goalsDiff ?? Infinity) ||
    acc(b, 'F') - acc(a, 'F') ||
    acc(b, 'SF') - acc(a, 'SF') ||
    acc(b, 'QF') - acc(a, 'QF') ||
    acc(b, 'R16') - acc(a, 'R16') ||
    a.displayName.localeCompare(b.displayName) ||
    a.playerId.localeCompare(b.playerId)
  );
}

// Rewrite a team string everywhere it appears in a player's bracket (used when the
// admin resolves a placeholder like "Colombia/Ghana Winner" into the real team).
export function renameInPicks(picksBySlot, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return { picksBySlot, changed: false };
  let changed = false;
  const next = { ...picksBySlot };
  for (const [slot, team] of Object.entries(next)) {
    if (team === oldName) {
      next[slot] = newName;
      changed = true;
    }
  }
  return { picksBySlot: next, changed };
}
