import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getScenario } from '../services';
import { getFlag } from '../lib/teams';
import { deriveMatchup } from '../lib/bracket';
import LoadingSpinner from '../components/LoadingSpinner';

const PTS = { R16: 6, QF: 10, SF: 16, F: 30 };
const roundOf = (s) => (s.startsWith('QF') ? 'QF' : s.startsWith('SF') ? 'SF' : s === 'F1' ? 'F' : 'R16');
const ROUND_LABEL = { QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

const Scenario = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState({}); // slot -> chosen winner

  useEffect(() => {
    getScenario().then(setData).catch((e) => setError(e.message));
  }, []);

  const decided = data?.decided || {};
  const undecided = data?.undecidedSlots || [];

  // Set a pick, then clear any downstream picks that are no longer valid participants.
  const pick = (slot, team) => {
    setScenario((prev) => {
      const next = { ...prev, [slot]: team };
      let changed = true;
      while (changed) {
        changed = false;
        const merged = { ...decided, ...next };
        for (const s of undecided) {
          if (next[s] && !deriveMatchup(s, merged).includes(next[s])) { delete next[s]; changed = true; }
        }
      }
      return next;
    });
  };

  const merged = { ...decided, ...scenario };
  const champion = merged.F1 || null;

  // Recompute standings under the current scenario.
  const { rows, baseRank } = useMemo(() => {
    const players = data?.players || [];
    const bSorted = [...players].sort((a, b) => b.base - a.base || a.name.localeCompare(b.name));
    const baseRank = {}; bSorted.forEach((p, i) => { baseRank[p.playerId] = i + 1; });
    const scored = players.map((p) => {
      let total = p.base, gained = 0;
      for (const s of undecided) if (scenario[s] && p.picks[s] === scenario[s]) { total += PTS[roundOf(s)]; gained += PTS[roundOf(s)]; }
      return { ...p, total, gained };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    return { rows: scored.map((r, i) => ({ ...r, rank: i + 1 })), baseRank };
  }, [data, scenario]);

  if (error) return <p className="text-yellow-300 text-center">{error === 'Available once picks lock' ? 'The scenario simulator opens once picks lock.' : error}</p>;
  if (!data) return <LoadingSpinner />;
  const picksMade = Object.keys(scenario).length;

  const Match = ({ slot }) => {
    const [a, b] = deriveMatchup(slot, merged);
    const winner = decided[slot] || scenario[slot] || null;
    const fixed = !!decided[slot];
    const isFinal = slot === 'F1';
    const Row = ({ team }) => {
      const sel = winner === team;
      return (
        <button disabled={!team || fixed} onClick={() => team && pick(slot, team)}
          className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs transition
            ${sel ? 'bg-wc-accent/20 text-wc-accent font-semibold' : 'text-gray-300 hover:bg-white/5'}
            ${!team ? 'opacity-40 cursor-default' : fixed ? 'cursor-default' : 'cursor-pointer'}`}>
          <span>{team ? getFlag(team) : '·'}</span>
          <span className="truncate flex-1 text-left">{team || 'TBD'}</span>
          {sel && <span>{isFinal ? '🏆' : fixed ? '✓' : '●'}</span>}
        </button>
      );
    };
    return (
      <div className={`w-[8.5rem] rounded-lg border p-1 ${isFinal ? 'border-wc-accent/50 bg-wc-accent/[0.05]' : 'border-wc-border bg-wc-navyDarker'}`}>
        <Row team={a} /><Row team={b} />
        <div className="text-center text-[9px] uppercase tracking-wide text-gray-500 pt-0.5">{ROUND_LABEL[roundOf(slot)]} · {PTS[roundOf(slot)]}pt</div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">What if?</h1>
        <p className="text-sm text-gray-400 mt-1">Pick the remaining winners and watch the leaderboard change.</p>
      </div>

      {/* interactive bracket */}
      <div className="card p-3 overflow-x-auto">
        <div className="flex items-center justify-center gap-3 min-w-max">
          <div className="flex flex-col gap-6"><Match slot="QF1" /><Match slot="QF2" /></div>
          <div className="flex flex-col justify-center"><Match slot="SF1" /></div>
          <div className="flex flex-col justify-center"><Match slot="F1" /></div>
          <div className="flex flex-col justify-center"><Match slot="SF2" /></div>
          <div className="flex flex-col gap-6"><Match slot="QF3" /><Match slot="QF4" /></div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        {champion
          ? <span className="accent-text font-semibold">Champion: {getFlag(champion)} {champion} 🏆</span>
          : <span className="text-gray-500">Pick winners above to project the final table.</span>}
        {picksMade > 0 && <button onClick={() => setScenario({})} className="text-xs text-gray-400 hover:text-white underline">reset</button>}
      </div>

      {/* projected standings */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-wc-border">
              <th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-right">Projected</th><th className="px-3 py-2 text-right">Move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const move = baseRank[r.playerId] - r.rank; // + = up
              return (
                <motion.tr key={r.playerId} layout transition={{ duration: 0.35 }}
                  className="border-b border-wc-border/50 last:border-0">
                  <td className="px-3 py-2 text-gray-400">{r.rank}</td>
                  <td className="px-3 py-2 font-medium">
                    <span className="truncate">{r.name}</span>
                    {r.gained > 0 && <span className="ml-2 text-[11px] text-wc-accent">+{r.gained}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold accent-text tabular-nums">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {move > 0 ? <span className="text-wc-accent">▲ {move}</span>
                      : move < 0 ? <span className="text-red-400">▼ {-move}</span>
                      : <span className="text-gray-600">–</span>}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-gray-500">
        Hypothetical only — nothing here changes the real standings. "Move" is versus the current table.
      </p>
    </div>
  );
};

export default Scenario;
