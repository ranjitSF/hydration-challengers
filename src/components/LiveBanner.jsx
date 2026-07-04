import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLive } from '../services';
import { getFlag } from '../lib/teams';
import { useAuth } from '../contexts/AuthContext';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };

const StakeLine = ({ you }) => {
  if (!you) return null;
  if (you.status === 'out') return <span className="text-gray-400">Your bracket line is already out of this one.</span>;
  if (!you.need) return null;
  const tone = { ahead: 'text-wc-accent', behind: 'text-red-400', level: 'text-yellow-300' }[you.status];
  const word = { ahead: 'winning', behind: 'trailing', level: 'level' }[you.status];
  return (
    <span className={tone}>
      You need {getFlag(you.need)} <span className="font-semibold">{you.need}</span> — {word} · <span className="font-semibold">+{you.points}</span> if it holds
    </span>
  );
};

const LiveCard = ({ g }) => (
  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
    className="card p-3 border-red-500/40 bg-red-500/[0.06]">
    <div className="flex items-center justify-between text-xs mb-1.5">
      <span className="flex items-center gap-1.5 font-semibold text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE · {ROUND_LABEL[g.round] || g.round}
      </span>
      <span className="text-gray-400">{g.detail}</span>
    </div>
    <div className="flex items-center justify-center gap-3 text-base sm:text-lg font-bold">
      <span className="flex items-center gap-1.5 min-w-0"><span>{getFlag(g.teamA)}</span><span className="truncate">{g.teamA}</span></span>
      <span className="accent-text tabular-nums shrink-0">{g.scoreA} – {g.scoreB}</span>
      <span className="flex items-center gap-1.5 min-w-0 justify-end"><span className="truncate">{g.teamB}</span><span>{getFlag(g.teamB)}</span></span>
    </div>
    {g.you && <div className="text-center text-xs sm:text-sm mt-1.5"><StakeLine you={g.you} /></div>}
  </motion.div>
);

// Top-of-page box for in-progress games. Polls every 40s and renders nothing when
// nothing is live. Signed-in visitors also see what they need from each match.
const LiveBanner = () => {
  const { authToken } = useAuth();
  const [games, setGames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getLive(authToken);
        if (!cancelled) setGames(data.games || []);
      } catch {
        /* transient — keep the last state */
      }
    };
    load();
    const id = setInterval(load, 40000);
    return () => { cancelled = true; clearInterval(id); };
  }, [authToken]);

  return (
    <AnimatePresence>
      {games.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
          {games.map((g) => <LiveCard key={g.slot} g={g} />)}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveBanner;
