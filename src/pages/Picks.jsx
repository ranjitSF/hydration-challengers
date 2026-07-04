import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches, getMyPicks, submitPicks, getConfig } from '../services';
import MatchCard from '../components/MatchCard';
import BracketConnector from '../components/BracketConnector';
import LoadingSpinner from '../components/LoadingSpinner';
import { R16_SLOTS, QF_SLOTS, SF_SLOTS, FINAL_SLOT, deriveMatchup } from '../lib/bracket';

const ROUND_LABEL = { R16: 'Round of 16', QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final — Champion' };

const Picks = () => {
  const { authToken } = useAuth();
  const [matches, setMatches] = useState(null);
  const [picksBySlot, setPicksBySlot] = useState({});
  const [lockAt, setLockAt] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [status, setStatus] = useState({ loading: true, error: '', saving: false, saved: false });

  useEffect(() => {
    (async () => {
      try {
        const [matchList, myPicks, config] = await Promise.all([
          getMatches(),
          getMyPicks(authToken),
          getConfig(),
        ]);
        setMatches(matchList);
        setLockAt(config.lockAt ? new Date(config.lockAt) : null);
        setPicksBySlot(myPicks.picksBySlot || {});
        setStatus((s) => ({ ...s, loading: false }));
      } catch (err) {
        setStatus((s) => ({ ...s, loading: false, error: err.message }));
      }
    })();
  }, [authToken]);

  // Advance a clock so the page flips to read-only at lock time without a refresh.
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const isLocked = lockAt ? nowTs >= lockAt.getTime() : false;

  const matchBySlot = useMemo(
    () => (matches ? Object.fromEntries(matches.map((m) => [m.slot, m])) : {}),
    [matches]
  );

  const handlePick = (slot, team) => {
    if (isLocked) return;
    setPicksBySlot((prev) => {
      const next = { ...prev, [slot]: team };
      // Clear downstream picks that no longer match the new upstream selection
      for (const laterSlot of [...QF_SLOTS, ...SF_SLOTS, FINAL_SLOT]) {
        const [a, b] = deriveMatchup(laterSlot, next);
        if (next[laterSlot] && next[laterSlot] !== a && next[laterSlot] !== b) {
          delete next[laterSlot];
        }
      }
      return next;
    });
    setStatus((s) => ({ ...s, saved: false }));
  };

  const allSlots = [...R16_SLOTS, ...QF_SLOTS, ...SF_SLOTS, FINAL_SLOT];
  const pickedCount = allSlots.filter((slot) => picksBySlot[slot]).length;
  const complete = pickedCount === allSlots.length;

  const handleSubmit = async () => {
    setStatus((s) => ({ ...s, saving: true, error: '', saved: false }));
    try {
      await submitPicks(picksBySlot, authToken);
      setStatus((s) => ({ ...s, saving: false, saved: true }));
    } catch (err) {
      const locked = /lock/i.test(err.message || '');
      setStatus((s) => ({
        ...s,
        saving: false,
        error: locked ? 'Picks just locked — your bracket is now read-only.' : err.message,
      }));
      if (locked) setNowTs(lockAt ? lockAt.getTime() : Date.now());
    }
  };

  if (status.loading) return <LoadingSpinner />;
  if (status.error && !matches) return <p className="text-red-400 text-center">{status.error}</p>;

  const renderRound = (round, slots) => (
    <div className="space-y-3">
      <h2 className="text-lg font-bold accent-text">{ROUND_LABEL[round]}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const match = matchBySlot[slot];
          if (!match) return null;
          const [teamA, teamB] =
            round === 'R16' ? [match.team_a, match.team_b] : deriveMatchup(slot, picksBySlot);
          return (
            <MatchCard
              key={slot}
              label={slot}
              teamA={teamA}
              teamB={teamB}
              picked={picksBySlot[slot]}
              onPick={(team) => handlePick(slot, team)}
              disabled={isLocked}
              kickoff={match.kickoff_at}
              venue={match.venue}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {isLocked && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-300 text-sm">
          Picks are locked — this is now read-only.
        </div>
      )}

      {renderRound('R16', R16_SLOTS)}
      <BracketConnector active={QF_SLOTS.some((s) => picksBySlot[s])} />
      {renderRound('QF', QF_SLOTS)}
      <BracketConnector active={SF_SLOTS.some((s) => picksBySlot[s])} />
      {renderRound('SF', SF_SLOTS)}
      <BracketConnector active={!!picksBySlot[FINAL_SLOT]} />
      {renderRound('F', [FINAL_SLOT])}

      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-wc-navyDarker/95 backdrop-blur border-t border-wc-border p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              {complete ? 'All 15 picks made.' : `${pickedCount}/15 picks made — fill every match to submit.`}
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
