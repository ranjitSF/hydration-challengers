import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches, getPlayers, adminUpdateMatch, adminSetResult, adminSetStartingPoints, adminGetStatus, adminPollScores, adminSetR32 } from '../services';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFlag } from '../lib/teams';

const isUnresolved = (team) => !team || team === 'TBD' || /winner/i.test(team);

const Admin = () => {
  const { authToken } = useAuth();
  const [matches, setMatches] = useState(null);
  const [players, setPlayers] = useState(null);
  const [needsResult, setNeedsResult] = useState([]);
  const [unresolved, setUnresolved] = useState([]);
  const [r32M87, setR32M87] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [pollStatus, setPollStatus] = useState('');

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
      setUnresolved(statusData.unresolvedTeams.map((m) => m.slot));
      setR32M87(statusData.r32M87 || null);
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

  // The full R16 field — the only strings that can ever be a valid result winner.
  const fieldTeams = [
    ...new Set(
      matches
        .filter((m) => m.round === 'R16')
        .flatMap((m) => [m.team_a, m.team_b])
        .filter((t) => t && !isUnresolved(t))
    ),
  ].sort();

  const resultOptions = (m) =>
    m.round === 'R16' ? [m.team_a, m.team_b].filter((t) => t && !isUnresolved(t)) : fieldTeams;

  const run = async (fn, ok) => {
    setActionMsg('');
    try {
      await fn();
      setActionMsg(ok);
      load();
    } catch (err) {
      setActionMsg(err.message);
    }
  };

  const saveTeams = (m) =>
    run(
      () =>
        adminUpdateMatch(
          m.slot,
          {
            team_a: draft(`a-${m.slot}`, isUnresolved(m.team_a) ? '' : m.team_a),
            team_b: draft(`b-${m.slot}`, isUnresolved(m.team_b) ? '' : m.team_b),
          },
          authToken
        ),
      `${m.slot} teams saved`
    );

  const saveResult = (m) => {
    const winner = draft(`w-${m.slot}`, m.winner || '');
    if (!winner) return;
    run(() => adminSetResult(m.slot, winner, authToken), `${m.slot} result set: ${winner}`);
  };

  const saveStartingPoints = (p) =>
    run(
      () => adminSetStartingPoints(p.email, Number(draft(`sp-${p.email}`, p.starting_points)), authToken),
      `${p.display_name} starting points saved`
    );

  const setM87 = (winner) => run(() => adminSetR32('M87', winner, authToken), `R32 M87 set: ${winner} — M96 boards updated`);

  const pollScoresNow = async () => {
    setPollStatus('Polling API-Football...');
    try {
      const result = await adminPollScores(authToken);
      setPollStatus(result.skipped ? result.skipped : `Checked ${result.checked ?? 0}, updated ${result.updated ?? 0}`);
      load();
    } catch (err) {
      setPollStatus(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex items-center gap-3">
          {pollStatus && <span className="text-xs text-gray-400">{pollStatus}</span>}
          <button onClick={pollScoresNow} className="btn-primary text-sm px-3">Poll scores now</button>
        </div>
      </div>

      {actionMsg && (
        <div className="bg-wc-accent/10 border border-wc-accent/30 rounded-lg p-3 text-wc-accent text-sm">{actionMsg}</div>
      )}

      {unresolved.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-300 text-sm">
          Teams still to fill in: {unresolved.join(', ')} — set these before their kickoff. Early picks auto-migrate.
        </div>
      )}

      {needsResult.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          Needs a result: {needsResult.join(', ')}
        </div>
      )}

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold">Round of 32 — Colombia vs Ghana (M87)</h2>
        <p className="text-xs text-gray-400">
          Sets the last R32 result. Everyone who backed the winner gets it as a pickable team in M96.
          {r32M87 ? ` Currently: ${r32M87}.` : ' Not set yet (pending tonight).'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setM87('Colombia')} className="btn-primary text-sm px-3">Colombia won</button>
          <button onClick={() => setM87('Ghana')} className="btn-primary text-sm px-3">Ghana won</button>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Matches &amp; results</h2>
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.slot} className="border border-wc-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold accent-text">{m.slot} · {m.round}</span>
                <span className="text-gray-400 text-xs">
                  {getFlag(m.team_a)} {m.team_a || '—'} vs {getFlag(m.team_b)} {m.team_b || '—'}
                </span>
              </div>

              {(isUnresolved(m.team_a) || isUnresolved(m.team_b)) && m.round === 'R16' && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                    placeholder="Team A"
                    value={draft(`a-${m.slot}`, isUnresolved(m.team_a) ? '' : m.team_a)}
                    onChange={(e) => setDraft(`a-${m.slot}`, e.target.value)}
                  />
                  <input
                    className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                    placeholder="Team B"
                    value={draft(`b-${m.slot}`, isUnresolved(m.team_b) ? '' : m.team_b)}
                    onChange={(e) => setDraft(`b-${m.slot}`, e.target.value)}
                  />
                  <button onClick={() => saveTeams(m)} className="btn-primary text-sm px-3">Save</button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <select
                  className="flex-1 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                  value={draft(`w-${m.slot}`, m.winner || '')}
                  onChange={(e) => setDraft(`w-${m.slot}`, e.target.value)}
                >
                  <option value="">— pick winner —</option>
                  {resultOptions(m).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button onClick={() => saveResult(m)} className="btn-primary text-sm px-3">Set result</button>
                {m.winner && <span className="text-xs text-gray-400 whitespace-nowrap">{m.winner} ({m.source})</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Manual points adjustment</h2>
        <p className="text-xs text-gray-400">
          Round-of-32 carry-in is now computed automatically (3 pts per correct pick, updates itself when M87 lands).
          Use this only for a manual tweak on top — leave at 0 otherwise.
        </p>
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.email} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{p.display_name}</span>
              <input
                type="number"
                className="w-24 bg-wc-navyDarker border border-wc-border rounded px-2 py-1 text-sm"
                value={draft(`sp-${p.email}`, p.starting_points)}
                onChange={(e) => setDraft(`sp-${p.email}`, e.target.value)}
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
