import React from 'react';
import { motion } from 'framer-motion';
import { getFlag } from '../lib/teams';

const TeamRow = ({ team, pickable, selected, disabled, onSelect, note }) => (
  <button
    type="button"
    disabled={disabled || !pickable}
    onClick={() => onSelect(team)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left
      ${!pickable ? 'border-wc-border/40 text-gray-600 cursor-not-allowed' : 'border-wc-border'}
      ${selected ? 'bg-wc-accent/20 border-wc-accent text-white' : pickable ? 'hover:border-wc-accent/60 text-gray-200' : ''}
    `}
  >
    <span className="text-xl leading-none">{getFlag(team)}</span>
    <span className="font-medium flex-1">{team || 'TBD'}</span>
    {selected && <span className="text-wc-accent text-xs whitespace-nowrap">✓ Picked</span>}
    {!pickable && note && <span className="text-gray-600 text-xs whitespace-nowrap">{note}</span>}
  </button>
);

// teamA/teamB: the two teams to show. options: teams the player may actually pick.
// A team not in options is shown greyed with `unpickableNote`. status: 'choice' |
// 'forced' | 'dead' | 'pending' drives the header badge.
const MatchCard = ({ label, teamA, teamB, options = [], picked, onPick, disabled, status, unpickableNote, kickoff, venue }) => {
  const badge = {
    forced: { text: 'Auto — you backed them', cls: 'bg-wc-accent/15 text-wc-accent' },
    dead: { text: 'Both knocked out — 0 pts', cls: 'bg-red-500/15 text-red-400' },
    pending: { text: 'Opponent decided tonight', cls: 'bg-yellow-500/15 text-yellow-300' },
  }[status];

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`card p-4 space-y-3 ${status === 'dead' ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between text-xs text-gray-400 gap-2">
        <span className="uppercase tracking-wide font-semibold text-wc-accent">{label}</span>
        <div className="flex items-center gap-2">
          {badge && <span className={`px-2 py-0.5 rounded ${badge.cls}`}>{badge.text}</span>}
          {venue && <span className="hidden sm:inline">{venue}</span>}
        </div>
      </div>
      <div className="space-y-2">
        <TeamRow team={teamA} pickable={options.includes(teamA)} selected={picked === teamA}
          disabled={disabled} onSelect={onPick} note={unpickableNote} />
        <div className="text-center text-xs text-gray-500">vs</div>
        <TeamRow team={teamB} pickable={options.includes(teamB)} selected={picked === teamB}
          disabled={disabled} onSelect={onPick} note={unpickableNote} />
      </div>
      {kickoff && (
        <div className="text-xs text-gray-500">
          {new Date(kickoff).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
    </motion.div>
  );
};

export default MatchCard;
