import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlayerProjection } from '../services';
import { getFlag } from '../lib/teams';

const ROUND_LABEL = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };
const ROUND_PTS = { R32: 3, R16: 6, QF: 10, SF: 16, F: 30 };

const ordinal = (n) => {
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// One pick, coloured by outcome.
const Chip = ({ team, status, points, actual, champion }) => {
  const styles = {
    won: 'bg-wc-accent/15 border-wc-accent/60 text-wc-accent',
    auto: 'bg-wc-accent/10 border-wc-accent/40 text-wc-accent/90',
    out: 'bg-red-500/10 border-red-500/40 text-red-400 line-through',
    dead: 'bg-red-500/5 border-red-500/20 text-red-400/70 line-through',
    alive: 'bg-wc-navyDarker border-gray-500/60 text-white',
    none: 'bg-wc-navyDarker border-gray-700 text-gray-600',
  };
  return (
    <div className={`rounded-md border px-2 py-1 text-xs whitespace-nowrap ${styles[status]} ${champion ? 'ring-2 ring-wc-accent shadow-glow' : ''}`}>
      <div className="flex items-center gap-1.5">
        <span>{team ? getFlag(team) : '—'}</span>
        <span className="font-medium">{team || 'skipped'}</span>
        {champion && <span>🏆</span>}
      </div>
      <div className="flex items-center gap-1 text-[10px] mt-0.5 opacity-80">
        {status === 'won' && <span>✓ +{points}</span>}
        {status === 'auto' && <span>auto</span>}
        {status === 'out' && actual && <span className="text-gray-400 no-underline">→ {actual}</span>}
        {status === 'dead' && <span>knocked out</span>}
        {status === 'alive' && <span>· still in</span>}
      </div>
    </div>
  );
};

const Column = ({ round, chips }) => (
  <div className="flex flex-col gap-1.5 min-w-[7.5rem]">
    <div className="text-[10px] uppercase tracking-wide font-semibold accent-text text-center">
      {ROUND_LABEL[round]}<span className="text-gray-500"> · {ROUND_PTS[round]}pt</span>
    </div>
    <div className="flex flex-col gap-1.5 justify-center h-full">{chips}</div>
  </div>
);

const BracketTab = ({ data }) => {
  const byRound = (r) => (data.bracket || []).filter((p) => p.round === r);
  const chip = (p, champion) => (
    <Chip key={p.slot || p.game} team={p.picked} status={p.status} points={p.points} actual={p.winner} champion={champion} />
  );
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-3 items-center min-w-max py-1">
        <Column round="R32" chips={(data.r32 || []).map((g) => chip(g))} />
        <Column round="R16" chips={byRound('R16').map((p) => chip(p))} />
        <Column round="QF" chips={byRound('QF').map((p) => chip(p))} />
        <Column round="SF" chips={byRound('SF').map((p) => chip(p))} />
        <Column round="F" chips={byRound('F').map((p) => chip(p, true))} />
      </div>
    </div>
  );
};

const FinishTab = ({ data, currentRank }) => {
  const best = data.bestRank;
  const canImprove = best && currentRank && best < currentRank;
  const line = best === 1
    ? (currentRank === 1 ? 'Leading — and can still finish first. 🏆' : 'Can still finish first. 🏆')
    : `Best possible finish: ${ordinal(best)} — mathematically can't place higher.`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-wc-navyDarker p-3 text-center">
          <div className="text-xs text-gray-400">Points now → ceiling</div>
          <div className="text-lg font-bold"><span className="accent-text">{data.currentTotal}</span> <span className="text-gray-500">→</span> {data.ceiling}</div>
          <div className="text-[11px] text-gray-500">+{data.remaining} still winnable</div>
        </div>
        <div className="card bg-wc-navyDarker p-3 text-center">
          <div className="text-xs text-gray-400">Rank now → best possible</div>
          <div className="text-lg font-bold">{ordinal(currentRank)} <span className="text-gray-500">→</span> <span className={canImprove ? 'accent-text' : ''}>{ordinal(best)}</span></div>
          <div className="text-[11px] text-gray-500">of {data.playerCount}</div>
        </div>
      </div>
      <p className={`text-sm text-center ${best === 1 ? 'accent-text' : 'text-gray-300'}`}>{line}</p>

      <div>
        <h3 className="text-xs uppercase tracking-wide font-semibold accent-text mb-2">Wins still needed for the ceiling</h3>
        {data.path.length === 0 ? (
          <p className="text-sm text-gray-400">No points left to win — every remaining team on this bracket is either already scored or knocked out.</p>
        ) : (
          <div className="space-y-1">
            {data.path.map((s) => (
              <div key={s.slot} className="flex items-center justify-between bg-wc-navyDarker rounded-md px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <span>{getFlag(s.team)}</span>
                  <span className="font-medium">{s.team}</span>
                  <span className="text-gray-400 text-xs">wins the {ROUND_LABEL[s.round]}</span>
                </span>
                <span className="text-wc-accent text-xs font-semibold">+{s.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectionModal = ({ playerId, displayName, currentRank, initialTab = 'bracket', onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setData(null); setError(''); setTab(initialTab);
    if (!playerId) return;
    getPlayerProjection(playerId).then(setData).catch((e) => setError(e.message));
  }, [playerId, initialTab]);

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm rounded-lg transition ${tab === id ? 'bg-wc-accent text-wc-navy font-semibold' : 'text-gray-400 hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <AnimatePresence>
      {playerId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            className="card p-5 max-w-3xl w-full my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold truncate">{data?.displayName || displayName}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-sm shrink-0">Close</button>
            </div>

            <div className="flex gap-1 bg-wc-navyDarker rounded-lg p-1 w-max">
              <TabBtn id="bracket" label="Bracket" />
              <TabBtn id="finish" label="Path to best finish" />
            </div>

            {error && <p className="text-yellow-300 text-sm">{error === 'Projections become visible once picks lock' ? 'Available once picks lock.' : error}</p>}
            {!error && !data && <p className="text-gray-400 text-sm">Loading…</p>}
            {data && !data.submitted && tab === 'bracket' && <p className="text-yellow-300 text-xs">No R16 bracket submitted — showing Round-of-32 form only.</p>}

            {data && (tab === 'bracket' ? <BracketTab data={data} /> : <FinishTab data={data} currentRank={currentRank} />)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProjectionModal;
