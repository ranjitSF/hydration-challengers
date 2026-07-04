import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLive } from '../services';
import { getFlag } from '../lib/teams';
import { useAuth } from '../contexts/AuthContext';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };

const fmtCountdown = (ms) => {
  if (ms <= 0) return 'kicking off…';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const Team = ({ name, align, highlight }) => (
  <span className={`flex items-center gap-1.5 min-w-0 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
    <span className="text-lg shrink-0">{name ? getFlag(name) : '🏳️'}</span>
    <span className={`font-semibold truncate ${highlight ? 'accent-text' : ''}`}>{name || 'TBD'}</span>
  </span>
);

const Stake = ({ state, you }) => {
  if (state === 'live') {
    if (you.status === 'out') return <span className="text-gray-400">Your bracket line is out of this one.</span>;
    const tone = { ahead: 'text-wc-accent', behind: 'text-red-400', level: 'text-yellow-300' }[you.status];
    const word = { ahead: 'winning', behind: 'trailing', level: 'level' }[you.status];
    return <span className={tone}>You need {getFlag(you.need)} <b>{you.need}</b> — {word} · <b>+{you.points}</b> if it holds</span>;
  }
  if (state === 'recent') {
    if (you.result === 'out') return <span className="text-gray-400">No pick riding on this one.</span>;
    if (you.result === 'won') return <span className="text-wc-accent">✓ {getFlag(you.need)} <b>{you.need}</b> came through — you banked <b>+{you.points}</b>!</span>;
    return <span className="text-red-400">✗ {getFlag(you.need)} {you.need} fell — <b>0</b> from this one.</span>;
  }
  if (state === 'upcoming') {
    if (you.status === 'out') return <span className="text-gray-400">Your bracket line is out of this one.</span>;
    return <span className="text-gray-300">You need {getFlag(you.need)} <b>{you.need}</b> · <b>+{you.points}</b> if they win</span>;
  }
  return null;
};

// Top-of-page featured match: live score, a post-match recap for ~12 min, then the
// next game's countdown. Polls on the server's cadence hint (frugal when idle) and
// ticks the countdown locally with no network. Shows what each player needs.
const LiveBanner = () => {
  const { authToken } = useAuth();
  const [data, setData] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await getLive(authToken);
        if (cancelled) return;
        setData(d);
        timer.current = setTimeout(load, Math.max(30, d.nextPollSeconds || 120) * 1000);
      } catch {
        if (!cancelled) timer.current = setTimeout(load, 120000);
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer.current); };
  }, [authToken]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const state = data?.state;
  const m = data?.match;
  if (!m || state === 'none') return null;

  const tone = state === 'live' ? 'border-red-500/40 bg-red-500/[0.06]'
    : state === 'recent' ? 'border-wc-accent/40 bg-wc-accent/[0.06]'
    : 'border-wc-border bg-wc-navyDarker/40';
  const scoreKnown = m.scoreA != null && m.scoreB != null;
  const showScore = state === 'live' || state === 'recent';

  return (
    <AnimatePresence mode="wait">
      <motion.div key={state + m.slot} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className={`card p-3 ${tone}`}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="flex items-center gap-1.5 font-semibold">
            {state === 'live' && <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400">LIVE</span></>}
            {state === 'recent' && <span className="text-wc-accent">FULL TIME</span>}
            {state === 'upcoming' && <span className="text-gray-300">NEXT UP</span>}
            <span className="text-gray-500">· {ROUND_LABEL[m.round] || m.round}</span>
          </span>
          <span className="text-gray-400 tabular-nums">
            {state === 'live' && m.detail}
            {state === 'upcoming' && m.kickoff && fmtCountdown(Date.parse(m.kickoff) - now)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-base sm:text-lg font-bold">
          <div className="flex-1 min-w-0"><Team name={m.teamA} highlight={state === 'recent' && m.winner === m.teamA} /></div>
          <span className="shrink-0 accent-text tabular-nums px-1">{showScore ? (scoreKnown ? `${m.scoreA} – ${m.scoreB}` : 'FT') : 'vs'}</span>
          <div className="flex-1 min-w-0"><Team name={m.teamB} align="right" highlight={state === 'recent' && m.winner === m.teamB} /></div>
        </div>

        {m.you && <div className="text-center text-xs sm:text-sm mt-1.5"><Stake state={state} you={m.you} /></div>}
        {state === 'upcoming' && m.kickoff && (
          <div className="text-center text-[11px] text-gray-500 mt-1">
            Kickoff {new Date(m.kickoff).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default LiveBanner;
