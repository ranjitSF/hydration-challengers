import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlayerBracket } from '../services';
import { getFlag } from '../lib/teams';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };
const ROUNDS = ['R16', 'QF', 'SF', 'F'];

const PickRow = ({ p }) => {
  const state = !p.picked ? 'skip' : !p.decided ? 'pending' : p.correct ? 'hit' : 'miss';
  const tint = { hit: 'text-wc-accent', miss: 'text-red-400', pending: 'text-gray-300', skip: 'text-gray-600' }[state];
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className={`flex items-center gap-2 ${tint}`}>
        <span>{p.picked ? getFlag(p.picked) : '—'}</span>
        <span>{p.picked || 'skipped'}</span>
      </span>
      <span className="text-xs text-gray-400 flex items-center gap-2">
        {p.decided && <span>actual: {p.winner}</span>}
        {state === 'hit' && <span className="text-wc-accent font-semibold">✓ +{p.points}</span>}
        {state === 'miss' && <span className="text-red-400">✗ 0</span>}
        {state === 'pending' && <span>· to be played</span>}
      </span>
    </div>
  );
};

const PlayerBracketModal = ({ playerId, displayName, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!playerId) return;
    getPlayerBracket(playerId).then(setData).catch((e) => setError(e.message));
  }, [playerId]);

  const byRound = (r) => (data?.bracket || []).filter((p) => p.round === r);

  return (
    <AnimatePresence>
      {playerId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            className="card p-5 max-w-lg w-full my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{data?.displayName || displayName}'s bracket</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
            </div>

            {error && <p className="text-yellow-300 text-sm">{error === 'Brackets become visible once picks lock' ? 'Brackets become visible once picks lock (Sat 9:45am PT).' : error}</p>}
            {!error && !data && <p className="text-gray-400 text-sm">Loading…</p>}
            {data && !data.submitted && <p className="text-yellow-300 text-sm">This player didn't submit a bracket.</p>}

            {data && data.submitted && (
              <>
                {ROUNDS.map((r) => (
                  <div key={r} className="space-y-1">
                    <h3 className="text-xs uppercase tracking-wide font-semibold accent-text">{ROUND_LABEL[r]}</h3>
                    <div className="bg-wc-navyDarker rounded-lg px-3 py-1">
                      {byRound(r).map((p) => <PickRow key={p.slot} p={p} />)}
                    </div>
                  </div>
                ))}
                <div className="text-sm text-gray-400 pt-1">
                  Tiebreaker — Final goals guess: <span className="text-white">{data.finalGoalsPrediction ?? '—'}</span>
                  {data.finalTotalGoals !== null && <span> · actual: <span className="text-white">{data.finalTotalGoals}</span></span>}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlayerBracketModal;
