import React from 'react';
import { motion } from 'framer-motion';

const TeamRow = ({ team, selected, disabled, onSelect }) => (
  <button
    type="button"
    disabled={disabled || !team}
    onClick={() => onSelect(team)}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition text-left
      ${!team ? 'border-wc-border/50 text-gray-600 cursor-not-allowed' : 'border-wc-border'}
      ${selected ? 'bg-wc-accent/20 border-wc-accent text-white' : team ? 'hover:border-wc-accent/60 text-gray-200' : ''}
      ${disabled && !selected ? 'opacity-50' : ''}
    `}
  >
    <span className="font-medium">{team || 'TBD'}</span>
    {selected && <span className="text-wc-accent text-sm">✓ Picked</span>}
  </button>
);

const MatchCard = ({ label, teamA, teamB, picked, onPick, disabled, kickoff, venue }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="card p-4 space-y-3"
  >
    <div className="flex items-center justify-between text-xs text-gray-400">
      <span className="uppercase tracking-wide font-semibold text-wc-accent">{label}</span>
      {venue && <span>{venue}</span>}
    </div>
    <div className="space-y-2">
      <TeamRow team={teamA} selected={picked === teamA} disabled={disabled} onSelect={onPick} />
      <div className="text-center text-xs text-gray-500">vs</div>
      <TeamRow team={teamB} selected={picked === teamB} disabled={disabled} onSelect={onPick} />
    </div>
    {kickoff && (
      <div className="text-xs text-gray-500">
        {new Date(kickoff).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </div>
    )}
  </motion.div>
);

export default MatchCard;
