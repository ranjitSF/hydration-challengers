import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches, getMyPicks, submitPicks, getConfig } from '../services';
import MatchCard from '../components/MatchCard';
import BracketConnector from '../components/BracketConnector';
import LoadingSpinner from '../components/LoadingSpinner';
import { R16_SLOTS, QF_SLOTS, SF_SLOTS, FINAL_SLOT, deriveMatchup } from '../lib/bracket';
import { resolveBracket } from '../lib/board';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final — Champion' };

const Picks = () => {
  const { authToken } = useAuth();
  const [matches, setMatches] = useState(null);
  const [board, setBoard] = useState(null);
  const [picks, setPicks] = useState({});
  const [lockAt, setLockAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [status, setStatus] = useState({ loading: true, error: '', saving: false, saved: false });

  useEffect(() => {
    (async () => {
      try {
        const [matchList, mine, config] = await Promise.all([getMatches(), getMyPicks(authToken), getConfig()]);
        setMatches(matchList);
        setBoard(mine.board);
        setPicks(mine.picksBySlot || {});
        setLockAt(config.lockAt ? new Date(config.lockAt) : null);
        setStatus((s) => ({ ...s, loading: false }));
      } catch (err) {
        setStatus((s) => ({ ...s, loading: false, error: err.message }));
      }
    })();
  }, [authToken]);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const isLocked = lockAt ? nowTs >= lockAt.getTime() : false;
  const matchBySlot = useMemo(() => (matches ? Object.fromEntries(matches.map((m) => [m.slot, m])) : {}), [matches]);

  const { resolved, optionsBySlot, openSlots, complete } = useMemo(
    () => resolveBracket(board?.options || {}, picks),
    [board, picks]
  );

  const pickedCount = openSlots.filter((s) => resolved[s]).length;

  const handlePick = (slot, team) => {
    if (isLocked) return;
    setPicks((prev) => ({ ...prev, [slot]: team }));
    setStatus((s) => ({ ...s, saved: false }));
  };

  const handleSubmit = async () => {
    setStatus((s) => ({ ...s, saving: true, error: '', saved: false }));
    try {
      await submitPicks(resolved, authToken);
      setStatus((s) => ({ ...s, saving: false, saved: true }));
    } catch (err) {
      const locked = /lock/i.test(err.message || '');
      setStatus((s) => ({ ...s, saving: false, error: locked ? 'Picks just locked — your bracket is now read-only.' : err.message }));
      if (locked) setNowTs(lockAt ? lockAt.getTime() : Date.now());
    }
  };

  if (status.loading) return <LoadingSpinner />;
  if (status.error && !matches) return <p className="text-red-400 text-center">{status.error}</p>;

  const cardFor = (slot) => {
    const isR16 = R16_SLOTS.includes(slot);
    const opts = optionsBySlot[slot] || [];
    const [teamA, teamB] = isR16 ? board.realTeams[slot] || [null, null] : deriveMatchup(slot, resolved);
    let cardStatus;
    if (isR16 && board.pending[slot]) cardStatus = 'pending';
    else if (opts.length === 0) cardStatus = 'dead';
    else if (opts.length === 1) cardStatus = 'forced';
    else cardStatus = 'choice';
    const match = matchBySlot[slot];
    return (
      <MatchCard
        key={slot}
        label={slot}
        teamA={teamA}
        teamB={teamB}
        options={opts}
        picked={resolved[slot]}
        onPick={(team) => handlePick(slot, team)}
        disabled={isLocked}
        status={cardStatus}
        kickoff={match?.kickoff_at}
        venue={match?.venue}
      />
    );
  };

  const renderRound = (round, slots) => (
    <div className="space-y-3">
      <h2 className="text-lg font-bold accent-text">{ROUND_LABEL[round]}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{slots.map(cardFor)}</div>
    </div>
  );

  return (
    <div className="space-y-6 pb-28">
      <div className="card p-4 text-sm text-gray-300 space-y-1">
        <p className="font-semibold text-white">How your bracket works</p>
        <p>
          This is a continuation of your Round-of-32 picks. In each match you can only advance a team you
          <span className="text-wc-accent"> correctly picked</span> to get here — teams you had knocked out are greyed
          out. Where both your teams are gone, that match is <span className="text-gray-400">skipped (0 pts)</span>.
          Matches where you backed only one survivor are filled in automatically. Pick a winner wherever you have a
          real choice, then <span className="text-white">Submit</span> — you can change picks until Sat 9:45am PT.
        </p>
      </div>

      {isLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          Picks are locked — this is now read-only.
        </div>
      )}

      {renderRound('R16', R16_SLOTS)}
      <BracketConnector active={QF_SLOTS.some((s) => resolved[s])} />
      {renderRound('QF', QF_SLOTS)}
      <BracketConnector active={SF_SLOTS.some((s) => resolved[s])} />
      {renderRound('SF', SF_SLOTS)}
      <BracketConnector active={!!resolved[FINAL_SLOT]} />
      {renderRound('F', [FINAL_SLOT])}

      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-wc-navyDarker/95 backdrop-blur border-t border-wc-border p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              {complete ? 'All open matches picked.' : `${pickedCount}/${openSlots.length} open matches picked.`}
              {status.error && <div className="text-red-400">{status.error}</div>}
              {status.saved && <div className="text-wc-accent">Saved! You can resubmit anytime before lock.</div>}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!complete || status.saving}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {status.saving ? 'Submitting...' : 'Submit picks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Picks;
