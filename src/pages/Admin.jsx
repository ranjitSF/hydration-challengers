import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches, getPlayers, adminUpdateMatch, adminSetResult, adminSetStartingPoints, adminGetStatus } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';

const Admin = () => {
  const { authToken } = useAuth();
  const [matches, setMatches] = useState(null);
  const [players, setPlayers] = useState(null);
  const [needsResult, setNeedsResult] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [matchList, playerList, statusData] = await Promise.all([
        getMatches(),
        getPlayers(),
        adminGetStatus(authToken),
      ]);
      setMatches(matchList);
      setPlayers(playerList);
      setNeedsResult(statusData.needsResult.map((m) => m.slot));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-red-400 text-center">{error}</p>;
  if (!matches || !players) return <LoadingSpinner />;

  const draft = (key, fallback = '') => drafts[key] ?? fallback;
  const setDraft = (key, value) => setDrafts((d) => ({ ...d, [key]: value }));

  const saveTbdTeams = async (match) => {
    await adminUpdateMatch(
      match.id,
      { team_a: draft(`a-${match.id}`, match.team_a), team_b: draft(`b-${match.id}`, match.team_b) },
      authToken
    );
    load();
  };

  const saveResult = async (match) => {
    const winner = draft(`w-${match.id}`, match.winner || '');
    if (!winner) return;
    await adminSetResult(match.id, winner, authToken);
    load();
  };

  const saveStartingPoints = async (player) => {
    await adminSetStartingPoints(player.id, Number(draft(`sp-${player.id}`, player.starting_points)), authToken);
    load();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin</h1>

      {needsResult.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          Needs a result: {needsResult.join(', ')}
        </div>
      )}

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Matches &amp; results</h2>
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="border border-wc-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold accent-text">{m.slot} · {m.round}</span>
                {m.winner && (
                  <span className="text-xs text-gray-400">
                    result: {m.winner} ({m.source})
                  </span>
                )}
              </div>

              {(m.team_a === 'TBD' || m.team_b === 'TBD') && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                    placeholder="Team A"
                    value={draft(`a-${m.id}`, m.team_a === 'TBD' ? '' : m.team_a)}
                    onChange={(e) => setDraft(`a-${m.id}`, e.target.value)}
                  />
                  <input
                    className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                    placeholder="Team B"
                    value={draft(`b-${m.id}`, m.team_b === 'TBD' ? '' : m.team_b)}
                    onChange={(e) => setDraft(`b-${m.id}`, e.target.value)}
                  />
                  <button onClick={() => saveTbdTeams(m)} className="btn-primary text-sm px-3">Save</button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                  placeholder="Winner"
                  value={draft(`w-${m.id}`, m.winner || '')}
                  onChange={(e) => setDraft(`w-${m.id}`, e.target.value)}
                />
                <button onClick={() => saveResult(m)} className="btn-primary text-sm px-3">Set result</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Starting points (Round of 32 carryover)</h2>
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{p.display_name}</span>
              <input
                type="number"
                className="w-24 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                value={draft(`sp-${p.id}`, p.starting_points)}
                onChange={(e) => setDraft(`sp-${p.id}`, e.target.value)}
              />
              <button onClick={() => saveStartingPoints(p)} className="btn-primary text-sm px-3">Save</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Admin;
