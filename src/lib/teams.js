// Flag emoji for every team that can appear in this bracket (R16 field + the
// two Round-of-32 qualifiers that resolve last). Name is always shown next to
// the flag, so if a device can't render a given emoji the team is still clear.
export const TEAM_FLAGS = {
  Argentina: '🇦🇷',
  'Cape Verde': '🇨🇻',
  Egypt: '🇪🇬',
  Switzerland: '🇨🇭',
  Colombia: '🇨🇴',
  Ghana: '🇬🇭',
  Paraguay: '🇵🇾',
  France: '🇫🇷',
  Canada: '🇨🇦',
  Morocco: '🇲🇦',
  Brazil: '🇧🇷',
  Norway: '🇳🇴',
  Mexico: '🇲🇽',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Portugal: '🇵🇹',
  USA: '🇺🇸',
  Belgium: '🇧🇪',
};

// A slot whose real team isn't known yet (e.g. "Colombia/Ghana Winner").
export const isPlaceholderTeam = (team) => !!team && /winner/i.test(team);

export const getFlag = (team) => {
  if (!team) return '';
  if (isPlaceholderTeam(team)) return '🏳️';
  return TEAM_FLAGS[team] || '⚽';
};
