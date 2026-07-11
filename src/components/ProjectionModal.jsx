import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlayerProjection } from '../services';
import BracketTree from './BracketTree';
import ScoreBreakdown from './ScoreBreakdown';
import { getFlag } from '../lib/teams';

const ordinal = (n) => {
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const FinishTab = ({ data, currentRank }) => {
  const best = data.bestRank;
  const champ = data.bestChampion;
  const wins = data.firstPlaceScenarios || 0;
  const total = data.totalScenarios || 0;
  const canImprove = best && currentRank && best < currentRank;
  const champTag = champ ? <>{getFlag(champ)} <b>{champ}</b></> : null;

  let line;
  if (best === 1 && currentRank === 1) {
    line = <span className="accent-text">Leading the pool 🏆 — and still on top in <b>{wins}</b> of {total} ways the rest can play out.</span>;
  } else if (best === 1) {
    line = <span className="accent-text">Still alive for 1st 🏆{champTag && <> — your path: {champTag} win it all</>}. <span className="text-gray-400">You finish 1st in <b>{wins}</b> of {total} remaining scenarios.</span></span>;
  } else {
    line = <span className="text-gray-300">Best possible finish: <b>{ordinal(best)}</b> of {data.playerCount}.{champTag && <> Even in your top scenario ({champTag} champion),</>} {best - 1} {best - 1 === 1 ? 'player finishes' : 'players finish'} ahead in every outcome — out of the title race.</span>;
  }

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
          <div className="text-[11px] text-gray-500">of {data.playerCount}{total ? ` · 1st in ${wins}/${total}` : ''}</div>
        </div>
      </div>
      <p className="text-sm text-center">{line}</p>

      {data.path.length === 0 ? (
        <p className="text-sm text-gray-400 text-center">No points left to win — every remaining team on this bracket is already scored or knocked out.</p>
      ) : (
        <>
          <BracketTree data={data} mode="path" />
          <p className="text-center text-[11px] text-gray-500">
            <span className="text-wc-accent">Glowing</span> = a win you still need to hit your ceiling (with the points it's worth) · dimmed = already settled or out.
          </p>
        </>
      )}
    </div>
  );
};

const BracketTab = ({ data }) => (
  <div className="space-y-3">
    <BracketTree data={data} mode="results" />
    <p className="text-center text-[11px] text-gray-500">
      <span className="text-wc-accent">✓ advanced</span> · <span className="text-red-400">✗ knocked out</span> · outline = still in · 🏆 = their champion pick
    </p>
    <ScoreBreakdown r32={data.r32} bracket={data.bracket} total={data.currentTotal} />
  </div>
);

const ProjectionModal = ({ playerId, displayName, currentRank, initialTab = 'bracket', onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initialTab);

  // Fetch on open, then refresh every 40s while open so ceiling/path/best-rank stay
  // live if a game finishes mid-view. Only the first load shows a spinner/error;
  // later polls update in place.
  useEffect(() => {
    setTab(initialTab);
    if (!playerId) { setData(null); setError(''); return; }
    let cancelled = false;
    let timer;
    const load = (initial) => {
      if (initial) { setData(null); setError(''); }
      getPlayerProjection(playerId)
        .then((d) => { if (!cancelled) setData(d); })
        .catch((e) => { if (!cancelled && initial) setError(e.message); })
        .finally(() => { if (!cancelled) timer = setTimeout(() => load(false), 40000); });
    };
    load(true);
    return () => { cancelled = true; clearTimeout(timer); };
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
          className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            className="card p-3 sm:p-5 max-w-6xl w-full my-2 sm:my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
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
