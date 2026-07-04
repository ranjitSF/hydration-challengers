import { R16_SLOTS, R32_FEEDERS, AUTO_R32_GAME } from './bracket.js';

// Build a single player's R16 board from their Round-of-32 picks and the real R32
// results. For each R16 slot the player may advance ONLY a team they correctly
// backed in the R32 (a real survivor). The one game missing from the form
// (AUTO_R32_GAME → Canada) is granted to everyone.
//
// Returns per R16 slot:
//   options[slot]   — 0/1/2 teams the player may pick (survivors they backed)
//   realTeams[slot] — the two actual R16 teams, for display (null = not decided yet)
//   pending[slot]   — true while a feeder's R32 result isn't in yet (e.g. M87)
export function computePlayerBoard(r32Picks = {}, realR32 = {}) {
  const options = {};
  const realTeams = {};
  const pending = {};

  for (const slot of R16_SLOTS) {
    const feeders = R32_FEEDERS[slot];

    realTeams[slot] = feeders.map((g) => realR32[g] || null);

    options[slot] = feeders
      .map((g) => {
        if (g === AUTO_R32_GAME) return realR32[g] || null; // everyone gets it
        const winner = realR32[g];
        if (!winner) return null; // R32 game not decided yet
        return r32Picks[g] === winner ? winner : null; // only if they backed the survivor
      })
      .filter(Boolean);

    pending[slot] = feeders.some((g) => g !== AUTO_R32_GAME && !realR32[g]);
  }

  return { options, realTeams, pending };
}
