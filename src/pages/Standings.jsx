import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getStandings } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import ProjectionModal from '../components/ProjectionModal';
import LiveBanner from '../components/LiveBanner';
import SyncStatus from '../components/SyncStatus';
import { GitBranch, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const POLL_MS = 25000;
const MEDALS = ['🥇', '🥈', '🥉'];
const ROUND_PTS = { R16: 6, QF: 10, SF: 16, F: 30 };

// A round accuracy cell: correct/total plus the points secured in that round, e.g. "2/8 (12)".
const RoundCell = ({ s, round, total }) => {
  if (!s.hasSubmitted) return <>—</>;
  const c = s.accuracyByRound[round].correct;
  return <>{c}/{total} <span className="text-gray-500">({c * ROUND_PTS[round]})</span></>;
};

const Standings = () => {
  const [standings, setStandings] = useState(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // { id, name } of a player to inspect

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getStandings();
        if (!cancelled) setStandings(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) return <p className="text-red-400 text-center">{error}</p>;
  if (!standings) return <LoadingSpinner />;

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);
  const chartData = standings.map((s) => ({ name: s.displayName, points: s.totalPoints }));
  const maxPossible = standings[0]?.maxPossible || 'dataMax';

  return (
    <div className="space-y-8">
      <LiveBanner />
      <h1 className="text-2xl font-bold text-center">Standings</h1>

      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-3">
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((player, i) => {
            const isFirst = player === top3[0];
            return (
              <motion.div
                key={player.playerId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i }}
                onClick={() => setViewing({ id: player.playerId, name: player.displayName, rank: standings.indexOf(player) + 1, tab: 'bracket' })}
                className={`card text-center p-4 cursor-pointer hover:border-wc-accent/50 ${isFirst ? 'w-32' : 'w-28'}`}
              >
                <div className="text-3xl mb-1">{MEDALS[top3.indexOf(player)]}</div>
                <div className="font-semibold truncate">{player.displayName}</div>
                <div className="accent-text font-bold text-lg">{player.totalPoints}</div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-wc-border">
              <th className="px-3 sm:px-4 py-2">#</th>
              <th className="px-3 sm:px-4 py-2">Player</th>
              <th className="px-4 py-2">R32</th>
              <th className="px-4 py-2 hidden sm:table-cell">R16</th>
              <th className="px-4 py-2 hidden sm:table-cell">QF</th>
              <th className="px-4 py-2 hidden sm:table-cell">SF</th>
              <th className="px-4 py-2 hidden sm:table-cell">F</th>
              <th className="px-3 sm:px-4 py-2 text-right">Total</th>
              <th className="px-2 py-2 sticky right-0 bg-wc-card border-l border-wc-border/60 text-center text-[10px]">View</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <motion.tr
                key={s.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * i }}
                className="border-b border-wc-border/50 last:border-0 hover:bg-wc-accent/5"
              >
                <td className="px-3 sm:px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 sm:px-4 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[7rem] sm:max-w-none">{s.displayName}</span>
                    {!s.hasSubmitted && <span className="text-xs text-yellow-400 shrink-0">not submitted</span>}
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {s.r32Total ? `${s.r32Correct}/${s.r32Total}` : '—'}
                  <span className="text-gray-500"> ({s.r32Points})</span>
                </td>
                <td className="px-4 py-2 hidden sm:table-cell whitespace-nowrap"><RoundCell s={s} round="R16" total={8} /></td>
                <td className="px-4 py-2 hidden sm:table-cell whitespace-nowrap"><RoundCell s={s} round="QF" total={4} /></td>
                <td className="px-4 py-2 hidden sm:table-cell whitespace-nowrap"><RoundCell s={s} round="SF" total={2} /></td>
                <td className="px-4 py-2 hidden sm:table-cell whitespace-nowrap"><RoundCell s={s} round="F" total={1} /></td>
                <td className="px-3 sm:px-4 py-2 text-right font-bold accent-text">{s.totalPoints}</td>
                <td className="px-2 py-2 sticky right-0 bg-wc-card border-l border-wc-border/60">
                  <div className="flex items-center gap-1 justify-end">
                    <button title="View bracket" aria-label="View bracket"
                      onClick={() => setViewing({ id: s.playerId, name: s.displayName, rank: i + 1, tab: 'bracket' })}
                      className="p-1.5 rounded-md text-gray-400 hover:text-wc-accent hover:bg-wc-accent/10">
                      <GitBranch size={16} />
                    </button>
                    <button title="Path to best finish" aria-label="Path to best finish"
                      onClick={() => setViewing({ id: s.playerId, name: s.displayName, rank: i + 1, tab: 'finish' })}
                      className="p-1.5 rounded-md text-gray-400 hover:text-wc-accent hover:bg-wc-accent/10">
                      <TrendingUp size={16} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <SyncStatus />

      <p className="text-center text-xs text-gray-500">
        Scoring: Round of 32 (carried in) = 3 pts/correct · R16 = 6 · QF = 10 · SF = 16 · Final = 30.
        Ties broken by closest Final total-goals guess, then later-round accuracy. Tap a player to see their bracket.
      </p>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">
          Points by player
          {typeof maxPossible === 'number' && (
            <span className="font-normal text-gray-500"> · out of {maxPossible} possible</span>
          )}
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(200, standings.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke="#232b45" horizontal={false} />
            <XAxis type="number" domain={[0, maxPossible]} allowDataOverflow stroke="#8892b0" />
            <YAxis type="category" dataKey="name" stroke="#8892b0" width={100} />
            <Tooltip contentStyle={{ background: '#141a2e', border: '1px solid #232b45' }} />
            <Bar dataKey="points" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ProjectionModal
        playerId={viewing?.id}
        displayName={viewing?.name}
        currentRank={viewing?.rank}
        initialTab={viewing?.tab}
        onClose={() => setViewing(null)}
      />
    </div>
  );
};

export default Standings;
