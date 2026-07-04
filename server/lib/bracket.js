// Bracket pairing structure, verified against FIFA's official Round of 16 -> Final bracket
// (M89-M96 -> QF97-100 -> SF101-102 -> F). Do not reorder without re-checking the source.
export const BRACKET_PAIRING = {
  QF1: ['M89', 'M90'],
  QF2: ['M93', 'M94'],
  QF3: ['M91', 'M92'],
  QF4: ['M95', 'M96'],
  SF1: ['QF1', 'QF2'],
  SF2: ['QF3', 'QF4'],
  F1: ['SF1', 'SF2'],
};

export const R16_SLOTS = ['M89', 'M90', 'M91', 'M92', 'M93', 'M94', 'M95', 'M96'];
export const QF_SLOTS = ['QF1', 'QF2', 'QF3', 'QF4'];
export const SF_SLOTS = ['SF1', 'SF2'];
export const FINAL_SLOT = 'F1';
export const ALL_SLOTS = [...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, FINAL_SLOT];

export const ROUND_BY_SLOT = {
  ...Object.fromEntries(R16_SLOTS.map((s) => [s, 'R16'])),
  ...Object.fromEntries(QF_SLOTS.map((s) => [s, 'QF'])),
  ...Object.fromEntries(SF_SLOTS.map((s) => [s, 'SF'])),
  [FINAL_SLOT]: 'F',
};

// Given a map of slot -> picked team (for every match up to and including the
// previous round), derive the two teams that should appear in `slot`.
export function deriveMatchup(slot, picksBySlot) {
  const feeders = BRACKET_PAIRING[slot];
  if (!feeders) return [null, null];
  return [picksBySlot[feeders[0]] || null, picksBySlot[feeders[1]] || null];
}
