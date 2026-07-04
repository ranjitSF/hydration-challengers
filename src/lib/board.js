import { R16_SLOTS, ALL_SLOTS, BRACKET_PAIRING, deriveMatchup } from './bracket';

// Given the player's R16 options (from the server board) and their current picks,
// resolve the whole bracket: auto-fill forced (single-option) slots, drop picks
// that no longer have a valid option, and report the options for every slot.
// QF/SF/Final options derive from the player's own advancing picks.
export function resolveBracket(r16Options, picks) {
  const resolved = { ...picks };
  const optionsBySlot = {};

  for (const slot of ALL_SLOTS) {
    const opts = R16_SLOTS.includes(slot)
      ? r16Options[slot] || []
      : deriveMatchup(slot, resolved).filter(Boolean);
    optionsBySlot[slot] = opts;

    if (opts.length === 1) {
      resolved[slot] = opts[0]; // forced
    } else if (opts.length === 0) {
      delete resolved[slot]; // dead / pending
    } else if (resolved[slot] && !opts.includes(resolved[slot])) {
      delete resolved[slot]; // stale after an upstream change
    }
  }

  const openSlots = ALL_SLOTS.filter((s) => optionsBySlot[s].length >= 1);
  const complete = openSlots.every((s) => resolved[s]);
  return { resolved, optionsBySlot, openSlots, complete };
}

export { BRACKET_PAIRING };
