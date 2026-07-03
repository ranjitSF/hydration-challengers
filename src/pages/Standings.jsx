import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getStandings } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const POLL_MS = 25000;
const MEDALS = ['🥇', '🥈', '🥉'];

const Standings = () => {
  const [standings, setStandings] = useState(null);
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-8">
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
                className={`card text-center p-4 ${isFirst ? 'order-2 w-32' : 'w-28'}`}
              >
                <div className="text-3xl mb-1">{MEDALS[top3.indexOf(player)]}</div>
                <div className="font-semibold truncate">{player.displayName}</div>
                <div className="accent-text font-bold text-lg">{player.totalPoints}</div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-wc-border">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">R16</th>
              <th className="px-4 py-2">QF</th>
              <th className="px-4 py-2">SF</th>
              <th className="px-4 py-2">F</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <motion.tr
                key={s.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * i }}
                className="border-b border-wc-border/50 last:border-0"
              >
                <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 font-medium">
                  {s.displayName}
                  {!s.hasSubmitted && <span className="ml-2 text-xs text-yellow-400">no picks</span>}
                </td>
                <td className="px-4 py-2">{s.accuracyByRound.R16.correct}/{s.accuracyByRound.R16.total || 8}</td>
                <td className="px-4 py-2">{s.accuracyByRound.QF.correct}/{s.accuracyByRound.QF.total || 4}</td>
                <td className="px-4 py-2">{s.accuracyByRound.SF.correct}/{s.accuracyByRound.SF.total || 2}</td>
                <td className="px-4 py-2">{s.accuracyByRound.F.correct}/{s.accuracyByRound.F.total || 1}</td>
                <td className="px-4 py-2 text-right font-bold accent-text">{s.totalPoints}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">Points by player</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, standings.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke="#232b45" horizontal={false} />
            <XAxis type="number" stroke="#8892b0" />
            <YAxis type="category" dataKey="name" stroke="#8892b0" width={100} />
            <Tooltip contentStyle={{ background: '#141a2e', border: '1px solid #232b45' }} />
            <Bar dataKey="points" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Standings;
